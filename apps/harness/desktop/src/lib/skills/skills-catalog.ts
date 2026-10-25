import type { SkillCategory } from "./types";

export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: SkillCategory;
  author: string;
  version: string;
  icon?: string;
  overview?: string;
  files?: string[];
  installs?: number;
  source?: string;
}

export const MARKETPLACE_CATALOG: MarketplaceSkill[] = [
  {
    id: "skill_usetinyfish",
    slug: "usetinyfish",
    name: "usetinyfish",
    description: "Live web search, clean ad-free webpage extraction (markdown without navigation, cookies, or clutter), and multi-step browser agent automation via TinyFish (tinyfish.ai).",
    category: "browser_automation",
    author: "TinyFish",
    version: "1.0.0",
    icon: "Globe",
    files: ["SKILL.md"],
  },
];
