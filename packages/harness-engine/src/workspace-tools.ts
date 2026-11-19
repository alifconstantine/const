import {
  CONST_DEFAULT_TOOLS,
  executeNativeTool,
  type AgentConfig,
  type TodoItem,
  type ToolAuthorization,
} from "@const/agent/const";
import type { AgentOptions, AgentTool } from "@earendil-works/pi-agent-core";
import type { HarnessSession } from "./session.js";

const WORKSPACE_TOOL_NAMES = ["read", "write", "edit", "find", "grep", "ls", "bash", "todo_write", "ask_question"];
const JOB_TOOL_NAMES = ["wait", "manage_task"];
const definitions = CONST_DEFAULT_TOOLS.filter(({ function: tool }) =>
  WORKSPACE_TOOL_NAMES.includes(tool.name) || JOB_TOOL_NAMES.includes(tool.name),
);

export function createWorkspaceTools(
  config: AgentConfig & { workspacePath: string; conversationId: string },
  authorization: ToolAuthorization,
  session: HarnessSession,
) {
  // Pi passes the same validated argument object to the hook and the executor.
  const permissions = new WeakMap<Record<string, unknown>, boolean>();
  const denied = new WeakSet<object>();
  const beforeToolCall: NonNullable<AgentOptions["beforeToolCall"]> = async ({
    assistantMessage, toolCall, args: validatedArgs,
  }, signal = new AbortController().signal) => {
    if (denied.has(assistantMessage)) {
      return { block: true, reason: "An earlier action in this turn was rejected. Replan using the user's feedback." };
    }
    const definition = definitions.find(({ function: tool }) => tool.name === toolCall.name);
    if (!definition) return;
    const args = validatedArgs as Record<string, unknown>;
    const call = {
      id: toolCall.id,
      type: "function" as const,
      function: { name: toolCall.name, arguments: JSON.stringify(args) },
    };
    const { allowOutsideWorkspace, rejection } = await authorization.authorize(
      call, args, config.workspacePath, definition, signal, (event) => session.emit(event),
    );
    if (rejection) {
      if (rejection.decision === "deny") denied.add(assistantMessage);
      return { block: true, reason: rejection.text };
    }
    signal.throwIfAborted();
    permissions.set(args, allowOutsideWorkspace);
  };

  const tools: AgentTool<Record<string, unknown>>[] = definitions.map((definition) => {
    const { name, description, parameters } = definition.function;
    return {
      name,
      label: name,
      description,
      parameters,
      async execute(toolCallId, rawArgs, signal = new AbortController().signal) {
        const args = rawArgs as Record<string, unknown>;
        const allowOutsideWorkspace = permissions.get(args);
        permissions.delete(args);
        signal.throwIfAborted();
        if (allowOutsideWorkspace === undefined) throw new Error("Workspace tool execution requires authorization.");
        let todos: TodoItem[] | undefined;
        const { result, images, isError } = await executeNativeTool(name, args, config.workspacePath, {
          signal,
          allowOutsideWorkspace,
          stepIndex: session.currentTurn,
          conversationId: config.conversationId,
          onFileMutation: (record) => session.emit({ type: "file_mutation", record, toolCallId }),
          onTodoUpdate: (items) => { todos = session.updateTodos(toolCallId, items); },
          askUser: (questions) => session.askQuestion(toolCallId, questions, signal),
          onTaskStarted: (task) => session.emit({
            type: "task_started",
            task: { ...task, output: task.output?.slice(-20) },
          }),
        });
        return {
          content: [
            { type: "text", text: typeof result === "string" ? result : JSON.stringify(result) ?? "" },
            ...(images ?? []).map(({ data, mimeType }) => ({ type: "image" as const, data, mimeType })),
          ],
          details: todos === undefined ? result : { todos },
          isError,
        };
      },
    };
  });
  const baseTools = tools.filter(({ name }) => !JOB_TOOL_NAMES.includes(name));
  return { baseTools, toolsWithJobs: tools, beforeToolCall };
}
