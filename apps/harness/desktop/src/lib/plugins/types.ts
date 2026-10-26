export interface PluginSkillSummary {
  slug: string;
  name: string;
  description: string;
}

export interface PluginCatalogEntry {
  name: string;
  version: string;
  description: string;
  author: { name: string };
  interface: { displayName: string; icon: string };
  entrypoint: string;
  skillSlugs: string[];
  overview?: string;
  mcpServers?: Record<string, any>;
  skills?: PluginSkillSummary[];
}

export interface InstalledPluginRecord extends PluginCatalogEntry {
  id: string;
  path: string;
  scope: "user" | "workspace";
  workspacePath?: string;
  isEnabled: boolean;
  isEffective: boolean;
}

export interface PluginInventory {
  catalog: PluginCatalogEntry[];
  installed: InstalledPluginRecord[];
}
