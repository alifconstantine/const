import type { ComputerSnapshot } from "./computer-types";

export class ComputerSnapshotStore {
  private entries: Array<{ session: string; aliases: string[]; snapshot: ComputerSnapshot; time: number }> = [];

  constructor(private readonly now = Date.now, private readonly maxAgeMs = 120_000, private readonly maxEntries = 32) {}

  remember(session: string, query: string, snapshot: ComputerSnapshot): void {
    this.prune();
    this.entries = this.entries.filter(entry => !(entry.session === session && entry.snapshot.app.pid === snapshot.app.pid && entry.snapshot.windowId === snapshot.windowId));
    this.entries.push({
      session,
      aliases: [query, snapshot.app.name, snapshot.app.bundleId, `pid:${snapshot.app.pid}`, String(snapshot.app.pid)].filter((alias): alias is string => Boolean(alias)).map(alias => alias.toLowerCase()),
      snapshot: { ...snapshot, screenshotPngBase64: null },
      time: this.now(),
    });
    this.prune();
  }

  current(session: string, app: string, windowId?: number | null, windowIndex?: number | null): ComputerSnapshot | undefined {
    this.prune();
    return [...this.entries].reverse().find(entry => entry.session === session && entry.aliases.includes(app.toLowerCase()) &&
      (windowId == null || entry.snapshot.windowId === windowId) &&
      (windowIndex == null || (entry.snapshot.windowIndex ?? 0) === windowIndex))?.snapshot;
  }

  clear(session?: string): void {
    this.entries = session === undefined ? [] : this.entries.filter(entry => entry.session !== session);
  }

  private prune(): void {
    const cutoff = this.now() - this.maxAgeMs;
    this.entries = this.entries.filter(entry => entry.time > cutoff).slice(-this.maxEntries);
  }
}
