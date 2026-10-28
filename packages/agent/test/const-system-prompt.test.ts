import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildConstSystemPrompt, buildLearnSystemPrompt, createConstAgent } from "../src/const/const-agent.js";
import { CONST_DEFAULT_TOOLS } from "../src/const/tools.js";
import { buildToolGuidance, promptFileExcerpt } from "../src/const/prompt-guidance.js";
import { pluginInvocationInstructions } from "../src/const/skill-registry.js";
import type { AgentConfig } from "../src/const/types.js";
import { normalizeUiMessages } from "../../../apps/harness/desktop/src/lib/conversation-store";

vi.mock("../src/const/skill-registry.js", () => ({
  resolveSkillRegistry: () => ({ skills: [], plugins: [] }),
  pluginInvocationInstructions: vi.fn(() => ""),
}));

let workspace: string;
beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "const-prompt-test-"));
  vi.mocked(pluginInvocationInstructions).mockClear();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(workspace, { recursive: true, force: true });
});

type Request = { messages: Array<{ role: string; content: any; reasoning_content?: string }>; tools?: Array<{ function: { name: string } }> };
function fixture(respond: (turn: number) => { delta: object; finish_reason?: string }, config: Partial<AgentConfig> = {}) {
  const requests: Request[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    const choice = respond(requests.length);
    return new Response(`data: ${JSON.stringify({ choices: [{ finish_reason: "stop", ...choice }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
  }));
  const agent = createConstAgent({ model: "fixture", baseUrl: "http://fixture.invalid/v1", apiKey: "", workspacePath: workspace, maxTurns: 4, mode: "full_access", ...config });
  return { requests, run: (text = "Audit kode saja; jangan ubah file.") => agent.run([{ role: "user", content: text }], () => {}) };
}

describe("context excerpts", () => {
  it("identifies clipped instruction and memory files without changing the originals", async () => {
    const instructions = "a".repeat(5100) + "FINAL PROJECT RULE";
    const memory = "m".repeat(3100) + "FINAL MEMORY FACT";
    await writeFile(path.join(workspace, "AGENTS.md"), instructions);
    await mkdir(path.join(workspace, ".const", "memory"), { recursive: true });
    const memoryPath = path.join(workspace, ".const", "memory", "MEMORY.md");
    await writeFile(memoryPath, memory);
    const prompt = buildConstSystemPrompt(workspace);
    expect(prompt).toContain(`showing 5000 of ${instructions.length}`);
    expect(prompt).toContain(`showing 3000 of ${memory.length}`);
    expect(prompt).toContain("Read the full file");
    expect(prompt).toContain("AGENTS.md");
    expect(prompt).toContain("MEMORY.md");
    expect(prompt).not.toContain("FINAL PROJECT RULE");
    expect(await readFile(memoryPath, "utf8")).toBe(memory);
    expect(buildLearnSystemPrompt(workspace)).toContain(`showing 5000 of ${instructions.length}`);
  });

  it("leaves complete small files intact and labels README as reference data", async () => {
    expect(promptFileExcerpt("complete", 8, "file.md")).toBe("complete");
    await writeFile(path.join(workspace, "README.md"), "Project overview");
    const prompt = buildConstSystemPrompt(workspace);
    expect(prompt).toContain("<project_reference");
    expect(prompt).not.toContain("<project_instructions");
    expect(prompt).not.toContain("Context truncated:");
  });
});

describe("request-specific capability guidance", () => {
  it("removes disabled protocols from the next request as well as its schemas", async () => {
    await writeFile(path.join(workspace, "input.txt"), "Fixture");
    let enabled = true;
    const { requests, run } = fixture(turn => {
      if (turn === 1) {
        enabled = false;
        return { delta: { tool_calls: [{ index: 0, id: "read_1", type: "function", function: { name: "read", arguments: '{"path":"input.txt"}' } }] }, finish_reason: "tool_calls" };
      }
      return { delta: { content: "Selesai diperiksa." } };
    }, { nativeCapabilityEnabled: () => enabled });
    await run();
    expect(requests).toHaveLength(2);
    expect(requests[0]!.messages[0]!.content).toContain("NATIVE COMPUTER USE");
    expect(requests[0]!.messages[0]!.content).toContain("NATIVE BROWSER AUTOMATION");
    const next = requests[1]!;
    expect(next.messages[0]!.content).not.toContain("NATIVE COMPUTER USE");
    expect(next.messages[0]!.content).not.toContain("NATIVE BROWSER AUTOMATION");
    expect(next.tools?.some(tool => /^(browser_|computer_)/.test(tool.function.name))).toBe(false);
  });

  it("keeps browser and computer guidance independent", () => {
    for (const [enabled, disabled] of [["browser_", "computer_"], ["computer_", "browser_"]]) {
      const tools = CONST_DEFAULT_TOOLS.filter(tool => tool.function.name.startsWith(enabled!));
      const prompt = buildConstSystemPrompt(workspace, undefined, tools);
      expect(prompt).toContain(enabled === "browser_" ? "NATIVE BROWSER AUTOMATION" : "NATIVE COMPUTER USE");
      expect(prompt).not.toContain(disabled === "browser_" ? "NATIVE BROWSER AUTOMATION" : "NATIVE COMPUTER USE");
    }
  });

  it("does not advertise file changes or delegation to inspection-only agents", () => {
    const tools = CONST_DEFAULT_TOOLS.filter(tool => ["read", "grep", "browser_snapshot"].includes(tool.function.name));
    const prompt = buildConstSystemPrompt(workspace, undefined, tools);
    expect(prompt).not.toContain("WORKSPACE FILE CHANGES:");
    expect(prompt).not.toContain("SUB-AGENT DELEGATION");
    expect(prompt).not.toContain("Available tools:");
    expect(prompt).toContain("Use only tools declared in this request");
  });

  it("adds Windows guidance only on Windows without forcing npm/git into Bash", () => {
    expect(buildToolGuidance(CONST_DEFAULT_TOOLS, "win32")).toContain("npm and git work in either shell");
    expect(buildToolGuidance(CONST_DEFAULT_TOOLS, "linux")).not.toContain("On Windows");
  });
});

describe("recovery preserves the actual user request", () => {
  it("recovers a truncated read-only answer without inventing a user write instruction", async () => {
    const { requests, run } = fixture(turn => turn === 1
      ? { delta: { content: "Hasil audit awal yang terpotong" }, finish_reason: "length" }
      : { delta: { content: "Ringkasan audit lengkap." } });
    const history = await run();
    expect(requests).toHaveLength(2);
    expect(requests[1]!.messages.filter(message => message.role === "user")).toEqual([{ role: "user", content: "Audit kode saja; jangan ubah file." }]);
    expect(requests[1]!.messages[0]!.content).toContain("do not turn an explanation or review into file creation");
    expect(requests[1]!.messages[0]!.content).toContain("user's primary language");
    expect(requests[1]!.messages.some(message => message.reasoning_content?.includes("Hasil audit awal yang terpotong"))).toBe(true);
    const visibleText = normalizeUiMessages(history).filter(message => message.role === "assistant").map(message => message.content).join("");
    expect(visibleText).toBe("Ringkasan audit lengkap.");
    expect(JSON.stringify(history)).not.toContain("implementation draft");
    expect(await readdir(workspace)).toEqual([]);
  });

  it("repeated reasoning-only responses do not force concrete file modifications", async () => {
    const { requests, run } = fixture(turn => turn < 3
      ? { delta: { reasoning_content: "Inspecting the request" } }
      : { delta: { content: "Audit selesai." } });
    await run();
    expect(requests).toHaveLength(3);
    expect(requests[2]!.messages[0]!.content).toContain("Keep read-only tasks read-only");
    expect(JSON.stringify(requests)).not.toContain("concrete file modifications");
    expect(requests[2]!.messages.filter(message => message.role === "user")).toHaveLength(1);
    expect(await readdir(workspace)).toEqual([]);
  });

  it("detects plugin selections from the human request after a visual tool observation", async () => {
    const { requests, run } = fixture(turn => turn === 1
      ? { delta: { tool_calls: [{ index: 0, id: "screen_1", type: "function", function: { name: "computer_get_app_state", arguments: '{"app":"Fixture"}' } }] }, finish_reason: "tool_calls" }
      : { delta: { content: "Inspected." } }, {
      computerHandler: async () => ({ result: "App inspected", isError: false, images: [{ mimeType: "image/png", data: "aW1hZ2U=" }] }),
      inputTypes: ["text", "image"],
    });
    await run("Use @diagram to inspect the app");
    expect(requests[1]!.messages.some(message => Array.isArray(message.content))).toBe(true);
    expect(vi.mocked(pluginInvocationInstructions).mock.calls.map(args => args[0])).toEqual(["Use @diagram to inspect the app", "Use @diagram to inspect the app"]);
  });
});
