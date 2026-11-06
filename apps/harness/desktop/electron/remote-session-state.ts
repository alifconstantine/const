import { archiveAssistantCommentary } from "../src/lib/assistant-transcript";
import { attachFileMutation, latestTodoState, parseTodoItems } from "../src/lib/activity-state";

/** Host-owned renderable history for joining a run between renderer checkpoints. */
export interface RemoteSessionState {
  revision: number;
  messages: any[];
  text: string;
  thinking: string;
  status: string;
  tools: string[];
  approval?: any;
  questions?: any;
  todos?: any[];
  context?: any;
  usage?: any;
}

function assistant(id: string) {
  return { id, role: "assistant", content: "", thinking: "", traceSteps: [], toolCalls: [], mutations: [], timestamp: Date.now() };
}

export function createRemoteSessionState(history: any[], runId: string): RemoteSessionState {
  const messages = history.filter(message => message.role !== "system");
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && !last.content && !last.thinking && !last.toolCalls?.length) messages.pop();
  messages.push(assistant(last?.role === "assistant" && !last.content ? last.id || `${runId}_live` : `${runId}_live`));
  const todos = latestTodoState(history);
  if (todos) Object.assign(messages[messages.length - 1], { todos });
  return { revision: 0, messages, text: "", thinking: "", status: "running", tools: [], todos };
}

export function updateRemoteSessionState(live: RemoteSessionState, event: any): void {
  live.revision++;
  const now = Date.now();
  let last = live.messages[live.messages.length - 1];
  if (event.type === "steer_message" && event.message) {
    live.messages.push({ ...event.message, id: event.message.id || `steer_${now}_${live.revision}`, role: "user", timestamp: event.message.timestamp || now });
    last = assistant(`live_${now}_${live.revision}`);
    live.messages.push(last);
  }
  if (last?.role !== "assistant") return;
  if (event.type === "commentary" || event.type === "tool_call" || event.type === "ask_question") {
    Object.assign(last, archiveAssistantCommentary(last, event.type === "commentary" ? event.content : last.content, now));
  }
  const steps = last.traceSteps;
  const finishThought = () => {
    const step = steps[steps.length - 1];
    if (step?.type === "thought" && !step.durationMs) step.durationMs = Math.max(1000, now - step.startTime);
  };
  if (event.type === "token") { finishThought(); last.content += event.token || ""; }
  if (event.type === "token_reset") last.content = "";
  if (event.type === "thinking") {
    last.thinking += event.thinking || "";
    const step = steps[steps.length - 1];
    if (step?.type === "thought") step.content += event.thinking || "";
    else steps.push({ id: `thought_${now}_${live.revision}`, type: "thought", content: event.thinking || "", startTime: now });
  }
  if (event.type === "tool_call" || event.type === "ask_question") {
    finishThought();
    const id = event.toolCallId || event.id || `tool_${now}_${live.revision}`;
    const name = event.type === "ask_question" ? "ask_question" : event.toolName || event.name || "tool";
    const args = event.type === "ask_question" ? { questions: event.questions } : event.args;
    if (!last.toolCalls.some((tool: any) => tool.id === id)) {
      last.toolCalls.push({ id, name, args });
      steps.push({ id, toolCallId: id, type: "tool", name, args, startTime: now });
    }
    live.tools = [...live.tools.slice(-19), name];
  }
  if (event.type === "tool_result") {
    for (const tool of [...last.toolCalls, ...steps]) {
      if (tool.id === event.toolCallId || tool.toolCallId === event.toolCallId) {
        Object.assign(tool, { result: event.result, isError: event.isError, durationMs: event.durationMs });
      }
    }
    if (event.toolName === "ask_question") delete live.questions;
  }
  if (event.type === "file_mutation" && event.record) {
    last.mutations.push(event.record);
    last.traceSteps = attachFileMutation(steps, event.record, event.toolCallId);
  }
  if (event.type === "todo_update") {
    const todos = parseTodoItems(event.todos);
    if (todos) { live.todos = todos; last.todos = todos; }
  }
  if (event.type === "status") live.status = event.status || "running";
  if (event.type === "approval_request") live.approval = event;
  if (event.type === "approval_resolved") delete live.approval;
  if (event.type === "ask_question") live.questions = event;
  if (event.type === "question_resolved") delete live.questions;
  if (event.type === "context_update") live.context = event;
  if (event.type === "error") {
    finishThought();
    Object.assign(last, archiveAssistantCommentary(last, last.content, now));
    last.content = event.error || "";
    live.status = "error";
  }
  if (event.type === "done") {
    finishThought();
    last.content = event.fullContent || last.content;
    last.durationMs = Math.max(0, now - last.timestamp);
    live.status = "done";
  }
  live.text = last.content;
  live.thinking = last.thinking;
}
