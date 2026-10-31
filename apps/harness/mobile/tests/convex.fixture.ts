import { getFunctionName } from "convex/server";
export class ConvexClient {
  setAuth() {}
  onUpdate(reference: any, _args: any, next: (value: any) => void) {
    const timer = setTimeout(() => next(getFunctionName(reference) === "remote:listMySessions"
      ? [{ sessionId: "fixture-desktop", deviceName: "Desktop Studio", isOnline: true, pairingCode: "ABC-123", hasPairingCode: true }]
      : { name: "Mobile Audit", email: "audit@example.test" }), 0);
    return () => clearTimeout(timer);
  }
  async query() { throw new Error("No live pairing in the UI fixture"); }
  async mutation() {}
  async close() {}
}
