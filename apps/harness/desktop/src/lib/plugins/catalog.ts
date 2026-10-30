import type {
  InstalledPluginRecord,
  PluginCatalogEntry,
  PluginInventory,
} from "./types";

export const PLUGIN_CATEGORIES = [
  "productivity",
  "design",
  "media",
  "3d",
  "development",
  "const",
  "other",
] as const;
export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];
const groups: [PluginCategory, string[]][] = [
  [
    "productivity",
    [
      "google-drive",
      "google-docs",
      "google-sheets",
      "google-slides",
      "gmail",
      "google-calendar",
      "google-classroom",
      "obsidian",
      "wordcraft",
      "pdfcraft",
      "gridcraft",
      "deckcraft",
    ],
  ],
  [
    "design",
    [
      "canva",
      "figma",
      "excalidraw",
      "photocraft",
      "vectorcraft",
      "lightcraft",
      "designcraft",
      "figcraft",
    ],
  ],
  ["media", ["hyperframes", "filmcraft", "effectcraft", "soundcraft"]],
  ["3d", ["blender", "godot", "unity", "unreal", "cadcraft"]],
  [
    "development",
    ["github", "context7", "tinyfish", "browser-use", "computer-use"],
  ],
  [
    "const",
    ["const-guide", "plugins-creator", "skills-creator", "intelligence-ui"],
  ],
];
const categories = new Map(
  groups.flatMap(([category, names]) =>
    names.map((name) => [name, category] as const),
  ),
);
export function pluginCategory(name: string): PluginCategory {
  return categories.get(name) ?? "other";
}

/** Select the installation that actually controls this workspace, including disabled overrides. */
export function selectPluginInstallation(
  installed: InstalledPluginRecord[],
  name: string,
) {
  const priority = (item: InstalledPluginRecord) =>
    (item.isEffective ? 4 : 0) + (item.scope === "workspace" ? 2 : 0);
  return installed
    .filter((item) => item.name === name)
    .sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id))[0];
}
export function pluginCatalogEntries({ catalog, installed }: PluginInventory) {
  const byName = new Map<string, PluginCatalogEntry>(
    catalog.map((plugin) => [plugin.name, plugin]),
  );
  for (const item of installed)
    if (!byName.has(item.name)) byName.set(item.name, item);
  return [...byName.values()].map((entry) => {
    const installation = selectPluginInstallation(installed, entry.name);
    return {
      plugin: installation ?? entry,
      installation,
      category: pluginCategory(entry.name),
    };
  });
}
