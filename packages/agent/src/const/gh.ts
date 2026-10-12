import { spawn } from "node:child_process";

export interface GhToolOptions {
  op:
    | "pr_diff"
    | "pr_checkout"
    | "run_watch"
    | "search_issues"
    | "search_prs"
    | "search_code"
    | "repo_view";
  repo?: string;
  pr?: string | number;
  query?: string;
  limit?: number;
  run?: string;
}

export interface GhResult {
  success: boolean;
  output: string;
  isError: boolean;
}

function runCommand(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf-8")));
    child.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));
    child.on("error", (err) => resolve({ stdout: "", stderr: err.message, exitCode: 1 }));
  });
}

/**
 * Integrated GitHub operations (PR diffs, checkout, CI workflow watch, issues/prs search).
 * Inspired by oh-my-pi's GithubTool.
 */
export async function executeGhTool(
  options: GhToolOptions,
  workspacePath: string,
  signal?: AbortSignal
): Promise<GhResult> {
  const { op, repo, pr, query = "", limit = 10, run } = options;

  // 1. Try using GitHub CLI (gh)
  const ghCheck = await runCommand("gh", ["--version"], workspacePath);
  const hasGhCli = ghCheck.exitCode === 0;

  if (hasGhCli) {
    let ghArgs: string[] = [];

    switch (op) {
      case "pr_diff": {
        const prTarget = pr ? String(pr) : "";
        if (!prTarget) {
          return { success: false, output: "Error: Missing 'pr' number or URL.", isError: true };
        }
        ghArgs = ["pr", "diff", prTarget, "--color", "never"];
        if (repo) ghArgs.push("--repo", repo);
        break;
      }

      case "pr_checkout": {
        const prTarget = pr ? String(pr) : "";
        if (!prTarget) {
          return { success: false, output: "Error: Missing 'pr' number to checkout.", isError: true };
        }
        ghArgs = ["pr", "checkout", prTarget];
        if (repo) ghArgs.push("--repo", repo);
        break;
      }

      case "run_watch": {
        ghArgs = ["run", "list", "--limit", String(limit)];
        if (repo) ghArgs.push("--repo", repo);
        if (run) ghArgs = ["run", "view", String(run)];
        break;
      }

      case "search_issues": {
        ghArgs = ["search", "issues", query, "--limit", String(limit)];
        if (repo) ghArgs.push("--repo", repo);
        break;
      }

      case "search_prs": {
        ghArgs = ["search", "prs", query, "--limit", String(limit)];
        if (repo) ghArgs.push("--repo", repo);
        break;
      }

      case "search_code": {
        ghArgs = ["search", "code", query, "--limit", String(limit)];
        if (repo) ghArgs.push("--repo", repo);
        break;
      }

      case "repo_view": {
        ghArgs = ["repo", "view"];
        if (repo) ghArgs.push(repo);
        break;
      }

      default:
        return { success: false, output: `Unsupported GitHub operation '${op}'.`, isError: true };
    }

    const { stdout, stderr, exitCode } = await runCommand("gh", ghArgs, workspacePath);
    const out = stdout.trim() || stderr.trim();
    return {
      success: exitCode === 0,
      output: out || `Command 'gh ${ghArgs.join(" ")}' finished with exit code ${exitCode}.`,
      isError: exitCode !== 0,
    };
  }

  // 2. Fallback to GitHub REST API via fetch if token exists
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    return {
      success: false,
      output: "GitHub CLI ('gh') is not installed, and neither GITHUB_TOKEN nor GH_TOKEN is set in the environment. Please install GitHub CLI or provide a token.",
      isError: true,
    };
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "const-desktop-agent",
    };

    if (op === "search_issues" || op === "search_prs") {
      const typeQualifier = op === "search_prs" ? "type:pr" : "type:issue";
      const q = encodeURIComponent(`${query} ${repo ? `repo:${repo}` : ""} ${typeQualifier}`.trim());
      const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=${limit}`, { headers });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.message || `API error ${res.status}`);

      const items = (data.items || []).map(
        (it: any) => `#${it.number} [${it.state}] ${it.title} (${it.html_url})`
      );
      return {
        success: true,
        output: items.length > 0 ? items.join("\n") : "No results found.",
        isError: false,
      };
    }

    if (op === "repo_view" && repo) {
      const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.message || `API error ${res.status}`);
      return {
        success: true,
        output: `Repository: ${data.full_name}\nDescription: ${data.description || "N/A"}\nStars: ${data.stargazers_count} | Forks: ${data.forks_count}\nURL: ${data.html_url}`,
        isError: false,
      };
    }

    return {
      success: false,
      output: `Operation '${op}' requires the GitHub CLI ('gh') to be installed locally.`,
      isError: true,
    };
  } catch (err: any) {
    return {
      success: false,
      output: `GitHub API request failed: ${err.message}`,
      isError: true,
    };
  }
}
