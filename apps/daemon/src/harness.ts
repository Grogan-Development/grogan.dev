import {
  ApprovalRequestId,
  EventId,
  MessageId,
  type OrchestrationThreadActivity,
  type ProviderApprovalDecision,
  type RuntimeMode,
  type TurnId,
} from "@t3tools/contracts";

import type { Daemon } from "./daemon.ts";
import {
  type ChatMessage,
  type ContentPart,
  type ImagePart,
  streamChatCompletion,
  systemPrompt,
} from "./openrouter.ts";
import { MAX_SHOT_IMAGES, NERO_INSTANCE_ID, nextToken, nowIso } from "./runtime.ts";
import { executeTool, parseToolArguments, type ShotImage, toolActivityMeta } from "./tools.ts";

const MAX_ROUNDS = 32;

const isAbort = (error: unknown): boolean =>
  error instanceof Error && (error.message === "aborted" || error.name === "AbortError");

type LiveTurn = {
  readonly controller: AbortController;
  readonly turnId: TurnId;
  readonly commandId: string;
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

  start(input: HarnessStartInput): void {
    this.abort(input.threadId);
    const controller = new AbortController();
    const live: LiveTurn = {
      controller,
      turnId: input.turnId,
      commandId: input.commandId,
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

  private isCurrent(threadId: string, live: LiveTurn): boolean {
    return this.live.get(threadId) === live && !live.controller.signal.aborted;
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
      existing.push(user);
      return existing;
    }
    const thread = this.daemon.getThread(threadId);
    const prior: ChatMessage[] = [
      { role: "system", content: systemPrompt(this.daemon.options.workspaceRoot) },
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
    const apiKey = this.daemon.options.openRouterApiKey;
    if (apiKey === undefined || apiKey.length === 0) {
      this.daemon.finishTurn({
        threadId: input.threadId,
        turnId: live.turnId,
        commandId: live.commandId,
        assistantMessageId: this.daemon.completeAssistant({
          threadId: input.threadId,
          turnId: live.turnId,
          commandId: live.commandId,
          text: "Nero cannot start the GLM loop: OPENROUTER_API_KEY is not set.",
        }),
        status: "error",
        lastError: "OPENROUTER_API_KEY is not set.",
      });
      return;
    }

    const images = this.takeImages(input.threadId, input.attachmentIds);
    const conversation = this.conversation(
      input.threadId,
      input.userMessageId,
      input.userText,
      images,
    );
    let lastAssistant: MessageId | null = null;

    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        if (!this.isCurrent(input.threadId, live)) throw new Error("aborted");
        this.attachPendingShots(input.threadId, conversation);
        this.daemon.touchKeepAwake();

        let assistantId: MessageId | undefined;
        const result = await streamChatCompletion({
          baseUrl: this.daemon.options.openRouterBaseUrl,
          apiKey,
          messages: conversation,
          signal: live.controller.signal,
          onText: (delta) => {
            if (!this.isCurrent(input.threadId, live)) return;
            if (assistantId === undefined) {
              assistantId = MessageId.make(nextToken("msg"));
            }
            this.daemon.deltaAssistant({
              threadId: input.threadId,
              messageId: assistantId,
              turnId: live.turnId,
              commandId: live.commandId,
              delta,
            });
          },
        });

        if (!this.isCurrent(input.threadId, live)) throw new Error("aborted");

        if (assistantId !== undefined) {
          this.daemon.completeAssistant({
            threadId: input.threadId,
            messageId: assistantId,
            turnId: live.turnId,
            commandId: live.commandId,
          });
          lastAssistant = assistantId;
        }

        if (result.toolCalls.length === 0) {
          if (assistantId === undefined && result.content.length > 0) {
            lastAssistant = this.daemon.completeAssistant({
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
            assistantMessageId: lastAssistant,
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
          if (!this.isCurrent(input.threadId, live)) throw new Error("aborted");
          let args: Record<string, unknown> = {};
          try {
            args = parseToolArguments(call.function.arguments);
          } catch {
            args = {};
          }
          const meta = toolActivityMeta(call.function.name, args);
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
          let toolResult = approved
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

          this.pushShots(input.threadId, toolResult.shots);
          this.daemon.appendActivity(input.threadId, live.commandId, {
            id: EventId.make(nextToken("act")),
            tone: toolResult.failed ? "error" : "tool",
            kind: "tool.completed",
            summary: meta.title,
            payload: {
              toolCallId: call.id,
              itemType: meta.itemType,
              requestKind: meta.requestKind,
              title: meta.title,
              detail: meta.detail,
              status: toolResult.failed ? "failed" : "completed",
              ...(meta.command === undefined ? {} : { command: meta.command }),
              data: {
                kind: "execute",
                rawOutput: { content: toolResult.text },
                ...(meta.command === undefined ? {} : { command: meta.command }),
              },
            },
            turnId: live.turnId,
            createdAt: nowIso(),
          });
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult.text,
          });
        }
      }

      this.daemon.finishTurn({
        threadId: input.threadId,
        turnId: live.turnId,
        commandId: live.commandId,
        assistantMessageId: lastAssistant,
        status: "error",
        lastError: "Tool loop exceeded the maximum number of rounds.",
      });
    } catch (error) {
      if (!this.isCurrent(input.threadId, live) || isAbort(error)) {
        if (this.live.get(input.threadId) === live) {
          this.daemon.finishTurn({
            threadId: input.threadId,
            turnId: live.turnId,
            commandId: live.commandId,
            assistantMessageId: lastAssistant,
            status: "interrupted",
            lastError: null,
          });
        }
        return;
      }
      const message = error instanceof Error ? error.message : "GLM loop failed.";
      const assistantMessageId = this.daemon.completeAssistant({
        threadId: input.threadId,
        turnId: live.turnId,
        commandId: live.commandId,
        text: `Nero GLM loop error: ${message}`,
      });
      this.daemon.finishTurn({
        threadId: input.threadId,
        turnId: live.turnId,
        commandId: live.commandId,
        assistantMessageId,
        status: "error",
        lastError: message,
      });
    }
  }
}
