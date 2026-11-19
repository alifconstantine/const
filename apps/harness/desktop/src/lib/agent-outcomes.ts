import type { AgentErrorCategory, AgentOutcome } from "@const/agent";

export interface AgentSessionEnded {
  conversationId: string;
  runId?: string;
  outcome?: AgentOutcome;
  errorCategory?: AgentErrorCategory;
  error?: string;
  recovery?: "payload" | "context";
}

export function agentFailureText(failure: { error?: string; category?: string; errorCategory?: string }, t: (key: string) => string): string {
  const category = failure.category ?? failure.errorCategory;
  if (category === "payload") return t("toast.requestTooLarge");
  if (category === "image") return t("toast.imagePreparationFailed");
  if (category === "stalled") return t("toast.agentStalled");
  if (category === "turn_limit") return t("toast.agentTurnLimit");
  return failure.error || t("toast.agentExecutionError");
}

/** Unknown/legacy outcomes must never claim success. Cancellation stays quiet. */
export function sessionNotification(result: AgentSessionEnded, t: (key: string) => string) {
  if (result.outcome === "completed") return { title: t("toast.taskCompleted"), body: t("toast.taskCompletedBody"), playSound: true };
  if (result.outcome === "failed") {
    const category = result.errorCategory;
    const body = category === "payload" || category === "image" || category === "stalled" || category === "turn_limit"
      ? agentFailureText(result, t) : t("toast.taskFailedBody");
    return { title: t("toast.taskFailed"), body, playSound: false };
  }
  return undefined;
}
