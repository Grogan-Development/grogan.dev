/**
 * OpenAI Responses-protocol streaming (`/responses`). Shared by the ChatGPT
 * Pro (Codex backend) route and OpenCode Zen's Responses-style models
 * (gpt-5.6-*, grok-4.6) — same event grammar, different endpoint/auth.
 */
import type { StreamRequest } from "./catalog.ts";
import type { ChatMessage, StreamChatResult, ToolCall } from "./openaiCompat.ts";

export type ResponsesInputItem = Record<string, unknown>;

/** Map our chat transcript onto Responses input items. */
export const toResponsesInput = (
  messages: ReadonlyArray<ChatMessage>,
): ReadonlyArray<ResponsesInputItem> => {
  const items: ResponsesInputItem[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "system":
        break;
      case "user": {
        const text =
          typeof message.content === "string"
            ? message.content
            : message.content
                .map((part) => {
                  if (part.type === "text") return part.text;
                  // Responses takes images as input_image parts; data URLs work.
                  return `[image] ${part.image_url.url}`;
                })
                .join("\n\n");
        items.push({
          role: message.role,
          type: "message",
          content: [{ type: "input_text", text }],
        });
        break;
      }
      case "assistant": {
        if (message.content !== null && message.content.length > 0) {
          items.push({
            role: "assistant",
            type: "message",
            content: [{ type: "output_text", text: message.content }],
          });
        }
        for (const call of message.tool_calls ?? []) {
          items.push({
            type: "function_call",
            call_id: call.id,
            name: call.function.name,
            arguments: call.function.arguments,
          });
        }
        break;
      }
      case "tool": {
        items.push({
          type: "function_call_output",
          call_id: message.tool_call_id,
          output: message.content,
        });
        break;
      }
    }
  }
  return items;
};

export type ResponsesStreamInput = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly model: string;
  readonly instructions: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly signal: AbortSignal;
  readonly onText: (delta: string) => void;
  readonly timeoutMs: number;
  readonly idleMs: number;
  readonly label: string;
  /** Reasoning level ("low" | "medium" | "high"); omitted = provider default. */
  readonly reasoningEffort?: string | undefined;
};

const systemText = (messages: ReadonlyArray<ChatMessage>): string => {
  for (const message of messages) {
    if (message.role === "system") return message.content;
  }
  return "";
};

export const streamResponses = async (input: ResponsesStreamInput): Promise<StreamChatResult> => {
  const response = await fetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      ...input.headers,
    },
    body: JSON.stringify({
      model: input.model,
      instructions: input.instructions.length > 0 ? input.instructions : systemText(input.messages),
      input: toResponsesInput(input.messages.filter((message) => message.role !== "system")),
      stream: true,
      store: false,
      tool_choice: "auto",
      parallel_tool_calls: false,
      ...(input.reasoningEffort === undefined
        ? {}
        : { reasoning: { effort: input.reasoningEffort } }),
    }),
    signal: input.signal,
  });
  if (!response.ok || response.body === null) {
    const text = response.body === null ? "" : await response.text();
    throw new Error(`${input.label} HTTP ${response.status}: ${text.slice(0, 800)}`);
  }

  const tools = new Map<number, { callId: string; name: string; arguments: string }>();
  let content = "";
  let finishReason: string | null = null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onEvent = (name: string, payload: Record<string, unknown>): void => {
    if (name === "response.output_text.delta" && typeof payload.delta === "string") {
      content += payload.delta;
      input.onText(payload.delta);
      return;
    }
    if (name === "response.output_item.added") {
      const item = payload.item as Record<string, unknown> | undefined;
      if (item !== undefined && item.type === "function_call") {
        const index = typeof payload.output_index === "number" ? payload.output_index : tools.size;
        tools.set(index, {
          callId: typeof item.call_id === "string" ? item.call_id : `call_${index + 1}`,
          name: typeof item.name === "string" ? item.name : "",
          arguments: typeof item.arguments === "string" ? item.arguments : "",
        });
      }
      return;
    }
    if (name === "response.function_call_arguments.delta") {
      const index = typeof payload.output_index === "number" ? payload.output_index : 0;
      const current = tools.get(index) ?? { callId: `call_${index + 1}`, name: "", arguments: "" };
      if (typeof payload.delta === "string") current.arguments += payload.delta;
      tools.set(index, current);
      return;
    }
    if (name === "response.completed" || name === "response.incomplete") {
      const resp = payload.response as Record<string, unknown> | undefined;
      if (resp !== undefined && typeof resp.status === "string") {
        finishReason = resp.status === "completed" ? "stop" : resp.status;
      }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const nl = buffer.indexOf("\n");
      if (nl < 0) break;
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data.length === 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data) as unknown;
      } catch {
        continue;
      }
      if (parsed === null || typeof parsed !== "object") continue;
      const record = parsed as Record<string, unknown>;
      if (typeof record.type === "string") {
        onEvent(record.type, record);
      }
    }
  }

  const toolCalls: ToolCall[] = [...tools.values()]
    .filter((tool) => tool.name.length > 0)
    .map((tool) => ({
      id: tool.callId,
      type: "function",
      function: { name: tool.name, arguments: tool.arguments },
    }));
  return { content, toolCalls, finishReason };
};
