/** Shared by the permission gate and native executor so aliases cannot bypass review. */
export function normalizeToolName(name: string): string {
  const normalized = name.toLowerCase().replace(/[-_]/g, "");
  // Legacy spellings accepted by the agent's permission interface.
  if (normalized === "writetofile") return "writefile";
  if (normalized === "replacefilecontent") return "replaceinfile";
  return normalized;
}

export function getToolActionKind(name: string): "terminal" | "python" | "file_mutation" | undefined {
  switch (normalizeToolName(name)) {
    case "bash": case "powershell": case "pwsh": case "exec":
    case "terminal": case "sh": case "runcommand":
      return "terminal";
    case "runpython": case "python": case "py": case "pythoneval":
      return "python";
    case "write": case "writefile": case "edit": case "editfile":
    case "replaceinfile": case "applypatch": case "patch":
    case "mkdir": case "makedir": case "createdirectory":
      return "file_mutation";
    default:
      return undefined;
  }
}
