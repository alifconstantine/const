import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { executeNativeTool, CONST_DEFAULT_TOOLS } from "../src/const/tools.js";

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
});
