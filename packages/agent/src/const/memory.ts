import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

export interface MemoryItem {
  id: string;
  content: string;
  context?: string;
  scope: "project" | "global";
  timestamp: number;
  tags?: string[];
}

export interface RetainInputItem {
  content: string;
  context?: string;
  scope?: "project" | "global";
}

function getProjectMemoryPath(workspacePath: string): string {
  return path.join(workspacePath, ".const", "memory", "memories.json");
}

function getGlobalMemoryPath(): string {
  return path.join(os.homedir(), ".const", "memory", "global_memories.json");
}

async function loadMemories(filePath: string): Promise<MemoryItem[]> {
  try {
    if (!fsSync.existsSync(filePath)) return [];
    const text = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMemories(filePath: string, items: MemoryItem[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
}

/**
 * Retain important architectural facts, conventions, or decisions in long-term memory.
 */
export async function executeRetain(
  items: RetainInputItem[],
  workspacePath: string
): Promise<{ success: boolean; count: number; message: string }> {
  if (!items || items.length === 0) {
    return { success: false, count: 0, message: "No memory items provided to retain." };
  }

  const projectPath = getProjectMemoryPath(workspacePath);
  const globalPath = getGlobalMemoryPath();

  const projectExisting = await loadMemories(projectPath);
  const globalExisting = await loadMemories(globalPath);

  let retainedProject = 0;
  let retainedGlobal = 0;

  for (const item of items) {
    if (!item.content || !item.content.trim()) continue;

    const memoryItem: MemoryItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      content: item.content.trim(),
      context: item.context?.trim(),
      scope: item.scope === "global" ? "global" : "project",
      timestamp: Date.now(),
    };

    if (memoryItem.scope === "global") {
      globalExisting.push(memoryItem);
      retainedGlobal++;
    } else {
      projectExisting.push(memoryItem);
      retainedProject++;
    }
  }

  if (retainedProject > 0) {
    await saveMemories(projectPath, projectExisting);
  }
  if (retainedGlobal > 0) {
    await saveMemories(globalPath, globalExisting);
  }

  const total = retainedProject + retainedGlobal;
  return {
    success: true,
    count: total,
    message: `Successfully retained ${total} memory item(s) (${retainedProject} in project scope, ${retainedGlobal} in global scope).`,
  };
}

/**
 * Search long-term memory for relevant facts, architectural context, or user preferences.
 */
export async function executeRecall(
  query: string,
  workspacePath: string,
  options: { scope?: "project" | "global" | "all"; limit?: number } = {}
): Promise<{ total: number; results: MemoryItem[]; formatted: string }> {
  const scope = options.scope ?? "all";
  const limit = options.limit ?? 10;

  const projectPath = getProjectMemoryPath(workspacePath);
  const globalPath = getGlobalMemoryPath();

  const candidates: MemoryItem[] = [];

  if (scope === "project" || scope === "all") {
    candidates.push(...(await loadMemories(projectPath)));
  }
  if (scope === "global" || scope === "all") {
    candidates.push(...(await loadMemories(globalPath)));
  }

  if (candidates.length === 0) {
    return {
      total: 0,
      results: [],
      formatted: "No memories stored yet. Use the 'retain' tool to store important project facts.",
    };
  }

  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const scored = candidates.map((item) => {
    let score = 0;
    const itemText = `${item.content} ${item.context || ""}`.toLowerCase();

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
    ...recallResult.results.map((r, i) => `* ${r.content}`),
  ];

  return {
    query,
    memoriesCount: recallResult.results.length,
    formatted: lines.join("\n"),
  };
}
