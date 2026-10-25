export interface AgentFailure {
  error?: string;
  aborted?: boolean;
  errorReported?: boolean;
}

export function shouldNotifyAgentFailure(result: AgentFailure): boolean {
  return Boolean(
    result.error &&
    !result.aborted &&
    !result.errorReported &&
    !/cancelled|abort/i.test(result.error),
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
