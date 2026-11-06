import type { TraceStep, FileMutationRecord } from "../vite-env";
export { latestTodoState, parseTodoItems } from "../../../../../packages/agent/src/const/todo-state";

const FILE_TOOLS = new Set(["write", "writefile", "writetofile", "edit", "editfile", "replaceinfile", "replacefilecontent", "applypatch", "patch", "mkdir", "makedir", "createdirectory"]);

/** Correlate to the emitting call. Legacy events attach only to the latest file tool. */
export function attachFileMutation(steps: TraceStep[], record: FileMutationRecord, toolCallId?: string): TraceStep[] {
  for (let index = steps.length - 1; index >= 0; index--) {
    const step = steps[index]!;
    if (step.type !== "tool" || step.mutation || !FILE_TOOLS.has((step.name || "").toLowerCase().replace(/[-_]/g, ""))) continue;
    if (toolCallId && (step.toolCallId || step.id) !== toolCallId) continue;
    return steps.map((entry, i) => i === index ? { ...entry, mutation: record } : entry);
  }
  return steps;
}
