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
export function checkBashInterception(command: string): BashInterceptionResult {
  if (!command || !command.trim()) {
    return { intercepted: false, isSafetyBlock: false };
  }

  const trimmed = command.trim();

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
