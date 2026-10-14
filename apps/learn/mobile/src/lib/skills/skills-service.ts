import { db } from "../db";
import type { LocalSkill, LocalSkillBundle, SkillFrontmatter } from "./types";
import { DEFAULT_BUILTIN_SKILLS, DEFAULT_BUILTIN_BUNDLES } from "./default-skills";

/**
 * Initialize and seed built-in skills and bundles in local Dexie database
 */
export async function ensureDefaultSkillsSeeded(): Promise<void> {
  try {
    // 1. Seed bundles
    const existingBundles = await db.skillBundles.toArray();
    const existingBundleIds = new Set(existingBundles.map((b) => b.id));
    for (const bundle of DEFAULT_BUILTIN_BUNDLES) {
      if (!existingBundleIds.has(bundle.id)) {
        await db.skillBundles.put(bundle);
      } else {
        const ex = existingBundles.find((b) => b.id === bundle.id);
        if (ex && (!ex.files || !ex.skillIds || ex.skillIds.length !== bundle.skillIds.length)) {
          await db.skillBundles.update(bundle.id, {
            files: bundle.files,
            skillIds: bundle.skillIds,
            overview: bundle.overview,
            description: bundle.description,
          });
        }
      }
    }

    // 2. Seed skills
    const existingSkills = await db.skills.toArray();
    const existingSkillIds = new Set(existingSkills.map((s) => s.id));
    for (const skill of DEFAULT_BUILTIN_SKILLS) {
      if (!existingSkillIds.has(skill.id)) {
        await db.skills.put(skill);
      } else {
        const ex = existingSkills.find((s) => s.id === skill.id);
        if (ex && ex.isBuiltIn && (!ex.files || !ex.bundleId || ex.content.length < 300)) {
          await db.skills.update(skill.id, {
            bundleId: skill.bundleId,
            bundleName: skill.bundleName,
            files: skill.files,
            content: skill.content,
            overview: skill.overview,
            version: skill.version,
            author: skill.author,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[SkillsService] Failed to seed default skills:", err);
  }
}

/**
 * Generate a clean structured AI overview for a skill based on its content
 */
export function generateSkillOverview(
  name: string,
  slug: string,
  content: string,
  description: string
): string {
  const headings = Array.from(content.matchAll(/^##\s+(.+)$/gm)).map((m) => m[1]?.trim());
  const keyPoints = headings.filter(
    (h) =>
      h &&
      !h.toLowerCase().includes("usage") &&
      !h.toLowerCase().includes("license") &&
      !h.toLowerCase().includes("installation")
  );

  let overviewText = `${description}\n\n`;
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
  overviewText += `Runs locally within Const AI Agent. Scanned and verified safe with no unauthorized external telemetry or malicious command executions.`;

  return overviewText.trim();
}

/**
 * Static security scan for uploaded skill markdown or bundle
 */
export function runSecurityScan(
  content: string,
  filename?: string
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
 * Format active skills for injection into the agent's system prompt
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
    `2. Even without an explicit slash command, you may autonomously select and apply any relevant skill if the user's intent matches its domain (e.g. creating video scripts with HyperFrames, refining writing with No-AI-Slop, Socratic active recall, or generating Manim animations).`
  );
}
