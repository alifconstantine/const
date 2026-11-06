export interface BashInterceptionResult {
  /** If true, the command should be intercepted/blocked */
  intercepted: boolean;
  /** Whether this is a fatal safety block vs a workflow recommendation */
  isSafetyBlock: boolean;
  /** Explanation and actionable instruction for the model */
  message?: string;
  /** Suggested native tool to use instead */
  suggestedTool?: string;
}

/**
 * Patterns of catastrophic commands that must be rejected immediately to protect the user's system.
 */
const CATASTROPHIC_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  {
    regex: /rm\s+-(?:r[fv]|f[rv]|r|f)*\s+(?:\/|~|\$HOME|\.\/|\*|\.\/\*)(?:\s|$)/i,
    reason: "Destructive recursive deletion of root, home, or entire working directory is blocked.",
  },
  {
    regex: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: "Fork bomb detected and blocked.",
  },
  {
    regex: /mkfs(?:\.\w+)?\s+/i,
    reason: "Filesystem format command blocked.",
  },
  {
    regex: />\s*\/dev\/sd[a-z]/i,
    reason: "Direct write to raw storage disk device blocked.",
  },
];

/**
 * Patterns of shell commands that should be redirected to specialized native tools
 * to improve reliability, speed, and token efficiency (inspired by oh-my-pi).
 */
const REDIRECTION_RULES: Array<{
  regex: RegExp;
  suggestedTool: string;
  message: string;
}> = [
  {
    regex: /^\s*sed\s+(?:-i|--in-place)\s+/i,
    suggestedTool: "edit",
    message: "Use the native 'edit' tool instead of 'sed -i'. It provides preview, mutation tracking, and undo support.",
  },
  {
    regex: /^\s*perl\s+.*-i(?:\s|$)/i,
    suggestedTool: "edit",
    message: "Use the native 'edit' tool instead of 'perl -i'.",
  },
  {
    regex: /^\s*awk\s+.*-i\s+inplace/i,
    suggestedTool: "edit",
    message: "Use the native 'edit' tool instead of 'awk -i inplace'.",
  },
  {
    // Writing/appending to a file via echo/cat redirection
    regex: /^\s*(?:echo|printf|cat\s*<<)\s+.*(?:>|>>)\s*([^\s|&;]+)\s*$/s,
    suggestedTool: "write",
    message: "Use the native 'write' or 'edit' tool instead of shell redirection (echo/cat > file). It handles encoding, parent directory creation, and rollback safety.",
  },
  {
    // Standalone cat on a single file without pipe or flags
    regex: /^\s*cat\s+([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9_]+)\s*$/,
    suggestedTool: "read",
    message: "Use the native 'read' tool instead of 'cat'. It handles line ranges, progressive truncation, and token limits properly.",
  },
];

/**
 * Inspects a shell command before execution.
 * Returns interception guidance if the command is unsafe or better served by a dedicated tool.
 */
export function checkBashInterception(command: string, shell: "bash" | "powershell" = "bash"): BashInterceptionResult {
  if (!command || !command.trim()) {
    return { intercepted: false, isSafetyBlock: false };
  }

  const trimmed = command.trim();

  if (hasDetachedShellCommand(trimmed, shell)) return {
    intercepted: true, isSafetyBlock: false, suggestedTool: "bash",
    message: "Run the process in the foreground with async: true on the shell tool. Shell '&', nohup, disown, Start-Process and Start-Job bypass task ownership and cancellation.",
  };

  // 1. Check catastrophic patterns
  for (const item of CATASTROPHIC_PATTERNS) {
    if (item.regex.test(trimmed)) {
      return {
        intercepted: true,
        isSafetyBlock: true,
        message: `[SECURITY BLOCK]: Command rejected. ${item.reason}\nCommand: '${trimmed}'`,
      };
    }
  }

  // 2. Do not intercept if command is part of a complex pipeline or chained script
  if (trimmed.includes(" | ") || trimmed.includes(" || ") || (trimmed.includes(" && ") && !trimmed.startsWith("echo "))) {
    return { intercepted: false, isSafetyBlock: false };
  }

  // 3. Check helpful redirection rules
  for (const rule of REDIRECTION_RULES) {
    if (rule.regex.test(trimmed)) {
      return {
        intercepted: true,
        isSafetyBlock: false,
        message: `[TOOL RECOMMENDATION]: ${rule.message}\nSuggested tool: '${rule.suggestedTool}'.`,
        suggestedTool: rule.suggestedTool,
      };
    }
  }

  return { intercepted: false, isSafetyBlock: false };
}

function hasDetachedShellCommand(command: string, shell: "bash" | "powershell"): boolean {
  let quote = "";
  let visible = "";
  const heredocs: Array<{ delimiter: string; tabs: boolean; quoted: boolean }> = [];
  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;
    if (char === "\\" && quote !== "'") { i++; continue; }
    if (shell === "bash" && quote !== "'" && char === "$" && command[i + 1] === "(" && command[i + 2] !== "(") {
      const end = substitutionEnd(command, i + 2);
      if (hasDetachedShellCommand(command.slice(i + 2, end), shell)) return true;
      i = end;
      continue;
    }
    if (char === "`" && shell === "bash" && quote !== "'") {
      let end = i + 1;
      for (; end < command.length; end++) { if (command[end] === "\\") end++; else if (command[end] === "`") break; }
      if (hasDetachedShellCommand(command.slice(i + 1, end), shell)) return true;
      i = end; continue;
    }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (shell === "bash" && char === "#" && (i === 0 || /[\s;|&()]/.test(command[i - 1]!))) {
      const end = command.indexOf("\n", i);
      i = end < 0 ? command.length : end - 1;
      continue;
    }
    if (shell === "bash" && char === "<" && command[i + 1] === "<" && command[i + 2] !== "<" && command[i - 1] !== "<") {
      const word = heredocWord(command, i + 2);
      if (word) { heredocs.push(word); i = word.end - 1; continue; }
    }
    if (char === "\n" && heredocs.length) {
      for (const heredoc of heredocs.splice(0)) {
        const bodyStart = i + 1;
        let position = bodyStart;
        while (position < command.length) {
          const newline = command.indexOf("\n", position);
          const end = newline < 0 ? command.length : newline;
          const line = command.slice(position, end);
          if ((heredoc.tabs ? line.replace(/^\t+/, "") : line) === heredoc.delimiter) break;
          position = newline < 0 ? command.length : newline + 1;
        }
        const body = command.slice(bodyStart, position);
        // Unquoted heredocs expand substitutions. Check those conservatively;
        // plain embedded-language operators are data, never shell jobs.
        if (!heredoc.quoted && /\$\(|`/.test(body) && hasDetachedShellCommand(body, shell)) return true;
        const newline = command.indexOf("\n", position);
        i = newline < 0 ? command.length : newline;
      }
      visible += "\n"; continue;
    }
    if (char === "&" && ![">", "&", "|"].includes(command[i - 1] || "") && command[i + 1] !== "&" && command[i + 1] !== ">") {
      if (shell !== "powershell" || !/(?:^|[;|\n(])\s*$/.test(command.slice(0, i))) return true;
    }
    visible += char;
  }
  return /\b(?:nohup|disown|Start-Process|Start-Job|Start-ThreadJob)\b/i.test(visible);
}

function heredocWord(command: string, offset: number): { delimiter: string; tabs: boolean; quoted: boolean; end: number } | undefined {
  let end = offset;
  const tabs = command[end] === "-";
  if (tabs) end++;
  while (/[ \t]/.test(command[end] || "\n")) end++;
  let delimiter = "", quote = "", quoted = false;
  for (; end < command.length; end++) {
    const char = command[end]!;
    if (char === "\\" && quote !== "'") { quoted = true; delimiter += command[++end] || ""; continue; }
    if (quote) { if (char === quote) quote = ""; else delimiter += char; continue; }
    if (char === "'" || char === '"') { quoted = true; quote = char; continue; }
    if (/[\s;&|<>()]/.test(char)) break;
    delimiter += char;
  }
  return (delimiter || quoted) && !quote ? { delimiter, tabs, quoted, end } : undefined;
}

function substitutionEnd(command: string, offset: number): number {
  let depth = 1, quote = "";
  for (let index = offset; index < command.length; index++) {
    const char = command[index]!;
    if (char === "\\" && quote !== "'") { index++; continue; }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "(") depth++;
    if (char === ")" && --depth === 0) return index;
  }
  return command.length;
}
