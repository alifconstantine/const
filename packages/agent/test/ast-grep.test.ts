import { describe, it, expect } from "vitest";
import path from "node:path";
import { executeAstGrep, resolveAstGrepBinary } from "../src/const/ast-grep.js";
import { executeNativeTool } from "../src/const/tools.js";

describe("AST Grep Structural Code Search Tool", () => {
  const workspaceRoot = path.resolve(__dirname, "..");
  const testFile = "src/const/tools.ts";

  it("should locate binary or fallback properly", () => {
    const bin = resolveAstGrepBinary();
    // Either found binary in cache/path or null
    expect(bin === null || typeof bin === "string").toBe(true);
  });

  it("should find structural pattern with metavariables", async () => {
    const result = await executeAstGrep(
      {
        pattern: "export const $VAR = $VAL",
        targetPath: testFile,
        limit: 10,
      },
      workspaceRoot
    );

    expect(result.pattern).toBe("export const $VAR = $VAL");
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.formatted).toContain("[ast_grep]");

    const first = result.matches[0];
    expect(first.file).toContain("tools.ts");
    expect(first.line).toBeGreaterThan(0);
  });

  it("should execute via executeNativeTool router", async () => {
    const res = await executeNativeTool(
      "ast_grep",
      {
        pattern: "export const $VAR = $VAL",
        path: testFile,
      },
      workspaceRoot
    );

    expect(res.isError).toBe(false);
    expect(res.result).toContain("[ast_grep]");
  });

  it("should return an error when pattern is missing", async () => {
    const res = await executeNativeTool(
      "ast_grep",
      {
        path: testFile,
      },
      workspaceRoot
    );

    expect(res.isError).toBe(true);
    expect(res.result).toContain("Missing 'pattern'");
  });
});
