import type { FileMutationRecord } from "@const/agent";

export type RightPaneTabType = "review" | "file_diff" | "file_preview" | "browser" | "note_preview";

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
  createdAt?: number;
  url?: string;
  favicon?: string;
  artifactId?: string;
  artifact?: any;
}
