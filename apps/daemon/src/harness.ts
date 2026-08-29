import {
  ApprovalRequestId,
  EventId,
  MessageId,
  type ProviderApprovalDecision,
  type RuntimeMode,
  type TurnId,
} from "@t3tools/contracts";

import type { Daemon } from "./daemon.ts";
import type { ChatMessage, ContentPart, ImagePart } from "./router/openaiCompat.ts";
import { systemPrompt } from "./router/catalog.ts";
import { MAX_SHOT_IMAGES, nextToken, nowIso } from "./runtime.ts";
import { executeTool, parseToolArguments, type ShotImage, toolActivityMeta } from "./tools.ts";

const MAX_ROUNDS = 32;

const isAbort = (error: unknown): boolean =>
  error instanceof Error && (error.message === "aborted" || error.name === "AbortError");

type LiveTurn = {
  readonly controller: AbortController;
  readonly turnId: TurnId;
  readonly commandId: string;
  assistantId: MessageId | undefined;
  inProgressTools: Array<{
    readonly toolCallId: string;
    readonly meta: ReturnType<typeof toolActivityMeta>;
  }>;
  /** Set by evict(): the thread was reverted — settle quietly, no writes. */
  evicted?: boolean;
};

type ApprovalWaiter = {
  readonly threadId: string;
  readonly resolve: (decision: ProviderApprovalDecision) => void;
};

export type HarnessStartInput = {
  readonly threadId: string;
  readonly turnId: TurnId;
  readonly commandId: string;
  readonly userMessageId: string;
  readonly userText: string;
  readonly attachmentIds: ReadonlyArray<string>;
  readonly runtimeMode: RuntimeMode;
};

const shotPart = (shot: ShotImage): ImagePart => ({
  type: "image_url",
  image_url: { url: `data:${shot.mimeType};base64,${shot.base64}` },
});

const userContent = (text: string, images: ReadonlyArray<ImagePart>): string | ContentPart[] => {
  if (images.length === 0) return text;
  const parts: ContentPart[] = [{ type: "text", text }];
  for (const image of images) parts.push(image);
  return parts;
};

const needsApproval = (
  runtimeMode: RuntimeMode,
  requestKind: "command" | "file-read" | "file-change",
): boolean => {
  if (runtimeMode === "full-access") return false;
  if (runtimeMode === "auto") return false;
  if (runtimeMode === "auto-accept-edits") return requestKind === "command";
  return true;
};

/**
 * Drop protocol-invalid tails left by interrupted turns: an assistant
 * message with tool_calls must be followed by a tool result for every call
 * id, and tool results must follow such an assistant message. OpenAI-strict
 * backends 400 on any later turn otherwise — an orphaned block would poison
 * the thread until daemon restart.
 */
export const sanitizeConversation = (messages: ChatMessage[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message === undefined) continue;
    const calls = message.role === "assistant" ? message.tool_calls : undefined;
    if (Array.isArray(calls) && calls.length > 0) {
      const missing = new Set(calls.map((call) => call.id));
      let j = i + 1;
      while (j < messages.length) {
        const next = messages[j];
        if (next === undefined || next.role !== "tool" || next.tool_call_id === undefined) break;
        if (!missing.delete(next.tool_call_id)) break;
        j += 1;
      }
      if (missing.size === 0) {
        out.push(message, ...messages.slice(i + 1, j));
        i = j - 1;
        continue;
      }
      // Incomplete: drop the assistant block together with its partial
      // results; trailing stray results are dropped by the rule below.
      i = j - 1;
      continue;
    }
    if (message.role === "tool") continue;
    out.push(message);
  }
  return out;
};

export class PiHarness {
  private readonly daemon: Daemon;
  private readonly live = new Map<string, LiveTurn>();
  private readonly conversations = new Map<string, ChatMessage[]>();
  private readonly pendingShots = new Map<string, ShotImage[]>();
  private readonly sessionAllow = new Map<string, Set<string>>();
  private readonly approvals = new Map<string, ApprovalWaiter>();

  constructor(daemon: Daemon) {
    this.daemon = daemon;
  }

  abort(threadId: string): void {
    this.live.get(threadId)?.controller.abort();
    for (const [requestId, waiter] of this.approvals) {
      if (waiter.threadId !== threadId) continue;
      this.approvals.delete(requestId);
      waiter.resolve("cancel");
    }
  }

  respondApproval(requestId: string, decision: ProviderApprovalDecision): boolean {
    const waiter = this.approvals.get(requestId);
    if (waiter === undefined) return false;
    this.approvals.delete(requestId);
    waiter.resolve(decision);
    return true;
  }

  pendingApprovalCount(threadId: string): number {
    let count = 0;
    for (const waiter of this.approvals.values()) {
      if (waiter.threadId === threadId) count += 1;
    }
    return count;
  }

  isLive(threadId: string): boolean {
    return this.live.has(threadId);
  }

  /**
   * Drop a thread's model memory entirely: used by revert so the next turn
   * rebuilds the conversation from the truncated transcript instead of
   * silently feeding the model pre-revert history.
   */
  evict(threadId: string): void {
    // Mark before aborting: the aborted turn's run() unwinds asynchronously
    // and must not settle into the truncated thread (phantom assistant
    // message, resurrected latestTurn, post-restore checkpoint capture).
    const live = this.live.get(threadId);
    if (live !== undefined) live.evicted = true;
    this.abort(threadId);
    this.conversations.delete(threadId);
    this.pendingShots.delete(threadId);
  }

  start(input: HarnessStartInput): void {
    this.abort(input.threadId);
    const controller = new AbortController();
    const live: LiveTurn = {
      controller,
      turnId: input.turnId,
      commandId: input.commandId,
      assistantId: undefined,
      inProgressTools: [],
    };
    this.live.set(input.threadId, live);
    this.daemon.setLiveTurn(input.threadId, input.turnId);
    void this.run(input, live)
      .catch(() => undefined)
      .finally(() => {
        if (this.live.get(input.threadId) === live) {
          this.live.delete(input.threadId);
          this.daemon.setLiveTurn(input.threadId, null);
        }
      });
  }

  private conversation(
    threadId: string,
    userMessageId: string,
    userText: string,
    images: ImagePart[],
  ): ChatMessage[] {
    const existing = this.conversations.get(threadId);
    const user: ChatMessage = { role: "user", content: userContent(userText, images) };
    if (existing !== undefined) {
      // Heal protocol damage from interrupted turns before extending. The
      // sanitized array must ALWAYS become the stored one: this turn's
      // messages are appended to the returned array, and storing it only
      // when the length changed would strand them in a discarded copy.
      const clean = sanitizeConversation(existing);
      this.conversations.set(threadId, clean);
      clean.push(user);
      return clean;
    }
    const thread = this.daemon.getThread(threadId);
    const prior: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt(this.daemon.options.workspaceRoot, this.daemon.scanSkills()),
      },
    ];
    if (thread !== undefined) {
      for (const message of thread.messages) {
        if (message.id === userMessageId) continue;
        if (message.streaming || message.text.length === 0) continue;
        if (message.role === "user" || message.role === "assistant") {
          prior.push({ role: message.role, content: message.text });
        }
      }
    }
    prior.push(user);
    this.conversations.set(threadId, prior);
    return prior;
  }

  private takeImages(threadId: string, attachmentIds: ReadonlyArray<string>): ImagePart[] {
    const images: ImagePart[] = [];
    for (const id of attachmentIds) {
      if (images.length >= MAX_SHOT_IMAGES) break;
      const dataUrl = this.daemon.readAttachmentDataUrl(id);
      if (dataUrl === undefined) continue;
      images.push({ type: "image_url", image_url: { url: dataUrl } });
    }
    const pending = this.pendingShots.get(threadId) ?? [];
    this.pendingShots.delete(threadId);
    for (const shot of pending) {
      if (images.length >= MAX_SHOT_IMAGES) break;
      images.push(shotPart(shot));
    }
    return images;
  }

  private pushShots(threadId: string, shots: ReadonlyArray<ShotImage>): void {
    if (shots.length === 0) return;
    const current = this.pendingShots.get(threadId) ?? [];
    this.pendingShots.set(threadId, [...current, ...shots].slice(-MAX_SHOT_IMAGES));
  }

  private attachPendingShots(threadId: string, conversation: ChatMessage[]): void {
    const pending = this.pendingShots.get(threadId) ?? [];
    if (pending.length === 0) return;
    this.pendingShots.delete(threadId);
    const images = pending.slice(0, MAX_SHOT_IMAGES).map(shotPart);
    conversation.push({
      role: "user",
      content: userContent("Seat screenshot(s) from nero-desktop shot:", images),
    });
  }

  private emitToolCompleted(
    input: HarnessStartInput,
    live: LiveTurn,
    toolCallId: string,
    meta: ReturnType<typeof toolActivityMeta>,
    status: "completed" | "failed" | "stopped",
    text: string,
  ): void {
    this.daemon.appendActivity(input.threadId, live.commandId, {
      id: EventId.make(nextToken("act")),
      tone: status === "completed" ? "tool" : "error",
      kind: "tool.completed",
      summary: meta.title,
      payload: {
        toolCallId,
        itemType: meta.itemType,
        requestKind: meta.requestKind,
        title: meta.title,
        detail: meta.detail,
        status,
        ...(meta.command === undefined ? {} : { command: meta.command }),
        data: {
          kind: "execute",
          rawOutput: { content: text },
          ...(meta.command === undefined ? {} : { command: meta.command }),
        },
      },
      turnId: live.turnId,
      createdAt: nowIso(),
    });
  }

  private settleAbandoned(
    input: HarnessStartInput,
    live: LiveTurn,
    status: "interrupted" | "error",
    lastError: string | null,
  ): void {
    if (live.assistantId !== undefined) {
      this.daemon.completeAssistant({
        threadId: input.threadId,
        messageId: live.assistantId,
        turnId: live.turnId,
        commandId: live.commandId,
      });
    }
    for (const tool of live.inProgressTools) {
      this.emitToolCompleted(
        input,
        live,
        tool.toolCallId,
        tool.meta,
        status === "interrupted" ? "stopped" : "failed",
        status === "interrupted" ? "Interrupted." : (lastError ?? "failed"),
      );
    }
    live.inProgressTools = [];
    this.daemon.finishTurn({
      threadId: input.threadId,
      turnId: live.turnId,
      commandId: live.commandId,
      assistantMessageId: live.assistantId ?? null,
      status,
      lastError,
    });
  }

  private async waitApproval(
    threadId: string,
    requestId: string,
    signal: AbortSignal,
  ): Promise<ProviderApprovalDecision> {
    if (signal.aborted) return "cancel";
    return new Promise((resolve) => {
      const onAbort = () => {
        this.approvals.delete(requestId);
        resolve("cancel");
      };
      this.approvals.set(requestId, {
        threadId,
        resolve: (decision) => {
          signal.removeEventListener("abort", onAbort);
          resolve(decision);
        },
      });
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private async approveTool(
    input: HarnessStartInput,
    live: LiveTurn,
    name: string,
    _args: Record<string, unknown>,
    meta: ReturnType<typeof toolActivityMeta>,
  ): Promise<boolean> {
    const allowed = this.sessionAllow.get(input.threadId);
    if (allowed?.has(name) === true) return true;
    if (!needsApproval(input.runtimeMode, meta.requestKind)) return true;
    const requestId = ApprovalRequestId.make(nextToken("apr").replaceAll("_", "-"));
    const at = nowIso();
    this.daemon.appendActivity(input.threadId, live.commandId, {
      id: EventId.make(nextToken("act")),
      tone: "approval",
      kind: "approval.requested",
      summary: `Approve ${name}`,
      payload: {
        requestId,
        requestKind: meta.requestKind,
        detail: meta.detail,
        options: [
          { decision: "accept", label: "Approve" },
          { decision: "acceptForSession", label: "Always allow this session" },
          { decision: "decline", label: "Decline" },
        ],
      },
      turnId: live.turnId,
      createdAt: at,
    });
    const decision = await this.waitApproval(input.threadId, requestId, live.controller.signal);
    this.daemon.appendActivity(input.threadId, live.commandId, {
      id: EventId.make(nextToken("act")),
      tone: "approval",
      kind: "approval.resolved",
      summary: `Approval ${decision}`,
      payload: { requestId, decision },
      turnId: live.turnId,
      createdAt: nowIso(),
    });
    if (decision === "acceptAlways" || decision === "acceptForSession") {
      const set = this.sessionAllow.get(input.threadId) ?? new Set<string>();
      set.add(name);
      this.sessionAllow.set(input.threadId, set);
      return true;
    }
    return decision === "accept";
  }

  private async run(input: HarnessStartInput, live: LiveTurn): Promise<void> {
    const images = this.takeImages(input.threadId, input.attachmentIds);
    const conversation = this.conversation(
      input.threadId,
      input.userMessageId,
      input.userText,
      images,
    );

    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        if (live.controller.signal.aborted) throw new Error("aborted");
        this.attachPendingShots(input.threadId, conversation);
        this.daemon.touchKeepAwake();

        const thread = this.daemon.getThread(input.threadId);
        const options = thread?.modelSelection.options ?? [];
        const optionValue = (id: string): string | boolean | undefined =>
          options.find((option) => option.id === id)?.value;
        const result = await this.daemon.router.stream({
          model: thread?.modelSelection.model ?? "",
          messages: conversation,
          signal: live.controller.signal,
          timeoutMs: this.daemon.options.routerTimeoutMs,
          idleMs: this.daemon.options.routerIdleMs,
          fast: optionValue("fastMode") === true,
          reasoningEffort:
            typeof optionValue("reasoningEffort") === "string"
              ? (optionValue("reasoningEffort") as string)
              : undefined,
          onText: (delta) => {
            if (live.controller.signal.aborted) return;
            if (live.assistantId === undefined) {
              live.assistantId = MessageId.make(nextToken("msg"));
            }
            this.daemon.deltaAssistant({
              threadId: input.threadId,
              messageId: live.assistantId,
              turnId: live.turnId,
              commandId: live.commandId,
              delta,
            });
          },
        });

        if (live.controller.signal.aborted) throw new Error("aborted");

        if (live.assistantId !== undefined) {
          this.daemon.completeAssistant({
            threadId: input.threadId,
            messageId: live.assistantId,
            turnId: live.turnId,
            commandId: live.commandId,
          });
        }

        if (result.toolCalls.length === 0) {
          if (live.assistantId === undefined && result.content.length > 0) {
            live.assistantId = this.daemon.completeAssistant({
              threadId: input.threadId,
              turnId: live.turnId,
              commandId: live.commandId,
              text: result.content,
            });
          }
          conversation.push({
            role: "assistant",
            content: result.content.length > 0 ? result.content : null,
          });
          this.daemon.finishTurn({
            threadId: input.threadId,
            turnId: live.turnId,
            commandId: live.commandId,
            assistantMessageId: live.assistantId ?? null,
            status: "ready",
            lastError: null,
          });
          return;
        }

        conversation.push({
          role: "assistant",
          content: result.content.length > 0 ? result.content : null,
          tool_calls: result.toolCalls,
        });

        for (const call of result.toolCalls) {
          if (live.controller.signal.aborted) throw new Error("aborted");
          let args: Record<string, unknown> = {};
          try {
            args = parseToolArguments(call.function.arguments);
          } catch {
            args = {};
          }
          const meta = toolActivityMeta(call.function.name, args);
          live.inProgressTools.push({ toolCallId: call.id, meta });
          const startedAt = nowIso();
          this.daemon.appendActivity(input.threadId, live.commandId, {
            id: EventId.make(nextToken("act")),
            tone: "tool",
            kind: "tool.updated",
            summary: meta.title,
            payload: {
              toolCallId: call.id,
              itemType: meta.itemType,
              requestKind: meta.requestKind,
              title: meta.title,
              detail: meta.detail,
              status: "inProgress",
              ...(meta.command === undefined ? {} : { command: meta.command }),
              data: {
                kind: "execute",
                ...(meta.command === undefined ? {} : { command: meta.command }),
              },
            },
            turnId: live.turnId,
            createdAt: startedAt,
          });

          const approved = await this.approveTool(input, live, call.function.name, args, meta);
          // A superseding turn (or stop/revert) resolved the approval with
          // "cancel" via abort: bail without touching the shared array.
          // Pushing the declined tool result here would land it after the
          // next turn's user message and poison the conversation.
          if (live.controller.signal.aborted) throw new Error("aborted");
          const toolResult = approved
            ? await executeTool(call.function.name, call.function.arguments, {
                workspaceRoot: this.daemon.options.workspaceRoot,
                homeDir: this.daemon.options.homeDir,
                signal: live.controller.signal,
              })
            : {
                text: "User declined this tool.",
                shots: [],
                failed: true,
              };

          live.inProgressTools = live.inProgressTools.filter(
            (entry) => entry.toolCallId !== call.id,
          );
          this.pushShots(input.threadId, toolResult.shots);
          this.emitToolCompleted(
            input,
            live,
            call.id,
            meta,
            toolResult.failed ? "failed" : "completed",
            toolResult.text,
          );
          if (live.controller.signal.aborted) throw new Error("aborted");
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult.text,
          });
        }
        live.assistantId = undefined;
      }

      this.settleAbandoned(
        input,
        live,
        "error",
        "Tool loop exceeded the maximum number of rounds.",
      );
    } catch (error) {
      if (live.evicted) {
        // The thread was reverted while this turn ran: its messages are
        // gone, so settling would append phantom state to the truncation.
        return;
      }
      if (live.controller.signal.aborted || isAbort(error)) {
        this.settleAbandoned(input, live, "interrupted", null);
        return;
      }
      const message = error instanceof Error ? error.message : "GLM loop failed.";
      if (live.assistantId === undefined) {
        live.assistantId = this.daemon.completeAssistant({
          threadId: input.threadId,
          turnId: live.turnId,
          commandId: live.commandId,
          text: `Nero GLM loop error: ${message}`,
        });
      }
      this.settleAbandoned(input, live, "error", message);
    }
  }
}
