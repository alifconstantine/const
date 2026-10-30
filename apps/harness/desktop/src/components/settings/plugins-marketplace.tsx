import { Button } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import {
  PLUGIN_CATEGORIES,
  pluginCatalogEntries,
} from "../../lib/plugins/catalog";
import type { usePluginInventory } from "../../lib/plugins/plugins-service";
import type {
  InstalledPluginRecord,
  PluginCatalogEntry,
} from "../../lib/plugins/types";
import type { McpConnectionView } from "../../lib/mcp/types";
import { PluginIcon } from "./plugin-icon";
import { pluginDescriptionKeys } from "./plugin-connection-info";
import { PluginActions } from "./plugin-actions";

export function PluginsMarketplace({
  workspacePath,
  search,
  inventory,
  connections,
  onSelectPlugin,
}: {
  workspacePath?: string;
  search: string;
  inventory: ReturnType<typeof usePluginInventory>;
  connections: McpConnectionView[];
  onSelectPlugin: (
    plugin: PluginCatalogEntry | InstalledPluginRecord,
    tab?: "overview" | "mcp",
  ) => void;
}) {
  const { t, language } = useTranslation();
  const entries = pluginCatalogEntries(inventory);
  const collator = new Intl.Collator(language, { sensitivity: "base" });
  const description = (plugin: PluginCatalogEntry) =>
    pluginDescriptionKeys[plugin.name]
      ? t(pluginDescriptionKeys[plugin.name]!)
      : plugin.description;
  const query = search.trim().toLocaleLowerCase(language);
  const visible = entries.filter(({ plugin, category }) =>
    [
      plugin.interface.displayName,
      plugin.name,
      description(plugin),
      plugin.description,
      t(`mcp.pluginCategory_${category}`),
      ...plugin.skillSlugs,
    ]
      .join(" ")
      .toLocaleLowerCase(language)
      .includes(query),
  );
  if (inventory.loading)
    return (
      <div role="status" className="space-y-6">
        <span className="sr-only">{t("mcp.pluginLoading")}</span>
        <div className="h-4 w-32 animate-pulse rounded bg-[#222222] motion-reduce:animate-none" />
        <div
          className="grid gap-x-10 gap-y-3"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 23rem), 1fr))",
          }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="flex h-20 items-center gap-3 px-2"
            >
              <div className="size-10 rounded-xl bg-[#222222]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-[#222222]" />
                <div className="h-3 w-3/4 rounded bg-[#222222]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="space-y-10 pb-6">
      {inventory.error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl bg-[#222222] p-4 text-sm text-[#d4d4d4]"
        >
          <p>{t("mcp.pluginLoadFailed")}</p>
          <Button variant="ghost" size="sm" onClick={inventory.refresh}>
            {t("mcp.pluginRetry")}
          </Button>
        </div>
      )}
      {PLUGIN_CATEGORIES.map((category) => {
        const items = visible
          .filter((item) => item.category === category)
          .sort((a, b) =>
            collator.compare(
              a.plugin.interface.displayName,
              b.plugin.interface.displayName,
            ),
          );
        if (!items.length) return null;
        return (
          <section
            key={category}
            aria-label={t(`mcp.pluginCategory_${category}`)}
            className="space-y-3"
          >
            <h2 className="px-2 text-sm font-semibold text-[#d4d4d4]">
              {t(`mcp.pluginCategory_${category}`)}
            </h2>
            <ul
              className="grid gap-x-10 gap-y-1"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 23rem), 1fr))",
              }}
            >
              {items.map(({ plugin, installation }) => (
                <li
                  key={plugin.name}
                  className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[#1c1c1c] focus-within:bg-[#222222]"
                >
                  <button
                    type="button"
                    data-plugin-name={plugin.name}
                    onClick={() => onSelectPlugin(installation ?? plugin)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left outline-none focus-visible:underline focus-visible:decoration-white/40 focus-visible:underline-offset-4"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#222222] text-white">
                      <PluginIcon
                        name={plugin.name}
                        className="size-6"
                        size={24}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        title={plugin.interface.displayName}
                        className="block truncate text-sm font-medium text-white"
                      >
                        {plugin.interface.displayName}
                      </span>
                      <span
                        className="mt-1 block truncate text-[13px] leading-5 text-[#969696]"
                        title={description(plugin)}
                      >
                        {description(plugin)}
                      </span>
                    </span>
                  </button>
                  <PluginActions
                    plugin={plugin}
                    installation={installation}
                    connections={connections}
                    workspacePath={workspacePath}
                    onManage={() =>
                      onSelectPlugin(
                        installation ?? plugin,
                        Object.keys(plugin.mcpServers ?? {}).length > 0
                          ? "mcp"
                          : "overview",
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!inventory.error && !visible.length && (
        <div className="space-y-2 px-2 py-12">
          <h2 className="text-sm font-medium text-white">
            {t("mcp.pluginNoResults")}
          </h2>
          <p className="text-sm text-[#969696]">{t("mcp.pluginSearchHint")}</p>
        </div>
      )}
    </div>
  );
}
