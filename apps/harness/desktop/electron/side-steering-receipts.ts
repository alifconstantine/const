import fs from "node:fs";

export type SideReceiptStatus = "queued" | "consumed" | "plan_updated" | "expired";

/** Persist receipt IDs and states only; instruction contents stay in conversation history. */
export class SideSteeringReceipts {
  private receipts = new Map<string, Map<string, SideReceiptStatus>>();

  constructor(private file: string) {
    try {
      const stored = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [sideId, entries] of Object.entries(stored)) {
        if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue;
        const receipts = new Map<string, SideReceiptStatus>();
        for (const [id, status] of Object.entries(entries)) {
          if (status === "queued" || status === "consumed" || status === "plan_updated" || status === "expired") receipts.set(id, status === "queued" ? "expired" : status);
        }
        this.receipts.set(sideId, receipts);
      }
      this.save();
    } catch {}
  }

  get(sideId: string): Record<string, SideReceiptStatus> {
    return Object.fromEntries(this.receipts.get(sideId) || []);
  }

  set(sideId: string, instructionId: string, status: SideReceiptStatus): void {
    const receipts = this.receipts.get(sideId) || new Map();
    receipts.set(instructionId, status);
    this.receipts.set(sideId, receipts);
    this.save();
  }

  private save(): void {
    try {
      const data = Object.fromEntries(Array.from(this.receipts, ([sideId, receipts]) => [sideId, Object.fromEntries(receipts)]));
      const temporary = `${this.file}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
      fs.renameSync(temporary, this.file);
    } catch (error) {
      console.warn("[Side chat] Could not persist instruction receipt:", error);
    }
  }
}
