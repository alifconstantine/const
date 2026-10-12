import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveAstGrepBinary } from "./ast-grep.js";

export interface AstEditOp {
  pat: string;
  out: string;
}

export interface AstEditOptions {
  ops: AstEditOp[];
  paths: string[];
  dryRun?: boolean;
}

export interface AstEditFileResult {
  path: string;
  replacements: number;
  originalContent: string;
  newContent: string;
}

export interface AstEditResult {
  totalReplacements: number;
  filesTouched: number;
  files: AstEditFileResult[];
  formatted: string;
}

/**
 * Structural syntax code rewriting using ast-grep CLI or resilient AST metavariable engine.
 * Inspired by oh-my-pi's AstEditTool.
 */
export async function executeAstEdit(
  options: AstEditOptions,
  workspacePath: string,
  signal?: AbortSignal
): Promise<AstEditResult> {
  const { ops, paths, dryRun = false } = options;
  const results: AstEditFileResult[] = [];
  let totalReplacements = 0;

  const binPath = resolveAstGrepBinary();

  for (const targetPath of paths) {
    const fullPath = path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(workspacePath, targetPath);

    if (!fsSync.existsSync(fullPath)) continue;

    const stat = await fs.stat(fullPath);
    const targetFiles: string[] = [];

    if (stat.isDirectory()) {
      const entries = await fs.readdir(fullPath, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if ([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go"].includes(ext)) {
            // @ts-ignore Node 20+ recursive readdir provides parentPath
            const p = entry.parentPath ? path.join(entry.parentPath, entry.name) : path.join(fullPath, entry.name);
            targetFiles.push(p);
          }
        }
      }
    } else {
      targetFiles.push(fullPath);
    }

    for (const filePath of targetFiles) {
      if (signal?.aborted) break;

      let content = await fs.readFile(filePath, "utf-8");
      const original = content;
      let fileReplacements = 0;

      for (const op of ops) {
        if (binPath && !dryRun) {
          // Try running native ast-grep rewrite if available
          try {
            await new Promise<void>((resolve, reject) => {
              const isCmd = binPath.endsWith(".cmd") || binPath.endsWith(".bat");
              const rel = path.relative(workspacePath, filePath);
              const child = spawn(
                binPath,
                ["run", "--pattern", op.pat, "--rewrite", op.out, "--update-all", rel],
                { cwd: workspacePath, shell: isCmd, windowsHide: true }
              );
              child.on("close", (code) => (code === 0 ? resolve() : reject()));
              child.on("error", reject);
            });
            const updated = await fs.readFile(filePath, "utf-8");
            if (updated !== content) {
              fileReplacements++;
              content = updated;
            }
            continue;
          } catch {
            // Fall back to metavariable regex engine
          }
        }

        // Metavariable structural fallback: e.g. `$NAME` matches `[a-zA-Z_$][a-zA-Z0-9_$]*`
        const { replaced, count } = performMetavariableRewrite(content, op.pat, op.out);
        if (count > 0) {
          content = replaced;
          fileReplacements += count;
        }
      }

      if (fileReplacements > 0) {
        if (!dryRun) {
          await fs.writeFile(filePath, content, "utf-8");
        }
        totalReplacements += fileReplacements;
        results.push({
          path: path.relative(workspacePath, filePath),
          replacements: fileReplacements,
          originalContent: original,
          newContent: content,
        });
      }
    }
  }

  const formattedLines = [
    `# Structural AST Rewrite Result`,
    `Mode: ${dryRun ? "Dry-run (preview only)" : "Applied to workspace"}`,
    `Total replacements: ${totalReplacements} across ${results.length} file(s).`,
    "",
  ];

  for (const f of results) {
    formattedLines.push(`* ${f.path}: ${f.replacements} pattern replacement(s)`);
  }

  if (results.length === 0) {
    formattedLines.push("No structural pattern matches found across specified paths.");
  }

  return {
    totalReplacements,
    filesTouched: results.length,
    files: results,
    formatted: formattedLines.join("\n"),
  };
}

function performMetavariableRewrite(
  text: string,
  pattern: string,
  template: string
): { replaced: string; count: number } {
  // Convert AST metavariables like $VAR or $$$ARGS into regex capture groups
  const metaVarNames: string[] = [];
  let regexStr = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Metavariables like $NAME
  regexStr = regexStr.replace(/\\\$([A-Z_]+)/g, (_match, name) => {
    metaVarNames.push(name);
    return "([a-zA-Z_$][a-zA-Z0-9_$]*)";
  });

  try {
    const re = new RegExp(regexStr, "g");
    let count = 0;

    const replaced = text.replace(re, (...args) => {
      count++;
      let out = template;
      for (let i = 0; i < metaVarNames.length; i++) {
        const capturedVal = args[i + 1] || "";
        out = out.replace(new RegExp(`\\$${metaVarNames[i]}`, "g"), capturedVal);
      }
      return out;
    });

    return { replaced, count };
  } catch {
    return { replaced: text, count: 0 };
  }
}
