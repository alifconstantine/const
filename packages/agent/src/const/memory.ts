import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

export interface MemoryItem {
  id: string;
  content: string;
  context?: string;
  title?: string;
  filename?: string;
  scope: "project" | "global";
  timestamp: number;
  tags?: string[];
}

export interface RetainInputItem {
  content: string;
  context?: string;
  title?: string;
  topic?: string;
  filename?: string;
  scope?: "project" | "global";
}

export interface MemoryFileInfo {
  name: string;
  path: string;
  scope: "project" | "global";
  updatedAt: number;
  formattedDate: string;
  size: number;
  preview: string;
}

export function getWorkspaceMemoryDir(workspacePath: string): string {
  return path.join(workspacePath, ".const", "memory");
}

export function getGlobalMemoryDir(): string {
  return path.join(os.homedir(), ".const", "memory");
}

function getProjectMemoryPath(workspacePath: string): string {
  return path.join(getWorkspaceMemoryDir(workspacePath), "memories.json");
}

function getGlobalMemoryPath(): string {
  return path.join(getGlobalMemoryDir(), "global_memories.json");
}

export function formatMemoryDate(timestamp: number): string {
  const d = new Date(timestamp);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[d.getMonth()] || "Jan";
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${mon} ${day} ${hours}:${mins}`;
}

function slugifyTopic(titleOrTopic: string): string {
  let s = titleOrTopic.trim().toLowerCase();
  if (s.endsWith(".md")) s = s.slice(0, -3);
  s = s.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return s ? `${s}.md` : "MEMORY.md";
}

async function loadMemoriesJson(filePath: string): Promise<MemoryItem[]> {
  try {
    if (!fsSync.existsSync(filePath)) return [];
    const text = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMemoriesJson(filePath: string, items: MemoryItem[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
}

/**
 * List all .md memory files for a workspace or global scope.
 */
export async function listMemoryFiles(
  workspacePath?: string,
  scope: "project" | "global" | "all" = "all"
): Promise<MemoryFileInfo[]> {
  const files: MemoryFileInfo[] = [];
  const dirsToScan: Array<{ dir: string; scope: "project" | "global" }> = [];

  if (scope === "project" || scope === "all") {
    if (workspacePath && workspacePath !== "Outside Project" && fsSync.existsSync(workspacePath)) {
      dirsToScan.push({ dir: getWorkspaceMemoryDir(workspacePath), scope: "project" });
    }
  }

  if (scope === "global" || scope === "all") {
    dirsToScan.push({ dir: getGlobalMemoryDir(), scope: "global" });
  }

  for (const { dir, scope: itemScope } of dirsToScan) {
    if (!fsSync.existsSync(dir)) continue;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

        const fullPath = path.join(dir, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          const rawText = await fs.readFile(fullPath, "utf-8");
          const firstLines = rawText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#"))
            .slice(0, 3)
            .join(" ");

          files.push({
            name: entry.name,
            path: fullPath,
            scope: itemScope,
            updatedAt: stat.mtimeMs,
            formattedDate: formatMemoryDate(stat.mtimeMs),
            size: stat.size,
            preview: firstLines.slice(0, 160),
          });
        } catch {}
      }
    } catch {}
  }

  // Sort files: MEMORY.md first, then by most recently updated
  files.sort((a, b) => {
    if (a.name.toLowerCase() === "memory.md" && b.name.toLowerCase() !== "memory.md") return -1;
    if (b.name.toLowerCase() === "memory.md" && a.name.toLowerCase() !== "memory.md") return 1;
    return b.updatedAt - a.updatedAt;
  });

  return files;
}

/**
 * Read memory markdown file content.
 */
export async function readMemoryFile(filePath: string): Promise<string> {
  if (!fsSync.existsSync(filePath)) return "";
  return await fs.readFile(filePath, "utf-8");
}

/**
 * Save / update memory markdown file content.
 */
export async function saveMemoryFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Delete a memory file.
 */
export async function deleteMemoryFile(filePath: string): Promise<boolean> {
  try {
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Retain important architectural facts, conventions, or decisions in long-term memory.
 * Stores both into markdown (.md) files for human editing and inspectability,
 * and maintains JSON index for fast lookups.
 */
export async function executeRetain(
  items: RetainInputItem[],
  workspacePath: string
): Promise<{ success: boolean; count: number; message: string; files: string[] }> {
  if (!items || items.length === 0) {
    return { success: false, count: 0, message: "No memory items provided to retain.", files: [] };
  }

  const projectDir = getWorkspaceMemoryDir(workspacePath);
  const globalDir = getGlobalMemoryDir();

  const projectJsonPath = getProjectMemoryPath(workspacePath);
  const globalJsonPath = getGlobalMemoryPath();

  const projectExisting = await loadMemoriesJson(projectJsonPath);
  const globalExisting = await loadMemoriesJson(globalJsonPath);

  let retainedProject = 0;
  let retainedGlobal = 0;
  const modifiedFiles = new Set<string>();

  for (const item of items) {
    if (!item.content || !item.content.trim()) continue;

    const scope = item.scope === "global" ? "global" : "project";
    const targetDir = scope === "global" ? globalDir : projectDir;
    await fs.mkdir(targetDir, { recursive: true });

    const now = Date.now();
    const dateStr = new Date(now).toISOString().split("T")[0];
    const timestampHeader = formatMemoryDate(now);

    const memoryItem: MemoryItem = {
      id: `mem_${now}_${Math.random().toString(36).slice(2, 7)}`,
      content: item.content.trim(),
      context: item.context?.trim(),
      title: item.title?.trim() || item.topic?.trim(),
      filename: item.filename?.trim(),
      scope,
      timestamp: now,
    };

    // Determine target markdown filename
    let mdFilename = "MEMORY.md";
    if (item.filename) {
      mdFilename = slugifyTopic(item.filename);
    } else if (item.title || item.topic) {
      mdFilename = slugifyTopic(item.title || item.topic || "");
    }

    const mdPath = path.join(targetDir, mdFilename);
    modifiedFiles.add(mdPath);

    // Format markdown entry
    let mdEntry = "";
    if (mdFilename.toLowerCase() === "memory.md") {
      let existingContent = "";
      if (fsSync.existsSync(mdPath)) {
        existingContent = await fs.readFile(mdPath, "utf-8");
      } else {
        existingContent = `# Workspace Memory\n\nCore conventions, architectural decisions, and persistent context.\n`;
      }

      const headerTitle = item.context || item.title || item.topic || "Note";
      mdEntry = `${existingContent.trimEnd()}\n\n### [${timestampHeader}] ${headerTitle}\n${item.content.trim()}\n`;
      await fs.writeFile(mdPath, mdEntry, "utf-8");
    } else {
      // Dedicated topic markdown file (e.g. user-java-learning-goal.md)
      const docTitle = item.title || item.topic || mdFilename.replace(/\.md$/, "");
      const contextLine = item.context ? `> Context: ${item.context}\n\n` : "";
      mdEntry = `# ${docTitle}\n\n* Updated: ${timestampHeader} (${dateStr})\n\n${contextLine}${item.content.trim()}\n`;
      await fs.writeFile(mdPath, mdEntry, "utf-8");
    }

    if (scope === "global") {
      globalExisting.push(memoryItem);
      retainedGlobal++;
    } else {
      projectExisting.push(memoryItem);
      retainedProject++;
    }
  }

  if (retainedProject > 0) {
    await saveMemoriesJson(projectJsonPath, projectExisting);
  }
  if (retainedGlobal > 0) {
    await saveMemoriesJson(globalJsonPath, globalExisting);
  }

  const total = retainedProject + retainedGlobal;
  const fileNames = Array.from(modifiedFiles).map((f) => path.basename(f));
  return {
    success: true,
    count: total,
    message: `Successfully retained ${total} memory item(s) (${retainedProject} in project scope, ${retainedGlobal} in global scope) in [${fileNames.join(", ")}].`,
    files: Array.from(modifiedFiles),
  };
}

/**
 * Search long-term memory for relevant facts, architectural context, or user preferences.
 * Searches across markdown files in .const/memory and memories.json.
 */
export async function executeRecall(
  query: string,
  workspacePath: string,
  options: { scope?: "project" | "global" | "all"; limit?: number } = {}
): Promise<{ total: number; results: MemoryItem[]; formatted: string }> {
  const scope = options.scope ?? "all";
  const limit = options.limit ?? 10;

  const projectDir = getWorkspaceMemoryDir(workspacePath);
  const globalDir = getGlobalMemoryDir();

  const candidates: MemoryItem[] = [];

  // 1. Load from Markdown files
  const mdFiles = await listMemoryFiles(workspacePath, scope);
  for (const file of mdFiles) {
    try {
      const content = await fs.readFile(file.path, "utf-8");
      // Split by markdown headers if file has multiple sections
      const sections = content.split(/\n(?=###?\s+)/);
      for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        // Skip top-level title header if alone
        if (/^#\s+Workspace Memory/i.test(trimmed) && trimmed.length < 120) continue;

        // Extract clean body
        const lines = trimmed.split("\n");
        let header = "";
        let bodyLines = lines;
        if (lines[0]?.startsWith("#")) {
          header = lines[0].replace(/^#+\s*/, "").replace(/^\[.*?\]\s*/, "").trim();
          bodyLines = lines.slice(1);
        }
        const bodyText = bodyLines.join("\n").trim();
        const displayContent = bodyText || trimmed;

        candidates.push({
          id: `file_${file.name}_${candidates.length}`,
          content: displayContent,
          context: header ? `${header} (${file.name})` : `From ${file.name}`,
          scope: file.scope,
          timestamp: file.updatedAt,
        });
      }
    } catch {}
  }

  // 2. Fallback to memories.json if no markdown candidates were found
  if (candidates.length === 0) {
    if (scope === "project" || scope === "all") {
      const projectItems = await loadMemoriesJson(getProjectMemoryPath(workspacePath));
      candidates.push(...projectItems);
    }
    if (scope === "global" || scope === "all") {
      const globalItems = await loadMemoriesJson(getGlobalMemoryPath());
      candidates.push(...globalItems);
    }
  }

  if (candidates.length === 0) {
    return {
      total: 0,
      results: [],
      formatted: "No memories stored yet. Use the 'retain' tool to store important project facts or conventions.",
    };
  }

  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const scored = candidates.map((item) => {
    let score = 0;
    const itemText = `${item.content} ${item.context || ""} ${item.title || ""}`.toLowerCase();

    for (const term of queryTerms) {
      if (itemText.includes(term)) {
        score += 2;
      }
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score || b.item.timestamp - a.item.timestamp);
  const matched = scored.filter((s) => s.score > 0).slice(0, limit);

  if (matched.length === 0) {
    return {
      total: 0,
      results: [],
      formatted: `No memories closely matching "${query}". Total stored memories: ${candidates.length}.`,
    };
  }

  const results = matched.map((m) => m.item);
  const formatted = [
    `# Recalled Memories (${results.length} hit(s)):`,
    ...results.map((r, i) => {
      const date = new Date(r.timestamp).toISOString().split("T")[0];
      const ctx = r.context ? `\n  Context: ${r.context}` : "";
      return `[${i + 1}] (${r.scope.toUpperCase()} | ${date}) ${r.content}${ctx}`;
    }),
  ].join("\n");

  return {
    total: results.length,
    results,
    formatted,
  };
}

/**
 * Synthesizes long-term memories to answer an architectural question or provide high-level reflection.
 */
export async function executeReflect(
  query: string,
  workspacePath: string,
  context?: string
): Promise<{ query: string; memoriesCount: number; formatted: string }> {
  const recallResult = await executeRecall(query, workspacePath, { limit: 15 });

  if (recallResult.results.length === 0) {
    return {
      query,
      memoriesCount: 0,
      formatted: `[Reflection]: No memories found regarding "${query}".`,
    };
  }

  const lines = [
    `# Reflection on: "${query}"`,
    context ? `Additional Context: ${context}\n` : "",
    `Synthesized from ${recallResult.results.length} long-term memory entries:`,
    "",
    ...recallResult.results.map((r) => `* ${r.content}`),
  ];

  return {
    query,
    memoriesCount: recallResult.results.length,
    formatted: lines.join("\n"),
  };
}

/**
 * Load workspace memory markdown summary to inject into the system prompt.
 * Only loads MEMORY.md (truncated to maxChars) to keep prompt token cost bounded.
 */
export async function loadWorkspaceMemoryPrompt(
  workspacePath?: string,
  maxChars = 2500
): Promise<string> {
  if (!workspacePath || workspacePath === "Outside Project" || !fsSync.existsSync(workspacePath)) {
    return "";
  }

  const memoryFile = path.join(getWorkspaceMemoryDir(workspacePath), "MEMORY.md");
  if (!fsSync.existsSync(memoryFile)) return "";

  try {
    const raw = await fs.readFile(memoryFile, "utf-8");
    const trimmed = raw.trim();
    if (!trimmed) return "";

    const content = trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}\n...(truncated)` : trimmed;
    return `\n<workspace_memory path=".const/memory/MEMORY.md">\n${content}\n</workspace_memory>\n`;
  } catch {
    return "";
  }
}
