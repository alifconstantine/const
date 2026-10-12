import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { performFuzzyEdit, applyLooseUnifiedDiff } from "./edit-engine.js";
import { checkBashInterception } from "./bash-interceptor.js";
import { executeRetain, executeRecall, executeReflect } from "./memory.js";
import { executeEval } from "./eval.js";
import { spoolLargeOutput } from "./output-spooler.js";

describe("Edit Engine Resilient Matching", () => {
  it("performs exact replacement", () => {
    const file = "const a = 1;\nconst b = 2;\n";
    const res = performFuzzyEdit(file, "const a = 1;", "const a = 42;");
    expect(res.success).toBe(true);
    expect(res.resultText).toBe("const a = 42;\nconst b = 2;\n");
    expect(res.matchType).toBe("exact");
  });

  it("handles CRLF to LF differences seamlessly", () => {
    const file = "function hello() {\r\n  return 1;\r\n}\r\n";
    const oldContent = "function hello() {\n  return 1;\n}";
    const newContent = "function hello() {\n  return 99;\n}";
    const res = performFuzzyEdit(file, oldContent, newContent);
    expect(res.success).toBe(true);
    expect(res.resultText).toContain("return 99;");
  });

  it("normalizes smart typographical quotes and em-dashes", () => {
    const file = 'const msg = "hello world";\nconst note = "test - note";\n';
    const oldContent = 'const msg = “hello world”;\nconst note = "test — note";';
    const newContent = 'const msg = "goodbye world";\nconst note = "new note";';
    const res = performFuzzyEdit(file, oldContent, newContent);
    expect(res.success).toBe(true);
    expect(res.resultText).toContain('const msg = "goodbye world";');
  });

  it("handles fuzzy indentation and whitespace differences", () => {
    const file = "class MyService {\n    doAction() {\n        console.log(1);\n    }\n}\n";
    const oldContent = "  doAction() {\n    console.log(1);\n  }";
    const newContent = "  doAction() {\n    console.log(2);\n  }";
    const res = performFuzzyEdit(file, oldContent, newContent);
    expect(res.success).toBe(true);
    expect(res.resultText).toContain("console.log(2);");
  });

  it("applies loose unified diffs with line offset fuzz", () => {
    const file = "line 1\nline 2\nline 3\nline 4\nline 5\n";
    const patch = "@@ -10,3 +10,3 @@\n line 2\n-line 3\n+line 3 modified\n line 4\n";
    const res = applyLooseUnifiedDiff(file, patch);
    expect(res.success).toBe(true);
    expect(res.resultText).toContain("line 3 modified");
  });
});

describe("Bash Interceptor Safety and Redirection", () => {
  it("blocks catastrophic commands like rm -rf /", () => {
    const res = checkBashInterception("rm -rf /");
    expect(res.intercepted).toBe(true);
    expect(res.isSafetyBlock).toBe(true);
    expect(res.message).toContain("SECURITY BLOCK");
  });

  it("intercepts sed -i and advises to use edit tool", () => {
    const res = checkBashInterception("sed -i 's/foo/bar/g' app.ts");
    expect(res.intercepted).toBe(true);
    expect(res.isSafetyBlock).toBe(false);
    expect(res.suggestedTool).toBe("edit");
  });

  it("intercepts echo > file redirection and advises to use write tool", () => {
    const res = checkBashInterception('echo "hello world" > test.txt');
    expect(res.intercepted).toBe(true);
    expect(res.suggestedTool).toBe("write");
  });

  it("allows normal build and test commands", () => {
    const res = checkBashInterception("pnpm build && pnpm test");
    expect(res.intercepted).toBe(false);
  });
});

describe("Cognitive Memory Engine", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "const-mem-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("retains and recalls project memories", async () => {
    const retainRes = await executeRetain(
      [
        {
          content: "Use Tailwind CSS v3 tokens for primary accents #ff7a00",
          context: "Design system specs",
          scope: "project",
        },
      ],
      tmpDir
    );
    expect(retainRes.success).toBe(true);

    const recallRes = await executeRecall("Tailwind CSS accents", tmpDir);
    expect(recallRes.total).toBe(1);
    expect(recallRes.results[0]?.content).toContain("Tailwind CSS v3");

    const reflectRes = await executeReflect("Design tokens", tmpDir);
    expect(reflectRes.memoriesCount).toBe(1);
  });
});

describe("In-Memory Eval REPL", () => {
  it("evaluates JavaScript with persistent variables in the same session", async () => {
    const res1 = await executeEval(
      { code: "const myScore = 40 + 2; myScore;", sessionId: "test-sess" },
      process.cwd()
    );
    expect(res1.isError).toBe(false);
    expect(res1.value).toBe("42");

    const res2 = await executeEval(
      { code: "myScore * 2;", sessionId: "test-sess" },
      process.cwd()
    );
    expect(res2.isError).toBe(false);
    expect(res2.value).toBe("84");
  });
});

describe("Output Spooler", () => {
  it("leaves small output inline", async () => {
    const res = await spoolLargeOutput("short output", process.cwd());
    expect(res.isSpooled).toBe(false);
    expect(res.output).toBe("short output");
  });

  it("spools large output and returns summary with artifact pointer", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "const-spool-test-"));
    const bigOutput = "A".repeat(60000);
    const res = await spoolLargeOutput(bigOutput, tmpDir);
    expect(res.isSpooled).toBe(true);
    expect(res.output).toContain("OUTPUT TRUNCATED");
    expect(res.artifactPath).toBeTruthy();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
