import type { FileMutationRecord } from "@const/agent";
import type { LocalArtifact } from "../../lib/db";

export type RightPaneTabType =
  | "review"
  | "file_diff"
  | "file_preview"
  | "browser"
  | "note_preview"
  | "studio_preview"
  | "mind_map";

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
  artifact?: LocalArtifact;
  mindMapData?: any;
  isAudible?: boolean;
  isMuted?: boolean;
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
