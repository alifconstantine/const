/** Consume OpenAI-compatible SSE without treating a dropped connection as success. */
export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: any) => void,
  signal: AbortSignal,
  idleMs = 35_000,
  totalMs = 600_000,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  let doneMarker = false;
  const deadline = new AbortController();
  const totalTimer = setTimeout(() => deadline.abort(), totalMs);
  const streamSignal = AbortSignal.any([signal, deadline.signal]);
  const line = (raw: string) => {
    const value = raw.trim();
    if (!value.startsWith("data:")) return;
    const data = value.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") { terminal = true; doneMarker = true; return; }
    let chunk: any;
    try { chunk = JSON.parse(data); }
    catch { throw new Error("The model returned invalid stream data."); }
    if (chunk.error) throw new Error(`Model stream error: ${chunk.error.message || "Upstream request failed"}`);
    if (chunk.choices?.some((choice: any) => choice.finish_reason != null)) terminal = true;
    onChunk(chunk);
  };
  try {
    while (true) {
      // Heartbeats keep a healthy connection alive without extending the total deadline.
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      try {
        const next = await Promise.race([
          reader.read(),
          new Promise<never>((_resolve, reject) => {
            abort = () => reject(signal.aborted
              ? new DOMException("The operation was aborted.", "AbortError")
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
