import { describe, it, expect } from "vitest";
import path from "node:path";
import { executeLspQuery } from "../src/const/lsp.js";
import { executeNativeTool } from "../src/const/tools.js";

describe("LSP Tool & Code Intelligence", () => {
  const workspaceRoot = path.resolve(__dirname, "..");
  const testFile = "src/const/types.ts";

  it("should extract document symbols from a TypeScript source file", async () => {
    const result = await executeLspQuery(
      "documentSymbols",
      testFile,
      1,
      1,
      workspaceRoot
    );

    expect(result.operation).toBe("documentSymbols");
    expect(result.symbols).toBeDefined();
    expect(result.symbols!.length).toBeGreaterThan(0);
    expect(result.formatted).toContain("[LSP documentSymbols]");
    const typeNames = result.symbols!.map((s) => s.name);
    expect(typeNames).toContain("AgentMessage");
  });

  it("should retrieve hover information for a symbol", async () => {
    const result = await executeLspQuery(
      "hover",
      testFile,
      13,
      18, // AgentMessage
      workspaceRoot
    );

    expect(result.operation).toBe("hover");
    expect(result.formatted).toContain("LSP Hover");
    expect(result.formatted).toContain("AgentMessage");
  });

  it("should navigate to definition of a type symbol", async () => {
    const result = await executeLspQuery(
      "goToDefinition",
      testFile,
      19,
      18, // ToolCall in tool_calls?: ToolCall[]
      workspaceRoot
    );

    expect(result.operation).toBe("goToDefinition");
    expect(result.locations).toBeDefined();
    expect(result.locations!.length).toBeGreaterThan(0);
    expect(result.locations![0].line).toBe(4); // interface ToolCall
  });

  it("should find references across the workspace", async () => {
    const result = await executeLspQuery(
      "findReferences",
      testFile,
      4,
      18, // interface ToolCall
      workspaceRoot
    );

    expect(result.operation).toBe("findReferences");
    expect(result.locations).toBeDefined();
    expect(result.locations!.length).toBeGreaterThan(0);
  });

  it("should successfully execute through executeNativeTool router", async () => {
    const res = await executeNativeTool(
      "lsp",
      {
        operation: "documentSymbols",
        file_path: testFile,
      },
      workspaceRoot
    );

    expect(res.isError).toBe(false);
    expect(res.result).toContain("[LSP documentSymbols]");
    expect(res.result).toContain("AgentMessage");
  });

  it("should return an error for non-existent file", async () => {
    const res = await executeNativeTool(
      "lsp",
      {
        operation: "documentSymbols",
        file_path: "non_existent_file_xyz.ts",
      },
      workspaceRoot
    );

    expect(res.isError).toBe(true);
    expect(res.result).toContain("File not found");
  });
});
