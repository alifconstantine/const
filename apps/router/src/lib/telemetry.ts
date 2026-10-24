/** Incremental SSE parser. Network chunks are not event boundaries. */
export class SseUsageParser {
  private buffer = "";
  private decoder = new TextDecoder();
  promptTokens = 0;
  completionTokens = 0;
  cachedTokens = 0;
  outputText = "";
  hasUsage = false;
  hasError = false;
  firstTokenAt?: number;
  push(chunk: Uint8Array) {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    this.drain();
  }
  finish() {
    this.buffer += this.decoder.decode();
    this.drain();
    if (this.buffer.trim()) this.event(this.buffer);
    this.buffer = "";
  }
  private drain() {
    this.buffer = this.buffer.replace(/\r\n/g, "\n");
    let index: number;
    while ((index = this.buffer.indexOf("\n\n")) >= 0) {
      this.event(this.buffer.slice(0, index));
      this.buffer = this.buffer.slice(index + 2);
    }
  }
  private event(event: string) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    try {
      const json = JSON.parse(data);
      if (json.error) this.hasError = true;
      const usage = json.usage;
      if (
        usage &&
        typeof usage.prompt_tokens === "number" &&
        typeof usage.completion_tokens === "number"
      ) {
        this.hasUsage = true;
        this.promptTokens = usage.prompt_tokens;
        this.completionTokens = usage.completion_tokens;
        this.cachedTokens =
          usage.prompt_tokens_details?.cached_tokens ??
          usage.cached_tokens ??
          0;
      }
      for (const choice of json.choices ?? []) {
        const delta = choice.delta ?? {};
        const text =
          (typeof delta.content === "string" ? delta.content : "") +
          (typeof delta.reasoning_content === "string"
            ? delta.reasoning_content
            : "");
        if (text || delta.tool_calls?.length)
          this.firstTokenAt ??= performance.now();
        this.outputText +=
          text + (delta.tool_calls ? JSON.stringify(delta.tool_calls) : "");
      }
    } catch {
      /* Ignore comments and non-JSON provider events. */
    }
  }
}
export function generateRequestId() {
  return "req_" + crypto.randomUUID().replace(/-/g, "");
}
export function estimateTokens(text: string) {
  return Math.ceil(new TextEncoder().encode(text).length / 3);
}
export function estimateMessagesTokens(messages: Array<{ content?: unknown }>) {
  return messages.reduce(
    (sum, message) =>
      sum +
      estimateTokens(
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content ?? ""),
      ) +
      4,
    0,
  );
}
