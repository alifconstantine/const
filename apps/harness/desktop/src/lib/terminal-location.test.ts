import test from "node:test";
import assert from "node:assert/strict";
import { terminalFolderTitle, updateTerminalLocation } from "./terminal-location";
import type { RightPaneTab } from "../components/right-pane/types";

test("terminal labels use the actual website folder on Unix and Windows", () => {
  assert.equal(terminalFolderTitle("/tasks/a/project/robot jellyfish", "/home/me/Website"), "robot jellyfish");
  assert.equal(terminalFolderTitle("C:\\tasks\\b\\project\\shelf hero", "D:\\Code\\Website"), "shelf hero");
  assert.equal(terminalFolderTitle("/tasks/a/project", "/home/me/Website"), "Website");
});

test("late location replies cannot replace the foreground chat's terminal", () => {
  const tabs: RightPaneTab[] = [
    { id: "a", type: "terminal", conversationId: "chat-a", project: "/Website", title: "Website", cwd: "/a/project" },
    { id: "b", type: "terminal", conversationId: "chat-b", project: "/Website", title: "Website (2)", cwd: "/b/project" },
  ];
  assert.equal(updateTerminalLocation(tabs, "b", "chat-a", "/a/project/site"), tabs);
  const next = updateTerminalLocation(tabs, "b", "chat-b", "/b/project/site");
  assert.equal(next[0], tabs[0]);
  assert.equal(next[1]?.cwd, "/b/project/site");
  assert.equal(next[1]?.title, "site (2)");
  assert.equal(updateTerminalLocation(next, "b", "chat-b", "/b/project/site"), next);
});
