export interface LiveState {
  revision: number;
  text: string;
  tools: string[];
  status: string;
  approval?: any;
  questions?: any;
  context?: any;
  usage?: any;
}
export const emptyLive = (): LiveState => ({
  revision: 0,
  text: "",
  tools: [],
  status: "idle",
});
/** A snapshot and replay may overlap. Only newer sequenced events may change it. */
export function reduceLive(
  previous: LiveState,
  event: any,
  sequence?: number,
): LiveState {
  if (sequence !== undefined && sequence <= previous.revision) return previous;
  const next = { ...previous, revision: sequence ?? previous.revision };
  if (event.type === "token")
    next.text = (next.text + String(event.token || "")).slice(-80_000);
  if (event.type === "token_reset") next.text = "";
  if (event.type === "status") next.status = event.status;
  if (event.type === "tool_call")
    next.tools = [
      ...next.tools.slice(-19),
      String(
        event.toolName || event.name || event.toolCall?.function?.name || "",
      ),
    ];
  if (event.type === "approval_request") next.approval = event;
  if (event.type === "approval_resolved") delete next.approval;
  if (event.type === "ask_question") next.questions = event;
  if (event.type === "question_resolved") delete next.questions;
  if (event.type === "context_update") next.context = event;
  if (event.type === "usage") next.usage = event;
  return next;
}
