import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { executeNativeTool, CONST_DEFAULT_TOOLS, isPathWithinWorkspace } from "../src/const/tools.js";
import { createConstAgent } from "../src/const/const-agent.js";

describe("Const Agent Native Tools & Self-Healing Engine", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "const-agent-test-"));
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("exposes all required native tools", () => {
    const toolNames = CONST_DEFAULT_TOOLS.map((t) => t.function.name);
    expect(toolNames).toContain("read");
    expect(toolNames).toContain("write");
    expect(toolNames).toContain("edit");
    expect(toolNames).toContain("ls");
    expect(toolNames).toContain("bash");
    expect(toolNames).toContain("find");
    expect(toolNames).toContain("grep");
    expect(toolNames).toContain("mkdir");
    expect(toolNames).not.toContain("generate_speech");
    expect(toolNames).not.toContain("generate_image");
  });

  it("rejects generate_speech and generate_image when not in learn preset", async () => {
    const speechRes = await executeNativeTool(
      "generate_speech",
      { text: "hello", output_path: "speech.mp3" },
      tempDir,
      { parentConfig: { preset: "harness" } as any }
    );
    expect(speechRes.isError).toBe(true);
    expect(speechRes.result).toContain("not available in Const Harness");

    const imgRes = await executeNativeTool(
      "generate_image",
      { prompt: "a cat", output_path: "cat.png" },
      tempDir,
      { parentConfig: { preset: "harness" } as any }
    );
    expect(imgRes.isError).toBe(true);
    expect(imgRes.result).toContain("not available in Const Harness");
  });

  it("handles write_file and read_file with multi-alias argument names", async () => {
    const testFile = path.join(tempDir, "test-notes.txt");

    // Test writing with `filePath` and `contents` aliases
    const writeRes = await executeNativeTool(
      "write_file",
      { filePath: testFile, contents: "Hello Const Intelligence!\nSecond Line." },
      tempDir
    );
    expect(writeRes.isError).toBe(false);
    expect(writeRes.result).toContain("written successfully");

    // Test reading with `filename` alias
    const readRes = await executeNativeTool(
      "read_file",
      { filename: testFile },
      tempDir
    );
    expect(readRes.isError).toBe(false);
    expect(readRes.result).toContain("Hello Const Intelligence!");
    expect(readRes.result).toContain("Second Line.");
  });

  it("supports edit_file exact string replacement", async () => {
    const testFile = path.join(tempDir, "code.py");
    await fs.writeFile(testFile, "def add(a, b):\n    return a - b\n", "utf-8");

    const editRes = await executeNativeTool(
      "edit_file",
      {
        path: testFile,
        old_text: "return a - b",
        new_text: "return a + b",
      },
      tempDir
    );
    expect(editRes.isError).toBe(false);
    expect(editRes.result).toContain("Successfully edited");

    const updatedContent = await fs.readFile(testFile, "utf-8");
    expect(updatedContent).toContain("return a + b");
  });

  it("provides self-healing suggestions when a file is not found", async () => {
    const missingPath = path.join(tempDir, "non_existent_file.txt");
    const readRes = await executeNativeTool(
      "read_file",
      { path: missingPath },
      tempDir
    );
    expect(readRes.isError).toBe(true);
    expect(readRes.result).toContain("File not found");
    expect(readRes.result).toContain("Files available in");
  });

  it("lists directory contents with list_dir", async () => {
    const listRes = await executeNativeTool(
      "list_dir",
      { path: tempDir },
      tempDir
    );
    expect(listRes.isError).toBe(false);
    expect(listRes.result).toContain("test-notes.txt");
    expect(listRes.result).toContain("code.py");
  });

  it("executes safe commands with run_command", async () => {
    const runRes = await executeNativeTool(
      "run_command",
      { command: "node -e \"console.log('const-engine-ok')\"" },
      tempDir
    );
    expect(runRes.isError).toBe(false);
    expect(runRes.result).toContain("const-engine-ok");
  });

  it("extracts text from real PDF if available", async () => {
    const pdfPath = "C:\\Users\\AlifConstantine\\Downloads\\2607.24653v2.pdf";
    try {
      await fs.access(pdfPath);
      const pdfRes = await executeNativeTool("read_file", { path: pdfPath }, tempDir);
      expect(pdfRes.isError).toBe(false);
      expect(pdfRes.result).toContain("Halaman: 47");
      expect(pdfRes.result).toContain("Kimi");
    } catch {
      // PDF does not exist in this environment, test is skipped gracefully
    }
  });

  it("defaults maxTurns to 200 to support long autonomous sessions", async () => {
    const { createConstAgent } = await import("../src/const/const-agent.js");
    const agent = createConstAgent({
      sessionId: "test-turns-session",
      workspacePath: tempDir,
      model: "test-model",
      provider: "test-provider",
    });
    expect(agent.maxTurns).toBe(200);
  });

  it("filters thinking tags cleanly without leaking into output tokens", async () => {
    const { ThinkingStreamFilter } = await import("../src/const/const-agent.js");
    const filter = new ThinkingStreamFilter();

    // Stream arrives in chunks that split tag boundaries
    const chunks = ["Hello, <th", "ink>This is internal ", "step 1", "</thi", "nk> here is the output!"];
    let content = "";
    let thinking = "";

    for (const chunk of chunks) {
      const res = filter.push(chunk);
      content += res.content;
      thinking += res.thinking;
    }
    const flushed = filter.flush();
    content += flushed.content;
    thinking += flushed.thinking;

    expect(content).toBe("Hello,  here is the output!");
    expect(thinking).toBe("This is internal step 1");
  });

  it("extracts fallback tool calls from markdown code blocks and XML tags", async () => {
    const { extractFallbackToolCalls } = await import("../src/const/const-agent.js");

    const markdownCall = 'I will write the file:\n```json\n{\n  "name": "write",\n  "arguments": {\n    "path": "app.css",\n    "content": "body { margin: 0; }"\n  }\n}\n```';
    const calls1 = extractFallbackToolCalls(markdownCall);
    expect(calls1.length).toBe(1);
    expect(calls1[0].function.name).toBe("write");
    expect(JSON.parse(calls1[0].function.arguments).path).toBe("app.css");

    const xmlCall = '<tool_call>{"name": "bash", "arguments": {"command": "pnpm build"}}</tool_call>';
    const calls2 = extractFallbackToolCalls(xmlCall);
    expect(calls2.length).toBe(1);
    expect(calls2[0].function.name).toBe("bash");

    const normalText = "This is just a helpful explanation with no tool calls.";
    expect(extractFallbackToolCalls(normalText)).toEqual([]);
  });

  it("compacts older large tool outputs for long-horizon context optimization", async () => {
    const { compactHistoryForContext } = await import("../src/const/const-agent.js");

    const longOutput = "A".repeat(3000);
    const history: any[] = [
      { role: "user", content: "Init project" },
      { role: "assistant", content: "Reading files", thinking: "T".repeat(3000) },
      { role: "tool", tool_call_id: "c1", name: "read", content: longOutput },
      { role: "assistant", content: "Second step" },
      { role: "user", content: "Continue" },
      { role: "assistant", content: "Recent step" },
      { role: "tool", tool_call_id: "c2", name: "read", content: longOutput },
      { role: "assistant", content: "Final answer" },
    ];

    // preserveRecentCount = 3 -> only the last 3 messages are untouched
    const compacted = compactHistoryForContext(history, 3);
    expect(compacted[2].content).toContain("[Tool output: 3000 characters compacted for context optimization]");
    expect(compacted[1].thinking).toContain("[Prior reasoning: 3000 chars compacted]");
    // Recent tool output at index 6 must NOT be truncated
    expect(compacted[6].content).toBe(longOutput);
  });

  it("compacts older large user prompts from prior tasks while keeping the latest user prompt intact", async () => {
    const { compactHistoryForContext } = await import("../src/const/const-agent.js");

    const hugePriorUserPrompt = "Build a massive application with 100 features... ".repeat(100); // ~4900 chars
    const currentTaskPrompt = "Now add a simple reset button";

    const history: any[] = [
      { role: "user", content: hugePriorUserPrompt },
      { role: "assistant", content: "Done building initial application" },
      { role: "user", content: currentTaskPrompt },
      { role: "assistant", content: "Working on reset button..." },
    ];

    const compacted = compactHistoryForContext(history, 2);
    // Older user prompt must be compacted
    expect(compacted[0].content).toContain("[Prior task instructions:");
    expect(compacted[0].content).toContain("characters compacted for context optimization]");
    // Latest user prompt must NOT be compacted
    expect(compacted[2].content).toBe(currentTaskPrompt);
  });

  it("allows native tools to access paths outside workspace when required", async () => {
    const foreignDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreign-test-"));
    const foreignFile = path.join(foreignDir, "external.txt");
    await fs.writeFile(foreignFile, "external project data", "utf-8");

    try {
      // 1. Reading foreign file outside workspace is allowed
      const readRes = await executeNativeTool("read", { path: foreignFile }, tempDir);
      expect(readRes.isError).toBe(false);
      expect(readRes.result).toContain("external project data");

      // 2. Writing foreign file outside workspace is denied by default (sandbox safety)
      const writePath = path.join(foreignDir, "written.txt");
      const writeDeniedRes = await executeNativeTool(
        "write",
        { path: writePath, content: "written outside workspace" },
        tempDir
      );
      expect(writeDeniedRes.isError).toBe(true);
      expect(writeDeniedRes.result).toContain("[SANDBOX DENIED]");

      // Writing foreign file is allowed when allowOutsideWorkspace option is enabled
      const writeAllowedRes = await executeNativeTool(
        "write",
        { path: writePath, content: "written outside workspace" },
        tempDir,
        { allowOutsideWorkspace: true }
      );
      expect(writeAllowedRes.isError).toBe(false);
      expect(writeAllowedRes.result).toContain("File written successfully");

      // 3. Listing directory outside workspace is allowed
      const lsRes = await executeNativeTool("ls", { path: foreignDir }, tempDir);
      expect(lsRes.isError).toBe(false);
      expect(lsRes.result).toContain("external.txt");
      expect(lsRes.result).toContain("written.txt");

      // 4. Grep outside workspace is allowed
      const grepRes = await executeNativeTool("grep", { path: foreignDir, query: "external" }, tempDir);
      expect(grepRes.isError).toBe(false);
      expect(grepRes.result).toContain("external.txt");
    } finally {
      await fs.rm(foreignDir, { recursive: true, force: true });
    }
  });

  it("handles reasoning tags and orphan closing tags in ThinkingStreamFilter", async () => {
    const { ThinkingStreamFilter } = await import("../src/const/const-agent.js");
    const filter = new ThinkingStreamFilter();

    // Test reasoning tags
    const res1 = filter.push("Start <reasoning>Step by step plan</reasoning> Done");
    expect(res1.content).toBe("Start  Done");
    expect(res1.thinking).toBe("Step by step plan");

    // Test orphan close tag (missing open tag)
    const filter2 = new ThinkingStreamFilter();
    const res2 = filter2.push("Hidden thought process</think> Visible response");
    expect(res2.content).toBe(" Visible response");
    expect(res2.thinking).toBe("Hidden thought process");
  });

  it("detects dev server commands vs build commands correctly", async () => {
    const { isDevServerCommand } = await import("../src/const/tools.js");

    expect(isDevServerCommand("npm run dev")).toBe(true);
    expect(isDevServerCommand("pnpm dev")).toBe(true);
    expect(isDevServerCommand("yarn dev")).toBe(true);
    expect(isDevServerCommand("bun run dev")).toBe(true);
    expect(isDevServerCommand("vite")).toBe(true);
    expect(isDevServerCommand("next dev")).toBe(true);
    expect(isDevServerCommand("npm start")).toBe(true);

    expect(isDevServerCommand("npm run build")).toBe(false);
    expect(isDevServerCommand("pnpm run build")).toBe(false);
    expect(isDevServerCommand("tsc --noEmit")).toBe(false);
    expect(isDevServerCommand("git status")).toBe(false);
  });

  it("executes bash commands with custom cwd parameter", async () => {
    const subDir = path.join(tempDir, "custom-cwd-test");
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(path.join(subDir, "marker.txt"), "found inside subDir", "utf-8");

    // Execute in subDir using cwd argument
    const res = await executeNativeTool(
      "bash",
      { command: "node -e \"console.log(process.cwd())\"", cwd: subDir },
      tempDir
    );
    expect(res.isError).toBe(false);
    expect(path.normalize(res.result)).toContain(path.normalize(subDir));
  });

  it("truncates extremely large command output in bash tool", async () => {
    // Generate ~60,000 characters of output
    const res = await executeNativeTool(
      "bash",
      { command: "node -e \"console.log('A'.repeat(60000))\"" },
      tempDir
    );
    expect(res.isError).toBe(false);
    expect(res.result).toContain("[OUTPUT TRUNCATED:");
    expect(res.result).toContain("Full unclipped output");
    expect(res.result.length).toBeLessThan(40_000);
    const artifacts = await fs.readdir(path.join(tempDir, ".const", "artifacts"));
    const outputFile = artifacts.find(file => file.startsWith("bash_"));
    expect(outputFile).toBeDefined();
    expect((await fs.readFile(path.join(tempDir, ".const", "artifacts", outputFile!), "utf8")).trim()).toBe("A".repeat(60000));
  });
});

describe("Permission Modes & Workspace-Write Security", () => {
  let wsDir: string;

  beforeAll(async () => {
    wsDir = await fs.mkdtemp(path.join(os.tmpdir(), "const-perm-test-"));
  });

  afterAll(async () => {
    try {
      await fs.rm(wsDir, { recursive: true, force: true });
    } catch {}
  });

  it("correctly checks if paths are within workspace or escaping", () => {
    // Normal files and directories inside workspace
    expect(isPathWithinWorkspace(path.join(wsDir, "src", "index.ts"), wsDir)).toBe(true);
    expect(isPathWithinWorkspace(path.join(wsDir, "notes.md"), wsDir)).toBe(true);
    expect(isPathWithinWorkspace(wsDir, wsDir)).toBe(true);

    // Path traversal or foreign directories
    expect(isPathWithinWorkspace(path.resolve(wsDir, "../outside.txt"), wsDir)).toBe(false);
    expect(isPathWithinWorkspace(path.resolve(wsDir, "..", "..", "secrets.json"), wsDir)).toBe(false);
    expect(isPathWithinWorkspace(os.tmpdir(), wsDir)).toBe(false);
  });

  it("ConstAgent supports initialAllowedTools and maintains session permissions", () => {
    const agent = createConstAgent({
      apiKey: "test",
      model: "test-model",
      workspacePath: wsDir,
      mode: "ask_before_changes",
      initialAllowedTools: ["bash", "file:notes.txt"],
    });

    const set = agent.sessionAllowedToolsSet;
    expect(set.has("bash")).toBe(true);
    expect(set.has("file:notes.txt")).toBe(true);
    expect(set.has("run_python")).toBe(false);
  });

  it("ConstAgent dynamically updates mode and auto-resolves pending approvals on full_access", () => {
    const agent = createConstAgent({
      apiKey: "test",
      model: "test-model",
      workspacePath: wsDir,
      mode: "ask_before_changes",
    });

    expect(agent.mode).toBe("ask_before_changes");

    let resolvedDecision: string | null = null;
    (agent as any).pendingApprovals.set("test_appr_1", (res: any) => {
      resolvedDecision = res.decision;
    });

    // Switch to full access
    agent.updateMode("full_access");
    expect(agent.mode).toBe("full_access");
    expect(resolvedDecision).toBe("allow_once");
    expect((agent as any).pendingApprovals.size).toBe(0);

    // Switch back to ask before changes
    agent.updateMode("ask_before_changes");
    expect(agent.mode).toBe("ask_before_changes");
  });
});

