import fs from "node:fs/promises";
import path from "node:path";

/** Ordered, asynchronous JSONL batches. Flush at run end and before quitting. */
export class TranscriptWriter {
  private pending = new Map<string, string[]>();
  private writes = new Map<string, Promise<void>>();
  private timer?: ReturnType<typeof setTimeout>;
  private bufferedChars = 0;
  private closed = false;

  append(file: string, event: Record<string, unknown>): void {
    if (this.closed) return;
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + "\n";
    const lines = this.pending.get(file) ?? [];
    lines.push(line);
    this.pending.set(file, lines);
    this.bufferedChars += line.length;
    if (this.bufferedChars >= 64 * 1024) void this.flush();
    else if (!this.timer) this.timer = setTimeout(() => { void this.flush(); }, 50);
  }

  close(): Promise<void> {
    this.closed = true;
    return this.flush();
  }

  async flush(file?: string): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    const targets = file ? [file] : [...new Set([...this.pending.keys(), ...this.writes.keys()])];
    const operations = targets.map(target => {
      const lines = this.pending.get(target);
      if (!lines) return this.writes.get(target);
      this.pending.delete(target);
      const batch = lines.join("");
      this.bufferedChars -= batch.length;
      const previous = this.writes.get(target) ?? Promise.resolve();
      const write = previous.then(async () => {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.appendFile(target, batch, "utf8");
      }).catch(error => { console.warn("[ConversationDB] Failed to append transcript events:", error); });
      this.writes.set(target, write);
      void write.then(() => { if (this.writes.get(target) === write) this.writes.delete(target); });
      return write;
    });
    // A targeted flush must not strand other conversations' pending events.
    if (this.pending.size && !this.timer) this.timer = setTimeout(() => { void this.flush(); }, 50);
    await Promise.all(operations);
  }
}
