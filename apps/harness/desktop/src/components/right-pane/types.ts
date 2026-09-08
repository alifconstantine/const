export type RightPaneTabType =
  | "side_conversation"
  | "review"
  | "terminal"
  | "browser";

export interface RightPaneTab {
  id: string;
  type: RightPaneTabType;
  title: string;
  cwd?: string;
  project?: string;
  conversationId?: string;
  terminalSessionId?: string;
  createdAt?: number;
}
