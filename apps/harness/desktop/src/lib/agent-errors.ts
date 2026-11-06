export interface AgentFailure {
  error?: string;
  aborted?: boolean;
  errorReported?: boolean;
  category?: string;
  errorCategory?: string;
  outcome?: string;
}

export function isAgentCancellation(result: AgentFailure): boolean {
  if (result.aborted || result.outcome === "cancelled") return true;
  const category = result.category ?? result.errorCategory;
  if (category !== undefined) return category === "cancelled";
  return /cancelled|abort/i.test(result.error ?? "");
}

export function shouldNotifyAgentFailure(result: AgentFailure): boolean {
  return Boolean(
    result.error &&
    !isAgentCancellation(result) &&
    !result.errorReported,
  );
}

/** One execution can report its failure through both stream and IPC result. */
export function createAgentEventForwarder(
  emit: (event: { type: string; [key: string]: unknown }) => boolean,
) {
  let errorReported = false;
  return {
    get errorReported() {
      return errorReported;
    },
    forward(event: { type: string; [key: string]: unknown }) {
      if (event.type === "error" && errorReported) return;
      const delivered = emit(event);
      if (event.type === "error" && delivered) errorReported = true;
    },
  };
}
