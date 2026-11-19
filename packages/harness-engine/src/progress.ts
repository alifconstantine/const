import {
  PROGRESS_REVIEW_GUIDANCE,
  REPEATED_FAILURE_GUIDANCE,
  REPEATED_RESULT_GUIDANCE,
  RunProgress,
  type AgentEvent,
} from "@const/agent/const";
import type { AgentTurnContext } from "@earendil-works/pi-agent-core";
import type { TranscriptContext } from "@earendil-works/pi-ai";

export interface HarnessStopReason {
  category: "stalled" | "turn_limit";
  message: string;
}

export class HarnessProgress {
  private progress = new RunProgress();
  private turn = 0;
  stopReason?: HarnessStopReason;

  constructor(private readonly onEvent: (event: AgentEvent) => void) {}

  resetRun() {
    this.progress = new RunProgress();
    this.turn = 0;
    this.stopReason = undefined;
  }

  resetCycle() {
    this.progress.reset();
  }

  prepareTranscript(context: TranscriptContext): TranscriptContext {
    const repeatedFailure = this.progress.hasRepeatedVerificationFailure();
    const checkpoint = this.progress.checkpoint(++this.turn);
    if (!checkpoint) return context;
    // An individual repeated read is only a hint. Redirect on a confirmed cycle or repeated verification failure.
    if (checkpoint.kind === "repeated_result" && !repeatedFailure && !this.progress.repeatedCycle()) return context;
    this.onEvent({ type: "progress_checkpoint", ...checkpoint });
    const content = checkpoint.kind === "review"
      ? PROGRESS_REVIEW_GUIDANCE
      : repeatedFailure
        ? REPEATED_FAILURE_GUIDANCE
        : REPEATED_RESULT_GUIDANCE;
    return {
      ...context,
      messages: [...context.messages, { role: "system", content, timestamp: Date.now() }],
    };
  }

  record({ message, toolResults }: AgentTurnContext) {
    const results = new Map(toolResults.map((result) => [result.toolCallId, result]));
    let stalled = false;
    for (const call of message.content) {
      if (call.type !== "toolCall") continue;
      const result = results.get(call.id);
      if (!result) continue;
      const [first] = result.content;
      const observation = result.content.length === 1 && first?.type === "text" ? first.text : result.content;
      stalled = this.progress.record(call.name, call.arguments, observation, result.isError) || stalled;
    }
    if (stalled) {
      this.stopReason = {
        category: "stalled",
        message: "The agent stopped after repeating a tool cycle without progress.",
      };
    }
  }

  applyTurnLimit(maxTurns: number) {
    if (this.turn >= maxTurns) {
      this.stopReason = { category: "turn_limit", message: `Reached the configured limit of ${maxTurns} model turns.` };
    }
  }
}
