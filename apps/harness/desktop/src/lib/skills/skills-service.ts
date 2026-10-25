import { db } from "../db";
import type { LocalSkill, SkillFrontmatter, SkillCategory } from "./types";
import { DEFAULT_SKILLS } from "./default-skills";
import { MARKETPLACE_CATALOG, type MarketplaceSkill } from "./skills-catalog";

export { MARKETPLACE_CATALOG, type MarketplaceSkill };

/**
 * Read the workspace's effective skills from the native registry.
 */
export async function loadInstalledSkills(workspacePath?: string): Promise<LocalSkill[]> {
  if (!window.electron?.marketplace) return DEFAULT_SKILLS;
  const installed = await window.electron.marketplace.listInstalled(workspacePath);
  const records: LocalSkill[] = installed.map((item) => {
    const catalog = MARKETPLACE_CATALOG.find((skill) => skill.slug === item.slug);
    return {
      sourceId: item.sourceId, source: item.source, sourceSkillId: item.sourceSkillId,
      id: item.id, slug: item.slug, name: item.name, description: item.description,
      content: item.content, path: item.path, workspacePath: item.workspacePath,
      pluginId: item.pluginId, pluginName: item.pluginName,
      icon: catalog?.icon, category: catalog?.category ?? "custom", isBuiltIn: false,
      isEnabled: item.isEnabled, scope: item.scope, author: item.author ?? catalog?.author,
      version: item.version ?? "1.0.0", createdAt: 0, updatedAt: 0,
    };
  });
  return records;
}

/**
 * Fetch full skill content and files for any skill (installed or from catalog)
 */
export async function fetchSkillContent(
  slug: string,
  workspacePath?: string,
  skillId?: string
): Promise<{
  content: string;
  files: Record<string, string>;
  name?: string;
  description?: string;
  author?: string;
  version?: string;
} | null> {
  const cleanSlug = slug.toLowerCase().trim();

  // 1. Check local Dexie first
  const local = skillId ? await db.skills.get(skillId) : undefined;
  if (local && !local.path && (local.scope !== "workspace" || local.workspacePath === workspacePath) && local.files && Object.keys(local.files).length > 0) {
    return {
      content: local.content,
      files: local.files,
      name: local.name,
      description: local.description,
      author: local.author,
      version: local.version,
    };
  }

  // 2. Check Electron marketplace IPC
  if (window.electron?.marketplace?.getSkillContent) {
    try {
      const res = await window.electron.marketplace.getSkillContent(cleanSlug, workspacePath);
      if (res) {
        return {
          content: res.content,
          files: res.files,
          name: res.name,
          description: res.description,
          author: res.author,
          version: res.version,
        };
      }
    } catch (err) {
      console.warn(`[SkillsService] Error fetching skill content for ${cleanSlug}:`, err);
    }
  }

  // 3. Check pre-bundled default skills
  const def = DEFAULT_SKILLS.find((s) => s.slug === cleanSlug);
  if (def) {
    return {
      content: def.content,
      files: def.files || { "SKILL.md": def.content },
      name: def.name,
      description: def.description,
      author: def.author,
      version: def.version,
    };
  }

  return null;
}

/**
 * Install a catalog skill through the native registry.
 */
export async function installSkillFromMarketplace(
  slug: string,
  scope: "user" | "workspace" = "user",
  workspacePath?: string,
  source?: string,
  skillId?: string,
  requestId?: string
): Promise<LocalSkill> {
  if (!window.electron?.marketplace) {
    throw new Error("Marketplace electron bridge is unavailable");
  }

  const installed = await window.electron.marketplace.installSkill({
    slug,
    scope,
    workspacePath,
    source,
    skillId,
    requestId,
  });
  if (!installed) {
    throw new Error(`Failed to install skill '${slug}'`);
  }

  const catalogMatch = MARKETPLACE_CATALOG.find((c) => c.slug === slug);
  const category: SkillCategory = catalogMatch?.category || "custom";

  const localSkill: LocalSkill = {
    sourceId: installed.sourceId, source: installed.source, sourceSkillId: installed.sourceSkillId,
    id: installed.id,
    slug: installed.slug,
    name: installed.name,
    description: installed.description,
    content: installed.content,
    icon: catalogMatch?.icon || "PencilSparkles",
    category,
    isBuiltIn: false,
    isEnabled: installed.isEnabled,
    scope: installed.scope,
    path: installed.path,
    workspacePath: installed.workspacePath,
    pluginId: installed.pluginId,
    pluginName: installed.pluginName,
    author: installed.author || source?.split("/")[0] || catalogMatch?.author,
    version: installed.version || catalogMatch?.version || "1.0.0",
    overview: installed.content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim(),
    files: installed.files,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return localSkill;
}

/**
 * Uninstall a skill from filesystem and delete from Dexie DB
 */
export async function uninstallSkillFromMarketplace(
  skill: LocalSkill,
  workspacePath?: string
): Promise<boolean> {
  try {
    if (skill.path && window.electron?.marketplace) {
      const removed = await window.electron.marketplace.uninstallSkill({ id: skill.id, workspacePath });
      if (!removed) throw new Error("Skill could not be removed from disk.");
    }
    await db.skills.delete(skill.id);
    return true;
  } catch (err) {
    console.error("[SkillsService] Failed to uninstall skill:", err);
    return false;
  }
}

/**
 * Remove legacy filesystem snapshots from local storage
 */
export async function initializeSkillStorage(): Promise<void> {
  // Remove obsolete filesystem snapshots. Custom drafts remain in IndexedDB.
  const stale = await db.skills.filter((skill) => !!skill.path || skill.id === "skill_" + skill.slug).primaryKeys();
  await db.skills.bulkDelete(stale);
}

/**
 * Generate a clean structured AI overview for a skill based on its content
 */
export function generateSkillOverview(
  slug: string,
  content: string,
  description?: string
): string {
  const headings = Array.from(content.matchAll(/^##\s+(.+)$/gm)).map((m) => m[1]?.trim());
  const keyPoints = headings.filter(
    (h) =>
      h &&
      !h.toLowerCase().includes("usage") &&
      !h.toLowerCase().includes("license") &&
      !h.toLowerCase().includes("installation")
  );

  let overviewText = "";
  if (description && description.trim() && description !== ">" && description !== "|") {
    overviewText += `${description.trim()}\n\n`;
  }
  overviewText += `### Trigger & Activation\n`;
  overviewText += `- Command: \`/${slug}\`\n`;
  overviewText += `- Autonomous Trigger: Automatically selected when working on relevant tasks or requests matching this domain.\n\n`;

  if (keyPoints.length > 0) {
    overviewText += `### Key Capabilities\n`;
    keyPoints.slice(0, 5).forEach((kp) => {
      overviewText += `- **${kp}**: Comprehensive guidance and structured outputs.\n`;
    });
    overviewText += `\n`;
  }


  return overviewText.trim();
}

/**
 * Static security scan for uploaded skill markdown or bundle
 */
export function runSecurityScan(
  content: string,
  _fileName?: string
): { passed: boolean; message: string; details?: string[] } {
  const issues: string[] = [];

  const dangerousPatterns = [
    { regex: /curl\s+-[sS]*[kK]?\s+.*\|\s*(?:bash|sh|zsh)/i, reason: "Unauthorized pipe-to-shell download execution" },
    { regex: /rm\s+-rf\s+(?:\/|~|\$HOME|\*)/i, reason: "Destructive filesystem deletion command" },
    { regex: /eval\s*\(\s*(?:base64_decode|unescape|Buffer\.from)/i, reason: "Obfuscated payload execution via eval()" },
    { regex: /ignore\s+all\s+(?:previous|prior)\s+instructions/i, reason: "Adversarial system prompt override attempt" },
    { regex: /(?:cat\s+~?\/\.ssh|cat\s+~?\/\.aws|cat\s+~?\/\.env)/i, reason: "Attempt to exfiltrate secret credentials" },
  ];

  for (const { regex, reason } of dangerousPatterns) {
    if (regex.test(content)) {
      issues.push(reason);
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: "Security issues detected",
      details: issues,
    };
  }

  return {
    passed: true,
    message: "Clean: No malicious code or prompt injection detected",
  };
}

/**
 * Parse frontmatter and content from raw markdown string
 */
export function parseSkillMarkdown(rawMarkdown: string): {
  frontmatter: SkillFrontmatter;
  content: string;
  name: string;
  slug: string;
  description: string;
} {
  const trimmed = rawMarkdown.trim();
  let frontmatter: SkillFrontmatter = {};
  let bodyContent = trimmed;

  const fmMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (fmMatch) {
    const yamlBlock = fmMatch[1] || "";
    bodyContent = (fmMatch[2] || "").trim();

    const lines = yamlBlock.split(/\r?\n/);
    let currentKey: string | null = null;
    let multilineVal = "";

    for (const line of lines) {
      const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (kvMatch) {
        if (currentKey && multilineVal) {
          frontmatter[currentKey] = multilineVal.trim().replace(/^["']|["']$/g, "");
          multilineVal = "";
        }
        currentKey = kvMatch[1]!.toLowerCase();
        const rawVal = kvMatch[2]!.trim();
        if (rawVal === "|" || rawVal === ">") {
          multilineVal = "";
        } else {
          frontmatter[currentKey] = rawVal.replace(/^["']|["']$/g, "");
          currentKey = null;
        }
      } else if (currentKey) {
        multilineVal += (multilineVal ? "\n" : "") + line.trim();
      }
    }
    if (currentKey && multilineVal) {
      frontmatter[currentKey] = multilineVal.trim().replace(/^["']|["']$/g, "");
    }
  }

  let name = (frontmatter.name as string) || "";
  if (!name) {
    const headingMatch = bodyContent.match(/^#\s+(.+)$/m);
    if (headingMatch && headingMatch[1]) {
      name = headingMatch[1].trim();
    } else {
      name = "Untitled Skill";
    }
  }

  let slug = (frontmatter.slug as string) || "";
  if (!slug) {
    slug = name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  let description = (frontmatter.description as string) || "";
  if (!description) {
    const paragraphs = bodyContent.split(/\r?\n\r?\n/);
    const nonHeading = paragraphs.find((p) => p.trim() && !p.trim().startsWith("#"));
    description = nonHeading ? nonHeading.trim().slice(0, 160) : "Custom agent skill.";
  }

  return {
    frontmatter,
    content: trimmed,
    name,
    slug,
    description,
  };
}

/**
 * Detects any skills referenced in the prompt (either via inline mention badge `/[title](skill://slug)`
 * or explicit slash tokens like `/browser-use` or `/manim-video`) and returns the clean human-facing text
 * plus the augmented prompt with full skill instructions.
 */
export function extractSkillsAndAugmentPrompt(
  rawPrompt: string,
  availableSkills: LocalSkill[]
): {
  cleanPrompt: string;
  augmentedPrompt: string;
  matchedSkills: LocalSkill[];
} {
  if (!rawPrompt) {
    return { cleanPrompt: "", augmentedPrompt: "", matchedSkills: [] };
  }

  const matchedSkills: LocalSkill[] = [];
  const matchedSlugs = new Set<string>();

  // 1. Detect inline badge format: /[title](skill://slug)
  const badgeRegex = /\/\[([^\]]+)\]\(skill:\/\/([^\)]+)\)/g;
  const cleanPrompt = rawPrompt.replace(badgeRegex, (_match, _title, slug) => {
    const cleanSlug = slug.toLowerCase().trim();
    matchedSlugs.add(cleanSlug);
    return `/${cleanSlug}`;
  });

  // 2. Also check for raw slash commands like `/skill-slug`
  const slashTokens = Array.from(cleanPrompt.matchAll(/(?:^|\s)\/([a-zA-Z0-9_-]+)(?=$|\s|[.,!?](?=\s|$))/g), (match) => "/" + match[1]);
  for (const token of slashTokens) {
    const slugCandidate = token.slice(1).toLowerCase();
    matchedSlugs.add(slugCandidate);
  }

  // Find all matching skills in availableSkills
  for (const slug of matchedSlugs) {
    const skill = availableSkills.find(
      (s) => s.isEnabled && (s.slug.toLowerCase() === slug || s.id.toLowerCase() === slug)
    );
    if (skill && !matchedSkills.some((s) => s.slug === skill.slug)) {
      matchedSkills.push(skill);
    }
  }

  if (matchedSkills.length === 0) {
    return { cleanPrompt, augmentedPrompt: cleanPrompt, matchedSkills: [] };
  }

  // Build the augmented prompt with skill markdown instructions
  const skillBlocks = matchedSkills
    .map((s) => {
      return `<skill name="${s.slug}" title="${s.name}">\n${s.content}\n</skill>`;
    })
    .join("\n\n");

  const augmentedPrompt = `${cleanPrompt}\n\n[INCLUDED AGENT SKILLS / INSTRUCTIONS]:\n${skillBlocks}`;

  return {
    cleanPrompt,
    augmentedPrompt,
    matchedSkills,
  };
}

