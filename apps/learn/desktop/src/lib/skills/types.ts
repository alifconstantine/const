export type SkillCategory =
  | "writing"
  | "math_science"
  | "video"
  | "presentation"
  | "document"
  | "design"
  | "education"
  | "custom";

export interface SkillFileEntry {
  path: string;
  name: string;
  content: string;
  isMain?: boolean;
}

export interface LocalSkill {
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
