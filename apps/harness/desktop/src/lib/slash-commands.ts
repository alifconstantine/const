export type BuiltinSlashCommandId = "plan" | "goal" | "btw" | "compact";

export interface BuiltinSlashCommand {
  id: BuiltinSlashCommandId;
  command: string;
  title: string;
  description: string;
  descriptionId: string;
  argHint?: string;
  /** If true, selecting the command with no args runs immediately (e.g. /compact). */
  runImmediately?: boolean;
}

export const BUILTIN_SLASH_COMMANDS: BuiltinSlashCommand[] = [
  {
    id: "btw",
    command: "/btw",
    title: "Side chat",
    description: "Ask a quick side question",
    descriptionId: "Tanya cepat di side chat",
  },
  {
    id: "compact",
    command: "/compact",
    title: "Compact",
    description: "Summarize chat to free context",
    descriptionId: "Ringkas chat untuk hemat konteks",
  },
  {
    id: "goal",
    command: "/goal",
    title: "Goal",
    description: "Set a goal to keep pursuing",
    descriptionId: "Tetapkan target untuk dikejar terus",
  },
  {
    id: "plan",
    command: "/plan",
    title: "Plan mode",
    description: "Turn plan mode on",
    descriptionId: "Aktifkan mode rencana baca-saja",
  },
];

export interface ParsedBuiltinSlashCommand {
  id: BuiltinSlashCommandId;
  args: string;
  raw: string;
}

/**
 * Parses a prompt starting with one of the built-in slash commands:
 * `/plan`, `/goal`, `/btw`, or `/compact`.
 */
export function parseBuiltinSlashCommand(input: string): ParsedBuiltinSlashCommand | null {
  const trimmed = (input || "").trim();
  if (!trimmed.startsWith("/")) return null;
  const match = /^\/(plan|goal|btw|compact)(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (!match || !match[1]) return null;
  return {
    id: match[1].toLowerCase() as BuiltinSlashCommandId,
    args: (match[2] || "").trim(),
    raw: trimmed,
  };
}

export function filterBuiltinSlashCommands(query: string): BuiltinSlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return BUILTIN_SLASH_COMMANDS;
  const direct = BUILTIN_SLASH_COMMANDS.filter(
    (cmd) => cmd.id.includes(q) || cmd.title.toLowerCase().includes(q),
  );
  if (direct.length > 0) return direct;
  return BUILTIN_SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.description.toLowerCase().includes(q) ||
      cmd.descriptionId.toLowerCase().includes(q),
  );
}
