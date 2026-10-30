import assert from "node:assert/strict";
import { test } from "node:test";
import { pluginCatalogEntries, selectPluginInstallation } from "./catalog";
import type { InstalledPluginRecord, PluginCatalogEntry } from "./types";

const github: PluginCatalogEntry = {
  name: "github",
  version: "1",
  description: "Repositories",
  author: { name: "Const" },
  interface: { displayName: "GitHub", icon: "blocks" },
  skillSlugs: [],
};
const global: InstalledPluginRecord = {
  ...github,
  id: "global",
  path: "/global",
  scope: "user",
  isEnabled: true,
  isEffective: false,
};
const workspace: InstalledPluginRecord = {
  ...github,
  id: "workspace",
  path: "/workspace",
  scope: "workspace",
  isEnabled: false,
  isEffective: true,
};

test("catalog keeps one entry when a disabled workspace installation overrides global", () => {
  for (const installed of [
    [global, workspace],
    [workspace, global],
  ]) {
    const entries = pluginCatalogEntries({ catalog: [github], installed });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.installation?.id, "workspace");
    assert.equal(entries[0]?.plugin, workspace);
    assert.equal(entries[0]?.category, "development");
    assert.equal(
      selectPluginInstallation(installed, "github")?.isEnabled,
      false,
    );
  }
});

test("catalog retains custom plugins and uninstalled entries in the same list", () => {
  const custom = {
    ...global,
    name: "private-tools",
    id: "custom",
    isEffective: true,
  };
  const entries = pluginCatalogEntries({
    catalog: [github],
    installed: [custom],
  });
  assert.deepEqual(
    entries.map((entry) => [
      entry.plugin.name,
      entry.category,
      entry.installation?.id,
    ]),
    [
      ["github", "development", undefined],
      ["private-tools", "other", "custom"],
    ],
  );
});
