import { execFile } from "node:child_process";
import path from "node:path";
import fsSync from "node:fs";

export interface GitStatusResult {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: Array<{ path: string; status: string }>;
  unstaged: Array<{ path: string; status: string }>;
  untracked: string[];
  clean: boolean;
  formatted: string;
}

export interface GitCommitItem {
  hash: string;
  author: string;
  date: string;
  message: string;
}

function runGit(args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        signal,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const msg = (stderr || stdout || error.message).trim();
          return reject(new Error(`Git command failed (${args.join(" ")}): ${msg}`));
        }
        resolve(stdout);
      }
    );
  });
}

/**
 * Get structured Git workspace status
 */
export async function executeGitStatus(
  workspaceRoot: string,
  signal?: AbortSignal
): Promise<GitStatusResult> {
  const raw = await runGit(["status", "--porcelain=v1", "-b"], workspaceRoot, signal);
  const lines = raw.split(/\r?\n/).filter(Boolean);

  let branch = "HEAD";
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;

  const staged: Array<{ path: string; status: string }> = [];
  const unstaged: Array<{ path: string; status: string }> = [];
  const untracked: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // Branch header: ## main...origin/main [ahead 1, behind 2]
      const branchInfo = line.slice(3).trim();
      const parts = branchInfo.split("...");
      branch = parts[0] || "HEAD";
      if (parts[1]) {
        const upParts = parts[1].split(" ");
        upstream = upParts[0];
        const bracket = branchInfo.match(/\[(.*?)\]/);
        if (bracket && bracket[1]) {
          const aheadMatch = bracket[1].match(/ahead (\d+)/);
          const behindMatch = bracket[1].match(/behind (\d+)/);
          if (aheadMatch && aheadMatch[1]) ahead = parseInt(aheadMatch[1], 10);
          if (behindMatch && behindMatch[1]) behind = parseInt(behindMatch[1], 10);
        }
      }
      continue;
    }

    if (line.startsWith("?? ")) {
      untracked.push(line.slice(3).trim());
      continue;
    }

    const indexCode = line[0];
    const workTreeCode = line[1];
    const filePath = line.slice(3).trim();

    if (indexCode && indexCode !== " " && indexCode !== "?") {
      staged.push({ path: filePath, status: indexCode });
    }
    if (workTreeCode && workTreeCode !== " " && workTreeCode !== "?") {
      unstaged.push({ path: filePath, status: workTreeCode });
    }
  }

  const clean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

  const summaryLines: string[] = [
    `[git_status] Branch: ${branch}${upstream ? ` (tracking ${upstream})` : ""}`,
  ];

  if (ahead > 0 || behind > 0) {
    summaryLines.push(`  Sync: ${ahead} commit(s) ahead, ${behind} commit(s) behind`);
  }

  if (clean) {
    summaryLines.push("  Working tree clean (no modified, staged, or untracked files).");
  } else {
    if (staged.length > 0) {
      summaryLines.push(`  Staged changes (${staged.length}):`);
      staged.forEach((s) => summaryLines.push(`    [${s.status}] ${s.path}`));
    }
    if (unstaged.length > 0) {
      summaryLines.push(`  Unstaged changes (${unstaged.length}):`);
      unstaged.forEach((u) => summaryLines.push(`    [${u.status}] ${u.path}`));
    }
    if (untracked.length > 0) {
      summaryLines.push(`  Untracked files (${untracked.length}):`);
      untracked.slice(0, 20).forEach((u) => summaryLines.push(`    [?] ${u}`));
      if (untracked.length > 20) {
        summaryLines.push(`    ...and ${untracked.length - 20} more files`);
      }
    }
  }

  return {
    branch,
    upstream,
    ahead,
    behind,
    staged,
    unstaged,
    untracked,
    clean,
    formatted: summaryLines.join("\n"),
  };
}

/**
 * Get unified git diff
 */
export async function executeGitDiff(
  options: {
    staged?: boolean;
    file?: string;
    commit?: string;
  },
  workspaceRoot: string,
  signal?: AbortSignal
): Promise<string> {
  const args = ["diff"];
  if (options.staged) {
    args.push("--staged");
  }
  if (options.commit) {
    args.push(options.commit);
  }
  if (options.file) {
    args.push("--", options.file);
  }

  const diffOutput = await runGit(args, workspaceRoot, signal);
  if (!diffOutput.trim()) {
    return options.staged
      ? "[git_diff] No staged changes."
      : "[git_diff] No unstaged changes in working tree.";
  }

  const previewLimit = 40000;
  if (diffOutput.length > previewLimit) {
    return `[git_diff] (Truncated):\n${diffOutput.slice(0, previewLimit)}\n\n[... Diff truncated at 40k chars ...]`;
  }

  return `[git_diff]:\n${diffOutput}`;
}

/**
 * Stage and commit changes
 */
export async function executeGitCommit(
  message: string,
  files?: string[],
  workspaceRoot?: string,
  signal?: AbortSignal
): Promise<string> {
  const root = workspaceRoot || process.cwd();
  const trimmedMsg = (message || "").trim();
  if (!trimmedMsg) {
    throw new Error("Commit message cannot be empty.");
  }

  if (files && files.length > 0) {
    await runGit(["add", "--", ...files], root, signal);
  } else {
    await runGit(["add", "-A"], root, signal);
  }

  const commitRes = await runGit(["commit", "-m", trimmedMsg], root, signal);
  return `[git_commit] Successfully committed:\n${commitRes.trim()}`;
}

/**
 * View recent git commit history
 */
export async function executeGitLog(
  maxCount: number = 10,
  workspaceRoot: string = process.cwd(),
  signal?: AbortSignal
): Promise<{ commits: GitCommitItem[]; formatted: string }> {
  const limit = Math.min(Math.max(maxCount, 1), 50);
  const raw = await runGit(
    [
      "log",
      `-n`,
      limit.toString(),
      `--pretty=format:%h|%an|%ad|%s`,
      `--date=relative`,
    ],
    workspaceRoot,
    signal
  );

  const lines = raw.split(/\r?\n/).filter(Boolean);
  const commits: GitCommitItem[] = [];

  for (const line of lines) {
    const [hash, author, date, message] = line.split("|");
    if (hash && author) {
      commits.push({
        hash,
        author,
        date: date || "",
        message: message || "",
      });
    }
  }

  const formattedLines = [
    `[git_log] Latest ${commits.length} commit(s):`,
    ...commits.map((c) => `* ${c.hash} (${c.date}) <${c.author}>: ${c.message}`),
  ];

  return {
    commits,
    formatted: formattedLines.join("\n"),
  };
}
