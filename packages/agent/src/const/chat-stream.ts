/** Raised when a model enters a degenerate repeating reasoning loop or hits an explicit caller reasoning cap. */
export class ReasoningOnlyTimeoutError extends Error {
  readonly isReasoningOnlyTimeout = true;
  constructor(message = "Model reasoning entered a repetitive loop without producing output or tool calls.") {
    super(message);
    this.name = "ReasoningOnlyTimeoutError";
  }
}

/**
 * Detect genuine runaway repetition in private reasoning (inspired by oh-my-pi's `thinking-loop.ts`).
 * Healthy deep thinking on large prompts is never cut off by wall-clock time; only byte-identical
 * repeating tail cycles (e.g. a model stuck repeating the same phrase/paragraph over and over) trip this guard.
 */
function hasDegenerateThinkingCycle(tail: string): boolean {
  const len = tail.length;
  if (len < 180) return false;
  const maxUnit = Math.min(1024, Math.floor(len / 3));
  for (let unit = 12; unit <= maxUnit; unit++) {
    const pattern = tail.slice(len - unit);
    let repeats = 1;
    let pos = len - unit * 2;
    while (pos >= 0 && tail.slice(pos, pos + unit) === pattern) {
      repeats++;
      pos -= unit;
    }
    const repeatedChars = repeats * unit;
    const spansLineBreak = pattern.includes("\n");
    if (!spansLineBreak && unit <= 60 && repeats >= 4 && repeatedChars >= 180) {
      return true;
    }
    if (repeats >= 3 && repeatedChars >= 1024) {
      return true;
    }
  }
  return false;
}

/** Consume OpenAI-compatible SSE without treating a dropped connection as success. */
export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: any) => void,
  signal: AbortSignal,
  idleMs = 60_000,
  totalMs = 900_000,
  firstTokenMs = Math.min(totalMs, Math.max(idleMs * 2, 120_000)),
  reasoningOnlyMs = 0,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  let doneMarker = false;
  let hasSemanticChunk = false;
  let hasVisibleOutput = false;
  let firstTokenExpired = false;
  let semanticStalled = false;
  let reasoningOnlyExpired = false;
  let thinkingTail = "";
  let thinkingCharsSinceScan = 0;
  const deadline = new AbortController();
  const totalTimer = setTimeout(() => deadline.abort(), totalMs);
  let firstTokenTimer: ReturnType<typeof setTimeout> | undefined =
    firstTokenMs < totalMs
      ? setTimeout(() => {
          if (!hasSemanticChunk) {
            firstTokenExpired = true;
            deadline.abort();
          }
        }, firstTokenMs)
      : undefined;
  let reasoningOnlyTimer: ReturnType<typeof setTimeout> | undefined =
    reasoningOnlyMs > 0 && reasoningOnlyMs < totalMs
      ? setTimeout(() => {
          if (hasSemanticChunk && !hasVisibleOutput) {
            reasoningOnlyExpired = true;
            deadline.abort();
          }
        }, reasoningOnlyMs)
      : undefined;
  const semanticIdleMs = Math.max(idleMs * 3, 180_000);
  let semanticTimer: ReturnType<typeof setTimeout> | undefined;
  const resetSemanticTimer = () => {
    if (semanticTimer) clearTimeout(semanticTimer);
    if (semanticIdleMs < totalMs) {
      semanticTimer = setTimeout(() => {
        semanticStalled = true;
        deadline.abort();
      }, semanticIdleMs);
    }
  };
  const markVisibleOutput = () => {
    if (hasVisibleOutput) return;
    hasVisibleOutput = true;
    thinkingTail = "";
    if (reasoningOnlyTimer) {
      clearTimeout(reasoningOnlyTimer);
      reasoningOnlyTimer = undefined;
    }
  };
  const markSemanticProgress = () => {
    if (!hasSemanticChunk) {
      hasSemanticChunk = true;
      if (firstTokenTimer) {
        clearTimeout(firstTokenTimer);
        firstTokenTimer = undefined;
      }
    }
    resetSemanticTimer();
  };
  const streamSignal = AbortSignal.any([signal, deadline.signal]);
  const line = (raw: string) => {
    const value = raw.trim();
    if (!value.startsWith("data:")) return;
    const data = value.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") {
      markVisibleOutput();
      markSemanticProgress();
      terminal = true;
      doneMarker = true;
      return;
    }
    let chunk: any;
    try { chunk = JSON.parse(data); }
    catch { throw new Error("The model returned invalid stream data."); }
    if (chunk.error) {
      const codePrefix = chunk.error.code ? `[${chunk.error.code}] ` : "";
      throw new Error(`Model stream error: ${codePrefix}${chunk.error.message || "Upstream request failed"}`);
    }
    const choice = chunk.choices?.[0];
    const delta = choice?.delta || choice?.message;
    const hasFinish = Boolean(chunk.choices?.some((c: any) => c.finish_reason != null));
    const hasActionableDelta = Boolean(
      delta &&
        (delta.content ||
          (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0)),
    );
    const reasoningText =
      delta &&
      (delta.reasoning_content ||
        delta.reasoning ||
        delta.thought ||
        (typeof delta.thinking === "string" ? delta.thinking : ""));
    const hasReasoningDelta = Boolean(reasoningText);
    if (hasFinish || hasActionableDelta) {
      markVisibleOutput();
    } else if (hasReasoningDelta && !hasVisibleOutput) {
      thinkingTail = (thinkingTail + reasoningText).slice(-4096);
      thinkingCharsSinceScan += reasoningText.length;
      if (thinkingCharsSinceScan >= 128) {
        thinkingCharsSinceScan = 0;
        if (hasDegenerateThinkingCycle(thinkingTail)) {
          throw new ReasoningOnlyTimeoutError("Thinking loop detected: model repeated identical reasoning cycles without producing output.");
        }
      }
    }
    if (chunk.usage || hasFinish || hasActionableDelta || hasReasoningDelta) {
      markSemanticProgress();
    }
    if (hasFinish) terminal = true;
    onChunk(chunk);
  };
  try {
    while (true) {
      // Heartbeats keep a healthy connection alive without extending the total or first-token deadlines.
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      try {
        const next = await Promise.race([
          reader.read(),
          new Promise<never>((_resolve, reject) => {
            abort = () => reject(signal.aborted
              ? new DOMException("The operation was aborted.", "AbortError")
              : reasoningOnlyExpired
                ? new ReasoningOnlyTimeoutError()
                : firstTokenExpired
                  ? new Error("Model stream timed out waiting for first token. Please retry.")
                  : semanticStalled
                    ? new Error("Model stream stalled without token progress. Please retry.")
                    : new Error("Model generation timed out before completion. Retry or select another model."));
            if (streamSignal.aborted) { abort(); return; }
            streamSignal.addEventListener("abort", abort, { once: true });
            timer = setTimeout(() => reject(new Error("Model stream stalled. Please retry.")), idleMs);
          }),
        ]);
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        let index: number;
        while ((index = buffer.indexOf("\n")) >= 0) {
          line(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
          if (doneMarker) return;
        }
      } finally {
        if (timer) clearTimeout(timer);
        if (abort) streamSignal.removeEventListener("abort", abort);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) line(buffer);
    if (!terminal) throw new Error("Model stream ended before a completion event. No unfinished tool calls were executed.");
  } finally {
    clearTimeout(totalTimer);
    if (firstTokenTimer) clearTimeout(firstTokenTimer);
    if (reasoningOnlyTimer) clearTimeout(reasoningOnlyTimer);
    if (semanticTimer) clearTimeout(semanticTimer);
    // A timed out read must close the upstream body as well as its local timer.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
