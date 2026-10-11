import type { FileMutationRecord } from "../../vite-env";

export type RightPaneTabType =
  | "side_conversation"
  | "review"
  | "file_diff"
  | "file_preview"
  | "terminal"
  | "browser"
  | "task_output"
  | "subagent";

export interface RightPaneTab {
  id: string;
  type: RightPaneTabType;
  title: string;
  filePath?: string;
  previousContent?: string | null;
  newContent?: string | null;
  mutation?: FileMutationRecord;
  previewMode?: "formatted" | "raw";
  cwd?: string;
  project?: string;
  conversationId?: string;
  terminalSessionId?: string;
  taskId?: string;
  command?: string;
  createdAt?: number;
  url?: string;
  favicon?: string;
  isAudible?: boolean;
  isMuted?: boolean;
  subAgentId?: string;
  subAgent?: any;
  parentConversationId?: string;
  sideChatId?: string;
  model?: string;
  thinkingLevel?: string;
}

export interface BrowserSelectedElement {
  tag: string;
  id?: string;
  className?: string;
  selector: string;
  rect: { width: number; height: number };
  color?: string;
  font?: string;
  textSnippet?: string;
  htmlSnippet?: string;
  url: string;
}
