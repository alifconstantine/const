import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import type { FileMutationRecord } from "./mutation-ledger.js";

export interface ExecuteToolOptions {
  signal?: AbortSignal;
  stepIndex?: number;
  onFileMutation?: (record: FileMutationRecord) => void;
}

// ---------------------------------------------------------------------------
// Shell Configuration & Discovery (aligned with Pi Windows architecture)
// ---------------------------------------------------------------------------

export interface ShellConfig {
  shell: string;
  args: string[];
  type: "bash" | "powershell";
}

let cachedShellConfig: ShellConfig | null = null;

export function getShellConfig(): ShellConfig {
  if (cachedShellConfig) return cachedShellConfig;

  if (process.platform === "win32") {
    // 1. Check Git Bash in standard locations
    const gitBashCandidates = [
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
      "C:\\Program Files\\Git\\bin\\bash.exe",
    ];

    for (const candidate of gitBashCandidates) {
      if (fsSync.existsSync(candidate)) {
        cachedShellConfig = {
          shell: candidate,
          args: ["-c"],
          type: "bash",
        };
        return cachedShellConfig;
      }
    }

    // 2. Fallback to PowerShell
    cachedShellConfig = {
      shell: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"],
      type: "powershell",
    };
    return cachedShellConfig;
  }

  // Unix / macOS: /bin/bash, fallback to sh
  if (fsSync.existsSync("/bin/bash")) {
    cachedShellConfig = {
      shell: "/bin/bash",
      args: ["-c"],
      type: "bash",
    };
    return cachedShellConfig;
  }

  cachedShellConfig = {
    shell: "sh",
    args: ["-c"],
    type: "bash",
  };
  return cachedShellConfig;
}

// ---------------------------------------------------------------------------
// Path Normalization (supports Windows drive formats, Git Bash paths, & ~)
// ---------------------------------------------------------------------------

export function normalizeWindowsShellPath(filePath: string): string {
  if (!filePath || typeof filePath !== "string") return "";
  let clean = filePath.trim().replace(/^["']|["']$/g, "").trim();

  // Convert Git Bash/MSYS2 paths: /d/Code/... or /cygdrive/c/... -> D:\Code\...
  const bashDriveMatch = clean.match(/^\/(?:mnt\/|cygdrive\/)?([a-zA-Z])(?:\/(.*))?$/);
  if (bashDriveMatch) {
    const drive = bashDriveMatch[1]!.toUpperCase();
    const rest = (bashDriveMatch[2] || "").replace(/\//g, "\\");
    return `${drive}:\\${rest}`;
  }

  // Convert bare drive with slash: d/Code/... or D/Code/... -> D:\Code\...
  const bareDriveMatch = clean.match(/^([a-zA-Z])\/(.*)$/);
  if (bareDriveMatch) {
    const drive = bareDriveMatch[1]!.toUpperCase();
    const rest = (bareDriveMatch[2] || "").replace(/\//g, "\\");
    return `${drive}:\\${rest}`;
  }

  // Expand home directory ~
  if (clean === "~" || clean.startsWith("~/") || clean.startsWith("~\\")) {
    const home = os.homedir();
    clean = clean === "~" ? home : path.join(home, clean.slice(2));
  }

  return clean;
}

export function resolveSafePath(rawPath: string, workspacePath: string): string {
  if (!rawPath) return workspacePath;
  const normalized = normalizeWindowsShellPath(rawPath);
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  return path.resolve(workspacePath, normalized);
}

// ---------------------------------------------------------------------------
// Native Tool Definitions (Pi Standard 4 Core Tools + Aliases)
// ---------------------------------------------------------------------------

export interface NativeToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export const CONST_DEFAULT_TOOLS: NativeToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read",
      description:
        "Read the contents of a file. Supports source code, text files, markdown, JSON, images (metadata), and PDF documents with automated text extraction. Optionally specify offset and limit to read specific line ranges.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to read (relative to workspace or absolute).",
          },
          offset: {
            type: "number",
            description: "Line number to start reading from (1-indexed, optional).",
          },
          limit: {
            type: "number",
            description: "Maximum number of lines to read (optional).",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description:
        "Create or overwrite a file with the specified content. Automatically creates any parent directories if they do not exist.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to write (relative to workspace or absolute).",
          },
          content: {
            type: "string",
            description: "The complete content to write into the file.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit",
      description:
        "Edit an existing file by replacing an exact existing text substring (old_content) with new content (new_content). Automatically normalizes CRLF/LF line endings.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to edit.",
          },
          old_content: {
            type: "string",
            description: "The exact existing text chunk to find and replace.",
          },
          new_content: {
            type: "string",
            description: "The new text chunk to insert as replacement.",
          },
        },
        required: ["path", "old_content", "new_content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description:
        "Execute a shell command in the workspace directory (using Git Bash on Windows or bash on Unix). Returns standard output, standard error, and exit status.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash shell command to execute.",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in seconds (defaults to 60).",
          },
        },
        required: ["command"],
      },
    },
  },
];

// Helper argument extractors
function extractPathArg(args: Record<string, any>): string {
  const val =
    args.path ??
    args.file_path ??
    args.filePath ??
    args.filename ??
    args.file ??
    args.targetPath ??
    args.dir ??
    args.directory ??
    "";
  return typeof val === "string" ? normalizeWindowsShellPath(val) : "";
}

function extractContentArg(args: Record<string, any>): string {
  const val =
    args.content ??
    args.contents ??
    args.data ??
    args.text ??
    args.code ??
    args.body ??
    "";
  return typeof val === "string" ? val : JSON.stringify(val, null, 2);
}

function extractCommandArg(args: Record<string, any>): string {
  const val =
    args.command ??
    args.cmd ??
    args.script ??
    args.instruction ??
    args.raw ??
    "";
  return typeof val === "string" ? val.trim() : "";
}

// ---------------------------------------------------------------------------
// PDF Text Extraction Helper (Instant pdftotext with safe fallback)
// ---------------------------------------------------------------------------

async function extractPdfText(
  filePath: string,
  signal?: AbortSignal
): Promise<{ text: string; pages: number }> {
  const shellCfg = getShellConfig();

  // Fast path: If shell is Git Bash, use native pdftotext
  if (shellCfg.type === "bash") {
    try {
      const posixPath = filePath.replace(/\\/g, "/");
      const cmd = `pdftotext "${posixPath}" -`;

      const result = await runProcess(shellCfg.shell, [...shellCfg.args, cmd], {
        cwd: path.dirname(filePath),
        signal,
        timeoutMs: 15000,
      });

      if (result.stdout && result.stdout.trim().length > 0) {
        const text = result.stdout.trim();
        const pages = text.split("\f").filter(Boolean).length || 1;
        return { text, pages };
      }
    } catch {
      // Fallback below
    }
  }

  // Safe Fallback: Streamlined text extraction
  try {
    const buffer = await fs.readFile(filePath);
    const content = buffer.toString("latin1");
    const matches = content.match(/\/Title\s*\(([^)]+)\)|\/Author\s*\(([^)]+)\)/g) || [];
    const info = matches.map((m) => m.replace(/[\/\(\)]/g, "")).join(" | ");
    return {
      text: `[PDF Document: ${path.basename(filePath)}]\n${info ? `Metadata: ${info}\n` : ""}(PDF file is valid on disk. Note: install Git for Windows to enable native high-speed pdftotext extraction).`,
      pages: 1,
    };
  } catch (err: any) {
    throw new Error(`Failed to extract text from PDF: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Process Runner (Pi style: never crashes on non-zero exit codes)
// ---------------------------------------------------------------------------

interface ProcessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; signal?: AbortSignal; timeoutMs?: number }
): Promise<ProcessRunResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      return reject(new Error("Operation cancelled"));
    }

    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    if (options.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutMs);
    }

    const onAbort = () => {
      child.kill();
      reject(new Error("Operation cancelled"));
    };

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
      if (timedOut) {
        return resolve({
          stdout,
          stderr: `${stderr}\n[Command timed out after ${options.timeoutMs! / 1000}s]`,
          exitCode: 124,
        });
      }
      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

// ---------------------------------------------------------------------------
// Tool Execution Router
// ---------------------------------------------------------------------------

export async function executeNativeTool(
  toolName: string,
  args: Record<string, any>,
  workspacePath: string,
  optionsOrSignal?: AbortSignal | ExecuteToolOptions
): Promise<{ result: any; isError: boolean }> {
  try {
    const options: ExecuteToolOptions =
      optionsOrSignal instanceof AbortSignal
        ? { signal: optionsOrSignal }
        : optionsOrSignal || {};
    const signal = options.signal;

    if (signal?.aborted) {
      return { result: "Action cancelled", isError: true };
    }

    const normalizedTool = toolName.toLowerCase().replace(/[-_]/g, "");

    // -----------------------------------------------------------------------
    // Tool: read (aliases: read_file, cat)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "read" ||
      normalizedTool === "readfile" ||
      normalizedTool === "cat"
    ) {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing file path. Please specify the 'path' parameter.",
          isError: true,
        };
      }

      const filePath = resolveSafePath(rawPath, workspacePath);

      try {
        const stat = await fs.stat(filePath);

        // Self-heal: If directory, list its contents
        if (stat.isDirectory()) {
          const entries = await fs.readdir(filePath, { withFileTypes: true });
          const items = entries.map(
            (e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`
          );
          return {
            result: `Path '${filePath}' is a directory, not a file.\nDirectory contents:\n${items.join("\n")}`,
            isError: false,
          };
        }

        const ext = path.extname(filePath).toLowerCase();

        // 1. PDF File Extraction
        if (ext === ".pdf") {
          try {
            const { text, pages } = await extractPdfText(filePath, signal);
            const previewLimit = 35000;
            const preview =
              text.length > previewLimit
                ? text.slice(0, previewLimit) +
                  `\n\n[... Document truncated at ${previewLimit} characters (Total: ${text.length} chars, ~${pages} pages) ...]`
                : text;

            return {
              result: `[PDF Document: ${path.basename(filePath)} | ${pages} Pages | ${(stat.size / 1024).toFixed(1)} KB]\n\n${preview}`,
              isError: false,
            };
          } catch (pdfErr: any) {
            return {
              result: `Failed to extract PDF text (${path.basename(filePath)}): ${pdfErr.message}`,
              isError: true,
            };
          }
        }

        // 2. Image Files
        const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".ico"];
        if (imageExtensions.includes(ext)) {
          return {
            result: `[Image File: ${path.basename(filePath)} | Format: ${ext.slice(1).toUpperCase()} | Size: ${(stat.size / 1024).toFixed(1)} KB]\nPath: ${filePath}\n(Image file verified on disk).`,
            isError: false,
          };
        }

        // 3. Regular Text & Code Files
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split(/\r?\n/);

        // Handle offset & limit (1-indexed)
        const offset = typeof args.offset === "number" && args.offset > 0 ? args.offset - 1 : 0;
        const limit = typeof args.limit === "number" && args.limit > 0 ? args.limit : lines.length;

        const selectedLines = lines.slice(offset, offset + limit);
        const slicedText = selectedLines.join("\n");

        const maxChars = 50000;
        if (slicedText.length > maxChars) {
          const truncated =
            slicedText.slice(0, maxChars) +
            `\n\n[... Content truncated at ${maxChars} characters (Total: ${lines.length} lines) ...]`;
          return { result: truncated, isError: false };
        }

        return { result: slicedText, isError: false };
      } catch (err: any) {
        if (err.code === "ENOENT") {
          const parentDir = path.dirname(filePath);
          let suggestion = "";
          try {
            if (fsSync.existsSync(parentDir)) {
              const files = await fs.readdir(parentDir);
              suggestion =
                `\nFiles available in '${parentDir}':\n` +
                files.slice(0, 15).map((f) => `- ${f}`).join("\n");
            }
          } catch {
            // ignore
          }

          return {
            result: `File not found: '${filePath}'. Verify the path.${suggestion}`,
            isError: true,
          };
        }
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // Tool: write (aliases: write_file)
    // -----------------------------------------------------------------------
    if (normalizedTool === "write" || normalizedTool === "writefile") {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing file path. Please specify the 'path' parameter.",
          isError: true,
        };
      }
      const filePath = resolveSafePath(rawPath, workspacePath);
      const content = extractContentArg(args);

      // Auto-create parent directories (Pi standard)
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Pre-flight snapshot check for rollback
      let previousContent: string | null = null;
      let operation: "create" | "modify" = "create";
      if (fsSync.existsSync(filePath)) {
        try {
          previousContent = await fs.readFile(filePath, "utf-8");
          operation = "modify";
        } catch {
          // ignore
        }
      }

      await fs.writeFile(filePath, content, "utf-8");

      const displayPath = path.isAbsolute(rawPath)
        ? filePath
        : path.relative(workspacePath, filePath);

      // Record file mutation for rollback ledger
      options.onFileMutation?.({
        id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        stepIndex: options.stepIndex ?? 0,
        operation,
        absolutePath: filePath,
        filePath: filePath,
        targetFile: displayPath || filePath,
        previousContent,
        newContent: content,
        timestamp: Date.now(),
      });

      return {
        result: `File written successfully: ${displayPath} (${content.length} characters)`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: edit (aliases: edit_file, replace_in_file)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "edit" ||
      normalizedTool === "editfile" ||
      normalizedTool === "replaceinfile"
    ) {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing file path. Please specify the 'path' parameter.",
          isError: true,
        };
      }
      const filePath = resolveSafePath(rawPath, workspacePath);

      const oldContent =
        args.old_content ??
        args.oldContent ??
        args.old_text ??
        args.oldText ??
        args.old_string ??
        args.target_content ??
        "";
      const newContent =
        args.new_content ??
        args.newContent ??
        args.new_text ??
        args.newText ??
        args.replacement_content ??
        "";

      if (!oldContent) {
        return {
          result: "Error: Missing 'old_content' parameter to replace.",
          isError: true,
        };
      }

      const fileText = await fs.readFile(filePath, "utf-8");

      const editDisplayPath = path.isAbsolute(rawPath)
        ? filePath
        : path.relative(workspacePath, filePath);

      // 1. Direct match
      if (fileText.includes(oldContent)) {
        const updated = fileText.replace(oldContent, newContent);
        await fs.writeFile(filePath, updated, "utf-8");

        options.onFileMutation?.({
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: updated,
          timestamp: Date.now(),
        });

        return {
          result: `Successfully edited '${path.basename(filePath)}'. Replaced ${oldContent.length} characters with ${newContent.length} characters.`,
          isError: false,
        };
      }

      // 2. CRLF <-> LF tolerant matching
      const normalizedFileText = fileText.replace(/\r\n/g, "\n");
      const normalizedOld = oldContent.replace(/\r\n/g, "\n");

      if (normalizedFileText.includes(normalizedOld)) {
        const updated = normalizedFileText.replace(normalizedOld, newContent.replace(/\r\n/g, "\n"));
        await fs.writeFile(filePath, updated, "utf-8");

        options.onFileMutation?.({
          id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stepIndex: options.stepIndex ?? 0,
          operation: "modify",
          absolutePath: filePath,
          filePath: filePath,
          targetFile: editDisplayPath || filePath,
          previousContent: fileText,
          newContent: updated,
          timestamp: Date.now(),
        });

        return {
          result: `Successfully edited '${path.basename(filePath)}' (line-endings normalized).`,
          isError: false,
        };
      }

      return {
        result: `Error: 'old_content' not found in '${path.basename(filePath)}'. Verify exact match including whitespace and indentation.`,
        isError: true,
      };
    }

    // -----------------------------------------------------------------------
    // Tool: bash (aliases: run_command, exec, terminal, sh)
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "bash" ||
      normalizedTool === "runcommand" ||
      normalizedTool === "exec" ||
      normalizedTool === "terminal" ||
      normalizedTool === "sh"
    ) {
      let cmd = extractCommandArg(args);
      if (!cmd) {
        return {
          result: "Error: No command provided to execute.",
          isError: true,
        };
      }

      // Strip redundant powershell -Command wrappers if passed
      if (cmd.startsWith("powershell -Command ") || cmd.startsWith("powershell.exe -Command ")) {
        cmd = cmd.replace(/^powershell(?:\.exe)?\s+-Command\s+["']?(.*?)["']?$/s, "$1");
      }

      const shellCfg = getShellConfig();
      const timeoutMs = (typeof args.timeout === "number" ? args.timeout : 60) * 1000;

      const { stdout, stderr, exitCode } = await runProcess(
        shellCfg.shell,
        [...shellCfg.args, cmd],
        {
          cwd: workspacePath,
          signal,
          timeoutMs,
        }
      );

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;

      // Pi Standard: Non-zero exit code is reported clearly, NOT thrown as fatal error
      if (exitCode !== 0 && exitCode !== null) {
        output += `\n\n[Command exited with code ${exitCode}]`;
      }

      if (!output.trim()) {
        output = "(Command completed with no output)";
      }

      return {
        result: output.trim(),
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Compatibility Aliases: list_dir, ls, dir
    // -----------------------------------------------------------------------
    if (normalizedTool === "listdir" || normalizedTool === "ls" || normalizedTool === "dir") {
      const rawPath = extractPathArg(args);
      const targetDir = rawPath ? resolveSafePath(rawPath, workspacePath) : workspacePath;

      if (!fsSync.existsSync(targetDir)) {
        return {
          result: `Directory not found: '${targetDir}'`,
          isError: true,
        };
      }

      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const formatted = entries
        .map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`)
        .join("\n");

      return {
        result: `Directory: ${targetDir}\n\n${formatted || "(Empty directory)"}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    // Compatibility Aliases: create_directory, mkdir
    // -----------------------------------------------------------------------
    if (
      normalizedTool === "createdirectory" ||
      normalizedTool === "mkdir" ||
      normalizedTool === "makedir"
    ) {
      const rawPath = extractPathArg(args);
      if (!rawPath) {
        return {
          result: "Error: Missing directory path. Please specify the 'path' parameter.",
          isError: true,
        };
      }
      const dirPath = resolveSafePath(rawPath, workspacePath);
      await fs.mkdir(dirPath, { recursive: true });
      return {
        result: `Directory created: ${dirPath}`,
        isError: false,
      };
    }

    return {
      result: `Tool '${toolName}' is not recognized. Available tools: read, write, edit, bash.`,
      isError: true,
    };
  } catch (err: any) {
    return {
      result: `Error executing ${toolName}: ${err.message || String(err)}`,
      isError: true,
    };
  }
}
