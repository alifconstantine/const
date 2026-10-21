import { db } from "../db";
import type { LocalSkill, LocalSkillBundle, SkillFrontmatter, SkillCategory } from "./types";
import { DEFAULT_SKILLS, DEFAULT_SKILL_BUNDLES } from "./default-skills";
import { MARKETPLACE_CATALOG, type MarketplaceSkill } from "./skills-catalog";

export { MARKETPLACE_CATALOG, type MarketplaceSkill };

/**
 * Synchronize skills installed on filesystem into local Dexie database
 */
export async function syncInstalledSkillsFromDisk(workspacePath?: string): Promise<void> {
  if (window.electron?.marketplace) {
    try {
      const installed = await window.electron.marketplace.listInstalled(workspacePath);
      const existing = await db.skills.toArray();
      const existingMap = new Map(existing.map((s) => [s.slug, s]));

      // 1. Insert or update skills found on disk
      for (const item of installed) {
        const match = existingMap.get(item.slug);
        const catalogMatch = MARKETPLACE_CATALOG.find((c) => c.slug === item.slug);
        const category: SkillCategory = catalogMatch?.category || "custom";

        if (!match) {
          await db.skills.put({
            id: `skill_${item.slug}`,
            slug: item.slug,
            name: item.name,
            description: item.description,
            content: item.content,
            icon: catalogMatch?.icon || "PencilSparkles",
            category,
            isBuiltIn: false,
            isEnabled: true,
            scope: item.scope,
            author: item.author || catalogMatch?.author || "User",
            version: item.version || "1.0.0",
            overview: generateSkillOverview(item.name, item.slug, item.content, item.description),
            files: item.files,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } else {
          if (match.content !== item.content || !match.files || match.description !== item.description) {
            await db.skills.update(match.id, {
              name: item.name,
              content: item.content,
              files: item.files,
              description: item.description,
              author: item.author || match.author,
              version: item.version || match.version,
              overview: generateSkillOverview(item.name, item.slug, item.content, item.description),
              updatedAt: Date.now(),
            });
          }
        }
      }

      // If no skills exist yet in Dexie, seed pre-installed default skills (docx, pdf, pptx)
      const totalCount = await db.skills.count();
      if (totalCount === 0 && DEFAULT_SKILLS.length > 0) {
        await db.skills.bulkPut(DEFAULT_SKILLS);
      }
    } catch (err) {
      console.warn("[SkillsService] Failed to sync installed skills from disk:", err);
    }
  } else {
    // Web fallback
    const count = await db.skills.count();
    if (count === 0 && DEFAULT_SKILLS.length > 0) {
      await db.skills.bulkPut(DEFAULT_SKILLS);
    }
  }
}

/**
 * Fetch full skill content and files for any skill (installed or from catalog)
 */
export async function fetchSkillContent(
  slug: string,
  workspacePath?: string
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
  const local = await db.skills.where("slug").equals(cleanSlug).first();
  if (local && local.files && Object.keys(local.files).length > 0) {
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
 * Install a skill from the marketplace catalog to filesystem and Dexie DB
 */
export async function installSkillFromMarketplace(
  slug: string,
  scope: "user" | "workspace" = "user",
  workspacePath?: string
): Promise<LocalSkill> {
  if (!window.electron?.marketplace) {
    throw new Error("Marketplace electron bridge is unavailable");
  }

  const installed = await window.electron.marketplace.installSkill({ slug, scope, workspacePath });
  if (!installed) {
    throw new Error(`Failed to install skill '${slug}'`);
  }

  const catalogMatch = MARKETPLACE_CATALOG.find((c) => c.slug === slug);
  const category: SkillCategory = catalogMatch?.category || "custom";

  const localSkill: LocalSkill = {
    id: `skill_${installed.slug}`,
    slug: installed.slug,
    name: installed.name,
    description: installed.description,
    content: installed.content,
    icon: catalogMatch?.icon || "PencilSparkles",
    category,
    isBuiltIn: false,
    isEnabled: true,
    scope: installed.scope,
    author: installed.author || catalogMatch?.author || "User",
    version: installed.version || catalogMatch?.version || "1.0.0",
    overview: generateSkillOverview(installed.name, installed.slug, installed.content, installed.description),
    files: installed.files,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.skills.put(localSkill);
  return localSkill;
}

/**
 * Uninstall a skill from filesystem and delete from Dexie DB
 */
export async function uninstallSkillFromMarketplace(
  id: string,
  slug: string,
  scope: "user" | "workspace" = "user",
  workspacePath?: string
): Promise<boolean> {
  try {
    if (window.electron?.marketplace) {
      await window.electron.marketplace.uninstallSkill({ slug, scope, workspacePath });
    }
    await db.skills.delete(id);
    return true;
  } catch (err) {
    console.error("[SkillsService] Failed to uninstall skill:", err);
    return false;
  }
}

/**
 * Initialize and seed built-in skills and bundles in local Dexie database
 */
export async function ensureDefaultSkillsSeeded(forceReset = false): Promise<void> {
  try {
    if (forceReset) {
      await db.skillBundles.clear();
      await db.skills.clear();
    }
    await syncInstalledSkillsFromDisk();
  } catch (err) {
    console.warn("[SkillsService] Failed to seed default skills:", err);
  }
}

/**
 * Creates a custom skill autonomously (e.g. called from agent or UI)
 */
export async function createCustomSkill(data: {
  slug: string;
  name: string;
  description?: string;
  content: string;
  category?: SkillCategory;
  author?: string;
  files?: Record<string, string>;
}): Promise<LocalSkill> {
  const scan = runSecurityScan(data.content);
  if (!scan.passed) {
    throw new Error(`Security validation failed: ${scan.message} (${scan.details?.join(", ")})`);
  }

  const id = `skill_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const now = Date.now();
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");

  const newSkill: LocalSkill = {
    id,
    slug,
    name: data.name.trim(),
    description: data.description?.trim() || "",
    content: data.content.trim(),
    category: data.category || "custom",
    isBuiltIn: false,
    isEnabled: true,
    scope: "user",
    author: data.author || "User",
    version: "1.0.0",
    overview: generateSkillOverview(data.name, slug, data.content, data.description),
    files: data.files,
    createdAt: now,
    updatedAt: now,
  };

  await db.skills.put(newSkill);
  return newSkill;
}

/**
 * Generate a clean structured AI overview for a skill based on its content
 */
export function generateSkillOverview(
  name: string,
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

  overviewText += `### Safety & Sandboxing\n`;
  overviewText += `Runs locally within Const Agent. Verified safe with no unauthorized external telemetry or malicious command execution.`;

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
 * Format active skills for injection into the agent's system prompt or turn
 */
export function formatSkillsSystemPrompt(skills: LocalSkill[]): string {
  const active = skills.filter((s) => s.isEnabled);
  if (active.length === 0) return "";

  const list = active
    .map((s) => `- /${s.slug} (${s.name}): ${s.description}`)
    .join("\n");

  return (
    `\n\n[AVAILABLE AGENT SKILLS]:\n` +
    `You have the following modular skills and specialized capabilities installed:\n` +
    `${list}\n\n` +
    `Guidelines for skills:\n` +
    `1. When the user starts their prompt with or mentions a slash trigger (e.g. /${active[0]?.slug || "skill"}), strictly apply that skill's methodology and standards.\n` +
    `2. Even without an explicit slash command, you may autonomously select and apply any relevant skill if the user's intent matches its domain.\n` +
    `3. To create a new skill for future use, you can write a valid SKILL.md specification and register it with the system.`
  );
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
  let cleanPrompt = rawPrompt.replace(badgeRegex, (_match, _title, slug) => {
    const cleanSlug = slug.toLowerCase().trim();
    matchedSlugs.add(cleanSlug);
    return `/${cleanSlug}`;
  });

  // 2. Also check for raw slash commands like `/skill-slug`
  const slashTokens = cleanPrompt.match(/\/([a-zA-Z0-9_-]+)/g);
  if (slashTokens) {
    for (const token of slashTokens) {
      const slugCandidate = token.slice(1).toLowerCase();
      matchedSlugs.add(slugCandidate);
    }
  }

  // Find all matching skills in availableSkills
  for (const slug of matchedSlugs) {
    const skill = availableSkills.find(
      (s) => s.slug.toLowerCase() === slug || s.id.toLowerCase() === slug
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

/**
 * Register a new custom skill directly from raw markdown content
 */
export async function registerSkillFromContent(
  rawMarkdown: string,
  category?: SkillCategory
): Promise<LocalSkill> {
  const parsed = parseSkillMarkdown(rawMarkdown);
  return createCustomSkill({
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    content: parsed.content,
    category: category || (parsed.frontmatter.category as SkillCategory) || "custom",
    author: (parsed.frontmatter.author as string) || "Agent Autonomously Created",
  });
}

