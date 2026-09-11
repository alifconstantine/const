import type { FileMutationRecord } from "../../vite-env";

export type RightPaneTabType =
  | "side_conversation"
  | "review"
  | "file_diff"
  | "file_preview"
  | "terminal"
  | "browser"
  | "task_output";

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
}
