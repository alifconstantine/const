import type { IPty, IPtyForkOptions, IWindowsPtyForkOptions } from "node-pty";

type SpawnOptions = IPtyForkOptions & IWindowsPtyForkOptions;
type Spawner = (file: string, args: string[], options: SpawnOptions) => IPty;
type Owner = { id: string; conversationId: string };
type Session = Owner & { cwd: string; process: IPty; output: string; sequence: number };
type CreateOptions = Owner & { cwd: string | (() => Promise<string>); shell?: string; cols?: number; rows?: number };
type CreatedTerminal = { success: true; id: string; cwd: string; replay: string; sequence: number };

function dimension(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1000 ? value : fallback;
}

export function terminalCommand(shell: string | undefined, platform = process.platform, env = process.env) {
  const file = shell || (platform === "win32" ? env.ComSpec || env.COMSPEC || "powershell.exe" : env.SHELL || "/bin/bash");
  // ConPTY supplies the console that cmd/PowerShell need. No shell quoting,
  // nested command interpreter, or non-interactive stdio pipes are involved.
  return { file, args: platform === "win32" ? [] : ["-i"] };
}

export class TerminalSessions {
  private sessions = new Map<string, Session>();
  private pending = new Map<string, { conversationId: string; state: { cancelled: boolean }; promise: Promise<CreatedTerminal> }>();

  constructor(
    private events: {
      data: (payload: Owner & { data: string; sequence: number }) => void;
      exit: (payload: Owner & { code: number }) => void;
    },
    // Load the native addon on demand, so a missing addon produces a visible
    // terminal creation error instead of preventing the desktop from starting.
    private loadSpawner: () => Promise<Spawner> = async () => (await import("node-pty")).spawn,
    private terminate: (terminal: IPty) => void = terminal => terminal.kill(),
  ) {}

  async create(options: CreateOptions) {
    const { id, conversationId } = options;
    const existing = this.sessions.get(id) || this.pending.get(id);
    if (existing) {
      if (existing.conversationId !== conversationId) throw new Error("Terminal belongs to another conversation");
      if ("promise" in existing) return existing.promise;
      return { success: true as const, id, cwd: existing.cwd, replay: existing.output, sequence: existing.sequence };
    }
    const state = { cancelled: false };
    const promise = (async () => {
      const cwd = typeof options.cwd === "string" ? options.cwd : await options.cwd();
      if (state.cancelled) throw new Error("Terminal creation was cancelled");
      const spawn = await this.loadSpawner();
      if (state.cancelled) throw new Error("Terminal creation was cancelled");
      const { file, args } = terminalCommand(options.shell);
      const terminal = spawn(file, args, {
        name: "xterm-256color", cwd,
        cols: dimension(options.cols, 80), rows: dimension(options.rows, 24),
        env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
      });
      const session = { id, conversationId, cwd, process: terminal, output: "", sequence: 0 };
      this.sessions.set(id, session);
      terminal.onData(data => {
        if (this.sessions.get(id) !== session) return;
        session.output = (session.output + data).slice(-65_536);
        this.events.data({ id, conversationId, data, sequence: ++session.sequence });
      });
      terminal.onExit(({ exitCode }) => {
        if (this.sessions.get(id) !== session) return;
        this.sessions.delete(id);
        this.events.exit({ id, conversationId, code: exitCode });
      });
      return { success: true as const, id, cwd, replay: session.output, sequence: session.sequence };
    })();
    const pending = { conversationId, state, promise };
    this.pending.set(id, pending);
    try { return await pending.promise; }
    finally { if (this.pending.get(id) === pending) this.pending.delete(id); }
  }

  write({ id, conversationId, data }: Owner & { data: string }): boolean {
    const session = this.sessions.get(id);
    if (session?.conversationId !== conversationId) return false;
    session.process.write(data);
    return true;
  }

  resize({ id, conversationId, cols, rows }: Owner & { cols: number; rows: number }): boolean {
    const session = this.sessions.get(id);
    if (session?.conversationId !== conversationId || !Number.isSafeInteger(cols) || !Number.isSafeInteger(rows) || cols < 1 || rows < 1 || cols > 1000 || rows > 1000) return false;
    if (session.process.cols !== cols || session.process.rows !== rows) session.process.resize(cols, rows);
    return true;
  }

  destroy(id: string, conversationId: string): boolean {
    const session = this.sessions.get(id);
    const pending = this.pending.get(id);
    if (pending?.conversationId === conversationId) pending.state.cancelled = true;
    if (session?.conversationId !== conversationId) return !!pending && pending.conversationId === conversationId;
    this.sessions.delete(id);
    try { this.terminate(session.process); } catch { /* Already exited. */ }
    return true;
  }

  destroyAll(): void {
    for (const pending of this.pending.values()) pending.state.cancelled = true;
    for (const session of this.sessions.values()) this.destroy(session.id, session.conversationId);
  }
}
