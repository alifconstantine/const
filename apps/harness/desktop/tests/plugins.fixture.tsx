import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, useTranslation } from "../src/lib/i18n";
import { SkillsSettings } from "../src/components/settings/skills-settings";
import { PluginsMarketplace } from "../src/components/settings/plugins-marketplace";
import { McpSettings } from "../src/components/settings/mcp-settings";
import type {
  PluginCatalogEntry,
  InstalledPluginRecord,
} from "../src/lib/plugins/types";
import type { McpConnectionView, McpSaveInput } from "../src/lib/mcp/types";
import { ScrollArea, Toaster } from "@const/ui";
import "../src/index.css";

// Browser-only UI fixture. Account and connection results below are simulated, not provider evidence.
const manifests = import.meta.glob("../plugins/*/plugin.json", {
  eager: true,
  import: "default",
}) as Record<string, PluginCatalogEntry>;
const catalog = Object.values(manifests).map((plugin) => ({
  ...plugin,
  skillSlugs: plugin.entrypoint ? [plugin.entrypoint] : [],
}));
let installed: InstalledPluginRecord[] = catalog
  .filter((plugin) => plugin.defaultInstalled || plugin.mcpServers)
  .map((plugin) => ({
    ...plugin,
    id: plugin.name,
    path: plugin.name,
    scope: "user",
    isEnabled: true,
    isEffective: true,
  }));
let connections: McpConnectionView[] = installed.flatMap((plugin) =>
  Object.entries(plugin.mcpServers ?? {}).map(([key, server]) => ({
    id: `fixture-${plugin.name}`,
    key: `plugin-${plugin.name}-${key}`,
    name: plugin.interface.displayName,
    pluginId: plugin.id,
    pluginName: plugin.interface.displayName,
    scope: "user",
    transport: server.transport,
    auth: server.auth,
    url: server.url,
    authOptions: server.authOptions,
    apiKeyUrl: server.apiKeyUrl,
    oauthUrl: server.oauthUrl,
    oauthClientRequired: server.oauthClientRequired,
    setupUrl: server.setupUrl,
    enabled: true,
    timeoutMs: 30000,
    status: "needs_auth",
    tools: [],
    isEffective: true,
    hasCredentials: false,
  })),
);
const events = new Set<() => void>();
const emit = () => events.forEach((callback) => callback());
const subscribe = (callback: () => void) => {
  events.add(callback);
  return () => {
    events.delete(callback);
  };
};
const bridge = {
  marketplace: {
    listInstalled: async () => [],
    onInstallProgress: () => () => {},
    listPlugins: async () => ({ catalog, installed }),
    onChanged: subscribe,
    installPlugin: async ({
      name,
      scope,
    }: {
      name: string;
      scope: "user" | "workspace";
    }) => {
      installed = [
        ...installed,
        {
          ...catalog.find((plugin) => plugin.name === name)!,
          id: name,
          path: name,
          scope,
          isEnabled: true,
          isEffective: true,
        },
      ];
      emit();
    },
    setEnabled: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      installed = installed.map((item) =>
        item.id === id ? { ...item, isEnabled: enabled } : item,
      );
      emit();
    },
    uninstallPlugin: async ({ id }: { id: string }) => {
      installed = installed.filter((item) => item.id !== id);
      emit();
    },
  },
  mcp: {
    list: async () => connections,
    onChanged: subscribe,
    save: async (input: McpSaveInput) => {
      const previous = connections.find((item) => item.id === input.id);
      const id = input.id ?? crypto.randomUUID();
      connections = [
        ...connections.filter((item) => item.id !== id),
        {
          ...previous,
          ...input,
          id,
          key: input.key ?? id,
          enabled: input.enabled !== false,
          timeoutMs: input.timeoutMs ?? 30000,
          status: input.enabled === false ? "disabled" : "disconnected",
          tools: [],
          isEffective: true,
          hasCredentials: !!input.apiKey || previous?.hasCredentials || false,
        } as McpConnectionView,
      ];
      emit();
    },
    remove: async (id: string) => {
      connections = connections.filter((item) => item.id !== id);
      emit();
    },
    connect: async (id: string) => {
      if (connections.find((item) => item.id === id)?.url?.includes("invalid"))
        throw new Error("connection");
      connections = connections.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "connected",
              tools: [
                {
                  name: "fixture_search",
                  description: "Simulated tool for UI verification",
                  inputSchema: { type: "object" },
                  readOnly: true,
                },
              ],
            }
          : item,
      );
      emit();
    },
    authenticate: async (id: string) => {
      connections = connections.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "connected",
              hasCredentials: true,
              lastConnectedAt: new Date().toISOString(),
            }
          : item,
      );
      emit();
    },
    disconnect: async (id: string) => {
      connections = connections.map((item) =>
        item.id === id
          ? {
              ...item,
              enabled: false,
              status: "disabled",
              hasCredentials: false,
            }
          : item,
      );
      emit();
    },
    override: async () => {},
  },
};
window.electron = bridge as unknown as typeof window.electron;

function Fixture() {
  const { t, setLanguage, language } = useTranslation();
  const [tab, setTab] = useState("plugins");
  return (
    <div className="h-screen bg-[#161616] text-white flex flex-col">
      <div className="flex flex-wrap items-center gap-4 p-5 text-sm">
        <span className="text-[#969696]">
          UI fixture · simulated connections
        </span>
        <button onClick={() => setTab("plugins")}>
          {t("marketplace.tabPlugins")}
        </button>
        <button onClick={() => setTab("mcp")}>
          {t("settings.mcpServers")}
        </button>
        <button onClick={() => setLanguage(language === "en" ? "id" : "en")}>
          EN / ID
        </button>
      </div>
      <ScrollArea
        className="min-h-0 flex-1"
        thumbClassName="bg-white/20 hover:bg-white/30"
      >
        <main className="mx-auto max-w-5xl p-6">
          {tab === "plugins" ? (
            <SkillsSettings
              workspacePath="D:/fixture/workspace"
              initialTab="plugins"
              isModal
            />
          ) : (
            <McpSettings workspacePath="D:/fixture/workspace" />
          )}
        </main>
      </ScrollArea>
      <Toaster />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
