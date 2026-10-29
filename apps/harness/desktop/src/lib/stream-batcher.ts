type StreamEvent = { type: string; [key: string]: any };

/** Coalesce only adjacent deltas; reset, tool, error and completion events are barriers. */
export function createStreamBatcher(emit: (event: StreamEvent) => void, intervalMs = 16) {
  let pending: StreamEvent | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    const event = pending;
    pending = undefined;
    if (event) emit(event);
  };
  return {
    flush,
    forward(event: StreamEvent) {
      const field = event.type === "token" ? "token" : event.type === "thinking" ? "thinking" : undefined;
      if (!field) { flush(); emit(event); return; }
      if (pending && (pending.type !== event.type || pending.conversationId !== event.conversationId || pending.runId !== event.runId)) flush();
      pending = pending ? { ...event, [field]: String(pending[field] ?? "") + String(event[field] ?? "") } : { ...event };
      if (!timer) timer = setTimeout(flush, intervalMs);
    },
  };
}
