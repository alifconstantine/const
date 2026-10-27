import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SideSteeringReceipts } from "./side-steering-receipts";

test("restoring receipts preserves delivery and expires instructions from an interrupted run", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "const-side-receipts-"));
  try {
    const file = path.join(dir, "receipts.json");
    const first = new SideSteeringReceipts(file);
    first.set("side-a", "done", "consumed");
    first.set("side-a", "pending", "queued");
    first.set("side-b", "other", "consumed");
    first.set("side-b", "planned", "plan_updated");
    const restored = new SideSteeringReceipts(file);
    assert.deepEqual(restored.get("side-a"), { done: "consumed", pending: "expired" });
    assert.deepEqual(restored.get("side-b"), { other: "consumed", planned: "plan_updated" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
