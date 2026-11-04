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
  errorMessage?: string;
  errorCode?: string;
  errorStatus?: number;
  hasTerminal = false;
  firstTokenAt?: number;

  /** True when no partial SSE frame is buffered (safe to inject a keep-alive comment). */
  get isAtEventBoundary(): boolean {
    return this.buffer.length === 0;
  }

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
    if (!data) return;
    if (data === "[DONE]") {
      this.hasTerminal = true;
      return;
    }
    try {
      const json = JSON.parse(data);
      if (json.error) {
        this.hasError = true;
        const errObj =
          typeof json.error === "object" && json.error !== null
            ? json.error
            : { message: String(json.error) };
        if (typeof errObj.message === "string" && errObj.message.trim()) {
          this.errorMessage = errObj.message.trim();
        }
        const code =
          typeof errObj.code === "string"
            ? errObj.code
            : typeof errObj.type === "string"
              ? errObj.type
              : undefined;
        if (code) this.errorCode = code;
        if (
          errObj.status === 429 ||
          errObj.code === 429 ||
          code === "capacity_saturated" ||
          code === "rate_limit_exceeded" ||
          /saturated|rate.?limit|too many requests/i.test(
            this.errorMessage ?? "",
          )
        ) {
          this.errorStatus = 429;
        } else if (
          errObj.status === 504 ||
          code === "upstream_ttft_timeout" ||
          /timed? out/i.test(this.errorMessage ?? "")
        ) {
          this.errorStatus = 504;
        } else if (
          typeof errObj.status === "number" &&
          errObj.status >= 400 &&
          errObj.status < 600
        ) {
          this.errorStatus = errObj.status;
        }
      }
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
        if (choice.finish_reason != null) this.hasTerminal = true;
        const delta = choice.delta ?? {};
        const text =
          (typeof delta.content === "string" ? delta.content : "") +
          (typeof delta.reasoning_content === "string"
            ? delta.reasoning_content
            : typeof delta.reasoning === "string"
              ? delta.reasoning
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
