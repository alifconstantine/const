import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  executeGitStatus,
  executeGitDiff,
  executeGitLog,
} from "../src/const/git.js";
import { executeNativeTool } from "../src/const/tools.js";

describe("Git Workflow Tools (git_status, git_diff, git_log)", () => {
  const workspaceRoot = path.resolve(__dirname, "../../.."); // d:\Code\Const root

  it("should get git status of the repository", async () => {
    const status = await executeGitStatus(workspaceRoot);
    expect(status.branch).toBeDefined();
    expect(status.formatted).toContain("[git_status]");
  });

  it("should get git log history", async () => {
    const log = await executeGitLog(5, workspaceRoot);
    expect(log.commits.length).toBeGreaterThan(0);
    expect(log.formatted).toContain("[git_log]");
    expect(log.commits[0].hash).toBeDefined();
  });

  it("should get git diff", async () => {
    const diff = await executeGitDiff({}, workspaceRoot);
    expect(typeof diff).toBe("string");
    expect(diff).toContain("[git_diff]");
  });

  it("should route git_status through executeNativeTool router", async () => {
    const res = await executeNativeTool("git_status", {}, workspaceRoot);
    expect(res.isError).toBe(false);
    expect(res.result).toContain("[git_status]");
  });

  it("should route git_log through executeNativeTool router", async () => {
    const res = await executeNativeTool("git_log", { max_count: 3 }, workspaceRoot);
    expect(res.isError).toBe(false);
    expect(res.result).toContain("[git_log]");
  });
});
