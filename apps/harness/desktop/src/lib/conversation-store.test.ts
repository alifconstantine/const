import assert from "node:assert/strict";
import test from "node:test";
import { getCleanConversationTitle, sortProjectFolderKeys } from "./conversation-store.js";

test("getCleanConversationTitle strips [Scheduled] prefix and markdown links", () => {
  assert.equal(getCleanConversationTitle("[Scheduled] Daily digest"), "Daily digest");
  assert.equal(getCleanConversationTitle("[tes](brain/session_1795)"), "tes");
  assert.equal(getCleanConversationTitle(""), "Untitled task");
});

test("sortProjectFolderKeys places newly created projects at the top above existing order while keeping pinned first", () => {
  const projectMap = {
    "D:/work/older": [{ updatedAt: 100 }],
    "D:/work/middle": [{ updatedAt: 200 }],
    "D:/work/pinned-old": [{ updatedAt: 50 }],
    "D:/work/brand-new": [{ updatedAt: 500 }],
  };

  // Even when user already has saved manual projectOrder, brand-new projects surface at top (below pinned)
  assert.deepEqual(
    sortProjectFolderKeys(
      projectMap,
      ["D:/work/older", "D:/work/middle", "D:/work/pinned-old"],
      ["D:/work/pinned-old"],
    ),
    ["D:/work/pinned-old", "D:/work/brand-new", "D:/work/older", "D:/work/middle"],
  );

  // Without manual projectOrder, projects sort strictly by most recent activity DESC (below pinned)
  assert.deepEqual(
    sortProjectFolderKeys(projectMap, [], ["D:/work/pinned-old"]),
    ["D:/work/pinned-old", "D:/work/brand-new", "D:/work/middle", "D:/work/older"],
  );
});
