import {
  TodoTracker,
  type AgentEvent as WorkspaceEvent,
  type ApprovalRequestData,
  type QuestionItem,
  type TodoItem,
} from "@const/agent/const";
import { randomUUID } from "node:crypto";
import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, JsonValue } from "@earendil-works/pi-ai";
import type { HarnessStopReason } from "./progress.js";

export type HarnessPhase = "idle" | "thinking" | "running_tool" | "waiting_approval" | "waiting_question" | "waiting_job";
export type HarnessRunEnd = Extract<WorkspaceEvent, { type: "run_end" }>;
export type HarnessEngineEvent = WorkspaceEvent
  | { type: "run_phase"; runId: string; phase: HarnessPhase }
  | { type: "question_resolved"; runId: string; toolCallId: string; requestId: string; outcome: "answered" | "cancelled" };

export interface HarnessPendingQuestion {
  requestId: string;
  toolCallId: string;
  questions: QuestionItem[];
}

/** Tracks host state that can be read while a run is waiting for input or a job. */
export class HarnessSession {
  private readonly todos = new TodoTracker();
  private runId?: string;
  private phase: HarnessPhase = "idle";
  private turn = 0;
  private lastRun?: HarnessRunEnd;
  private approval?: ApprovalRequestData;
  private question?: { request: HarnessPendingQuestion; answer: (value: JsonValue) => void };

  constructor(
    history: readonly AgentMessage[],
    private readonly onEvent: (event: HarnessEngineEvent) => void,
  ) {
    for (let index = history.length - 1; index >= 0; index--) {
      const message = history[index];
      if (!message || message.role !== "toolResult" || message.toolName !== "todo_write" || message.isError) continue;
      const details = message.details;
      if (details && typeof details === "object" && "todos" in details && this.todos.commit(details.todos)) break;
    }
  }

  snapshot() {
    return {
      runId: this.runId,
      phase: this.phase,
      turn: this.turn,
      todos: this.todos.snapshot(),
      pendingApproval: this.approval && structuredClone(this.approval),
      pendingQuestion: this.question && structuredClone(this.question.request),
      lastRun: this.lastRun && { ...this.lastRun },
    };
  }

  get currentTurn() { return this.turn; }

  emit(event: WorkspaceEvent) {
    if (event.type === "approval_request") this.approval = structuredClone(event);
    if (event.type === "approval_resolved") {
      this.approval = undefined;
      this.setPhase("running_tool");
    }
    if (event.type === "status" && event.status === "waiting_approval") this.setPhase("waiting_approval");
    this.onEvent(this.runId ? { ...event, runId: this.runId } : event);
  }

  updateTodos(toolCallId: string, items: TodoItem[]) {
    const todos = this.todos.commit(items);
    if (todos) this.emit({ type: "todo_update", toolCallId, todos: structuredClone(todos) });
    return todos;
  }

  answerQuestion(requestId: string, answer: JsonValue): boolean {
    if (this.question?.request.requestId !== requestId) return false;
    this.question.answer(answer);
    return true;
  }

  async askQuestion(toolCallId: string, questions: QuestionItem[], signal: AbortSignal): Promise<JsonValue> {
    signal.throwIfAborted();
    if (!this.runId || this.question) throw new Error("A question requires an active run with no pending question.");
    const runId = this.runId;
    const request = { requestId: randomUUID(), toolCallId, questions: structuredClone(questions) };
    let outcome: "answered" | "cancelled" = "cancelled";
    try {
      const reply = await new Promise<JsonValue>((resolve, reject) => {
        const clear = () => {
          this.question = undefined;
          signal.removeEventListener("abort", abort);
        };
        const abort = () => {
          clear();
          reject(signal.reason);
        };
        this.question = { request, answer: (value) => { clear(); resolve(value); } };
        signal.addEventListener("abort", abort, { once: true });
        try {
          this.setPhase("waiting_question");
          if (this.question?.request === request) {
            this.emit({ type: "ask_question", ...request, questions });
          }
        } catch (error) {
          clear();
          reject(error);
        }
      });
      signal.throwIfAborted();
      outcome = "answered";
      return reply;
    } finally {
      this.onEvent({ type: "question_resolved", runId, toolCallId, requestId: request.requestId, outcome });
      if (!signal.aborted) this.setPhase("running_tool");
    }
  }

  handle(event: AgentEvent, signal: AbortSignal, stop?: HarnessStopReason) {
    switch (event.type) {
      case "agent_start":
        this.runId = randomUUID();
        this.turn = 0;
        break;
      case "turn_start":
        this.turn++;
        this.setPhase("thinking");
        break;
      case "tool_execution_start":
        this.setPhase(event.toolName === "wait" ? "waiting_job" : "running_tool");
        break;
      case "agent_end": {
        if (!this.runId) return;
        const runId = this.runId;
        let reply: AssistantMessage | undefined;
        for (let index = event.messages.length - 1; index >= 0; index--) {
          const message = event.messages[index];
          if (message?.role === "assistant") {
            reply = message;
            break;
          }
        }
        const cancelled = signal.aborted || reply?.stopReason === "aborted";
        const failure = reply?.stopReason === "error" || reply?.stopReason === "length";
        const end: HarnessRunEnd = cancelled
          ? { type: "run_end", runId, outcome: "cancelled", errorCategory: "cancelled" }
          : stop
            ? { type: "run_end", runId, outcome: "failed", errorCategory: stop.category, error: stop.message }
            : failure
              ? { type: "run_end", runId, outcome: "failed", errorCategory: "model", error: reply?.errorMessage ?? "Model output reached its limit." }
              : { type: "run_end", runId, outcome: "completed" };
        this.lastRun = end;
        this.approval = undefined;
        this.phase = "idle";
        this.runId = undefined;
        this.onEvent({ ...end });
        break;
      }
    }
  }

  private setPhase(phase: HarnessPhase) {
    if (!this.runId || phase === this.phase) return;
    this.phase = phase;
    this.onEvent({ type: "run_phase", runId: this.runId, phase });
  }
}
