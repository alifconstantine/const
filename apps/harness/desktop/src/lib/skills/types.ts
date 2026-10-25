export type SkillCategory =
  | "agent_workflow"
  | "browser_automation"
  | "motion_video"
  | "scraping_research"
  | "brand_meta"
  | "coding_dev"
  | "finance"
  | "writing"
  | "document"
  | "design"
  | "math_science"
  | "video"
  | "presentation"
  | "education"
  | "custom";

export interface SkillFileEntry {
  path: string;
  name: string;
  content: string;
  isMain?: boolean;
}

export interface LocalSkill {
  sourceId?: string;
  source?: string;
  sourceSkillId?: string;
  id: string;
  slug: string;
  name: string;
  description: string;
  content: string;
  icon?: string;
  category: SkillCategory;
  isBuiltIn: boolean;
  isEnabled: boolean;
  scope?: "user" | "workspace";
  path?: string;
  workspacePath?: string;
  pluginId?: string;
  pluginName?: string;
  author?: string;
  version?: string;
  updatedAtText?: string;
  bundleId?: string;
  bundleName?: string;
  overview?: string;
  files?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface SkillInstallProgress {
  requestId: string;
  phase: "resolving" | "downloading" | "validating" | "complete";
  completed: number;
  total: number;
  file?: string;
}

export interface LocalSkillBundle {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  updatedAtText?: string;
  icon?: string;
  category: SkillCategory;
  isBuiltIn: boolean;
  isEnabled: boolean;
  scope?: "user" | "workspace";
  overview?: string;
  files?: Record<string, string>;
  skillIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SkillFrontmatter {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  category?: SkillCategory;
  author?: string;
  version?: string;
  bundleId?: string;
  bundleName?: string;
  [key: string]: unknown;
}
