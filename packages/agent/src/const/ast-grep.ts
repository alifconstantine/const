import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import ts from "typescript";

export interface AstGrepMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  language?: string;
  metaVariables?: Record<string, string>;
  replacement?: string;
}

export interface AstGrepOptions {
  pattern: string;
  targetPath?: string;
  lang?: string;
  globs?: string;
  rewrite?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface AstGrepResult {
  pattern: string;
  totalMatches: number;
  matches: AstGrepMatch[];
  formatted: string;
}

let cachedAstGrepBinary: string | null = null;

/**
 * Locate the ast-grep / sg native executable (prioritizing direct .exe over .cmd)
 */
export function resolveAstGrepBinary(): string | null {
  if (cachedAstGrepBinary && fsSync.existsSync(cachedAstGrepBinary)) {
    return cachedAstGrepBinary;
  }

  const isWin = process.platform === "win32";
  const exeName = isWin ? "ast-grep.exe" : "ast-grep";
  const sgName = isWin ? "sg.exe" : "sg";

  // 1. Check local node_modules direct executables
  const localCandidates = [
    path.resolve(process.cwd(), "node_modules", "@ast-grep", "cli-win32-x64-msvc", "ast-grep.exe"),
    path.resolve(process.cwd(), "node_modules", "@ast-grep", "cli", exeName),
    path.resolve(process.cwd(), "..", "..", "node_modules", "@ast-grep", "cli-win32-x64-msvc", "ast-grep.exe"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "@ast-grep", "cli", exeName),
  ];

  for (const cand of localCandidates) {
    if (fsSync.existsSync(cand)) {
      cachedAstGrepBinary = cand;
      return cand;
    }
  }

  // 2. Check npm-cache npx installations on Windows
  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const npxDir = path.join(localAppData, "npm-cache", "_npx");
    if (fsSync.existsSync(npxDir)) {
      try {
        const hashes = fsSync.readdirSync(npxDir);
        for (const h of hashes) {
          const msvcCand = path.join(npxDir, h, "node_modules", "@ast-grep", "cli-win32-x64-msvc", "ast-grep.exe");
          if (fsSync.existsSync(msvcCand)) {
            cachedAstGrepBinary = msvcCand;
            return msvcCand;
          }
          const cand = path.join(npxDir, h, "node_modules", "@ast-grep", "cli", "ast-grep.exe");
          if (fsSync.existsSync(cand)) {
            cachedAstGrepBinary = cand;
            return cand;
          }
        }
      } catch {}
    }
  }

  // 3. Check system PATH
  const pathDirs = (process.env.PATH || "").split(path.delimiter);
  for (const dir of pathDirs) {
    const cand = path.join(dir, exeName);
    if (fsSync.existsSync(cand)) {
      cachedAstGrepBinary = cand;
      return cand;
    }
    const sgCand = path.join(dir, sgName);
    if (fsSync.existsSync(sgCand)) {
      cachedAstGrepBinary = sgCand;
      return sgCand;
    }
  }

  // 4. Fallback to node_modules/.bin cmd wrapper
  if (isWin) {
    const cmdCand = path.resolve(process.cwd(), "node_modules", ".bin", "ast-grep.cmd");
    if (fsSync.existsSync(cmdCand)) {
      cachedAstGrepBinary = cmdCand;
      return cmdCand;
    }
  }

  return null;
}

/**
 * Execute AST Grep search using native ast-grep CLI or TS AST fallback
 */
export async function executeAstGrep(
  options: AstGrepOptions,
  workspaceRoot: string
): Promise<AstGrepResult> {
  const { pattern, targetPath = ".", lang, globs, rewrite, limit = 50, signal } = options;

  const binPath = resolveAstGrepBinary();
  const searchTarget = path.isAbsolute(targetPath)
    ? path.relative(workspaceRoot, targetPath) || "."
    : targetPath;

  if (binPath) {
    return new Promise<AstGrepResult>((resolve, reject) => {
      const args = ["run", "--pattern", pattern, "--json=stream"];
      if (lang) {
        args.push("--lang", lang);
      }
      if (globs) {
        args.push("--globs", globs);
      }
      if (rewrite) {
        args.push("--rewrite", rewrite);
      }
      args.push(searchTarget);

      const isCmd = binPath.endsWith(".cmd") || binPath.endsWith(".bat");
      const child = spawn(binPath, args, {
        cwd: workspaceRoot,
        shell: isCmd,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf-8");
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf-8");
      });

      if (signal) {
        const onAbort = () => {
          child.kill();
          reject(new Error("ast_grep operation aborted."));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        child.on("close", () => signal.removeEventListener("abort", onAbort));
      }

      child.on("close", (code) => {
        // ast-grep returns exit code 0 on match found, 1 on no matches
        if (code !== 0 && code !== 1) {
          if (stderr.trim()) {
            return reject(new Error(`ast-grep error (code ${code}): ${stderr.trim()}`));
          }
        }

        const lines = stdout.trim().split("\n").filter(Boolean);
        const matches: AstGrepMatch[] = [];

        for (const line of lines) {
          try {
            const raw = JSON.parse(line);
            const metaVars: Record<string, string> = {};
            if (raw.metaVariables?.single) {
              for (const [k, v] of Object.entries(raw.metaVariables.single as Record<string, any>)) {
                metaVars[k] = v?.text || "";
              }
            }
            if (raw.metaVariables?.multi) {
              for (const [k, v] of Object.entries(raw.metaVariables.multi as Record<string, any>)) {
                if (Array.isArray(v)) {
                  metaVars[k] = v.map((item) => item?.text || "").join(", ");
                }
              }
            }

            matches.push({
              file: raw.file || "",
              line: (raw.range?.start?.line ?? 0) + 1,
              column: (raw.range?.start?.column ?? 0) + 1,
              text: (raw.text || "").trim(),
              language: raw.language,
              metaVariables: Object.keys(metaVars).length > 0 ? metaVars : undefined,
              replacement: raw.replacement,
            });

            if (matches.length >= limit) break;
          } catch {}
        }

        const formatted = formatAstGrepResults(pattern, matches);
        resolve({
          pattern,
          totalMatches: matches.length,
          matches,
          formatted,
        });
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }

  // Fallback: TypeScript AST Pattern Matcher if ast-grep CLI binary is not present
  return runTypeScriptAstGrepFallback(options, workspaceRoot);
}

function formatAstGrepResults(pattern: string, matches: AstGrepMatch[]): string {
  if (matches.length === 0) {
    return `[ast_grep] No matches found for pattern: '${pattern}'`;
  }

  const lines: string[] = [
    `[ast_grep] Found ${matches.length} match${matches.length > 1 ? "es" : ""} for pattern '${pattern}':`,
    "",
  ];

  for (const m of matches) {
    lines.push(`${m.file}:${m.line}:${m.column}`);
    lines.push(`  ${m.text}`);
    if (m.metaVariables && Object.keys(m.metaVariables).length > 0) {
      const vars = Object.entries(m.metaVariables)
        .map(([k, v]) => `$${k} = "${v}"`)
        .join(", ");
      lines.push(`  [MetaVars: ${vars}]`);
    }
    if (m.replacement) {
      lines.push(`  [Rewrite: ${m.replacement}]`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Fallback TypeScript AST matcher for JS/TS projects when native ast-grep binary is not found
 */
async function runTypeScriptAstGrepFallback(
  options: AstGrepOptions,
  workspaceRoot: string
): Promise<AstGrepResult> {
  const { pattern, targetPath = ".", limit = 50 } = options;
  const absPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(workspaceRoot, targetPath);

  const matches: AstGrepMatch[] = [];
  const cleanToken = pattern.replace(/[\$\{\}\(\)\;]/g, " ").trim().split(/\s+/)[0] || "";

  async function scanFile(filePath: string) {
    if (matches.length >= limit) return;
    try {
      const content = await fs.readFile(filePath, "utf-8");
      if (cleanToken && !content.includes(cleanToken)) return;

      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      function visit(node: ts.Node) {
        if (matches.length >= limit) return;
        const text = node.getText(sourceFile);
        if (cleanToken && text.includes(cleanToken) && text.length <= 150) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          matches.push({
            file: path.relative(workspaceRoot, filePath).replace(/\\/g, "/"),
            line: line + 1,
            column: character + 1,
            text: text.trim(),
          });
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    } catch {}
  }

  async function walk(dir: string) {
    if (matches.length >= limit) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "dist") continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          await walk(full);
        } else if (/\.(ts|tsx|js|jsx)$/i.test(ent.name)) {
          await scanFile(full);
        }
      }
    } catch {}
  }

  if (fsSync.existsSync(absPath)) {
    const stat = fsSync.statSync(absPath);
    if (stat.isDirectory()) {
      await walk(absPath);
    } else {
      await scanFile(absPath);
    }
  }

  return {
    pattern,
    totalMatches: matches.length,
    matches,
    formatted: formatAstGrepResults(pattern, matches),
  };
}
