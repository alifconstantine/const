import { useState } from "react";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import {
  Button,
  Switch,
  toast,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { PluginIcon, isPluginLogo } from "./plugin-icon";
import {
  PluginConnectionInfo,
  pluginDescriptionKeys,
} from "./plugin-connection-info";
import { useMcpConnections } from "../../lib/mcp/use-mcp";
import { usePluginInventory } from "../../lib/plugins/plugins-service";
import type {
  InstalledPluginRecord,
  PluginCatalogEntry,
} from "../../lib/plugins/types";

export function PluginsMarketplace({
  workspacePath,
  scope: _scope,
  search,
  onSelectPlugin,
  installScope: _installScope,
  onInstallScopeChange: _onInstallScopeChange,
}: {
  workspacePath?: string;
  scope?: "all" | "user" | "workspace";
  search: string;
  installScope?: "user" | "workspace";
  onInstallScopeChange?: (scope: "user" | "workspace") => void;
  onSelectPlugin?: (plugin: PluginCatalogEntry | InstalledPluginRecord) => void;
}) {
  const { t } = useTranslation();
  const { catalog, installed, error } = usePluginInventory(workspacePath);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { connections } = useMcpConnections(workspacePath);
  const matches = (plugin: PluginCatalogEntry) =>
    [
      plugin.interface.displayName,
      plugin.name,
      plugin.description,
      ...plugin.skillSlugs,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  const visibleInstalled = installed.filter((plugin) => matches(plugin));
  const available = catalog.filter(
    (plugin) =>
      matches(plugin) &&
      !installed.some((item) => item.name === plugin.name),
  );

  const mutate = async (
    key: string,
    action: () => Promise<void>,
    success?: string,
  ) => {
    setPending(key);
    try {
      await action();
      if (success) toast.success(success);
      setConfirmId(null);
    } catch {
      toast.error(t("marketplace.pluginMutationError"));
    } finally {
      setPending(null);
    }
  };

  const card = (
    plugin: PluginCatalogEntry,
    installation?: InstalledPluginRecord,
  ) => {
    const related = installation
      ? connections.filter((c) => c.pluginId === installation.id)
      : [];
    const effective = related.filter((c) => c.isEffective);
    const isLogo = isPluginLogo(plugin.name);
    return (
      <article
        key={installation?.id ?? plugin.name}
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            onSelectPlugin?.(installation ?? plugin);
          }
        }}
        onClick={() => onSelectPlugin?.(installation ?? plugin)}
        className="rounded-xl bg-[#222222] hover:bg-[#262626] border border-transparent hover:border-[#383838] p-4 flex flex-col justify-between gap-3 transition-all cursor-pointer group"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 flex items-center justify-center shrink-0 text-white">
            <PluginIcon
              name={plugin.name}
              className={isLogo ? "w-[18px] h-[18px]" : "w-[22px] h-[22px]"}
              size={isLogo ? 18 : 22}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate">
              {plugin.interface.displayName}
            </h3>
            <p className="text-[11px] text-[#969696] truncate">
              {plugin.author.name} · {plugin.version}
            </p>
          </div>
          {installation ? (
            <div
              className="flex items-center gap-2 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Switch
                aria-label={t("marketplace.pluginToggleLabel").replace(
                  "{name}",
                  plugin.interface.displayName,
                )}
                checked={installation.isEnabled}
                disabled={pending !== null}
                onCheckedChange={(enabled) =>
                  mutate(installation.id, () =>
                    window.electron!.marketplace!.setEnabled({
                      id: installation.id,
                      enabled,
                      workspacePath,
                    }),
                  )
                }
              />
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => setConfirmId(installation.id)}
                title={t("marketplace.uninstall")}
                className="p-1.5 rounded-lg text-[#969696] hover:text-white hover:bg-[#383838] disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                disabled={pending !== null}
                onClick={() =>
                  mutate(
                    plugin.name,
                    () =>
                      window.electron!.marketplace!.installPlugin({
                        name: plugin.name,
                        scope: "user",
                        workspacePath,
                      }),
                    t("marketplace.pluginInstalledSuccess").replace(
                      "{name}",
                      plugin.interface.displayName,
                    ),
                  )
                }
                className="h-7.5 px-3 rounded-lg bg-white text-black hover:bg-[#d4d4d4] text-xs font-medium gap-1.5 shrink-0"
              >
                {pending === plugin.name && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {pending === plugin.name
                  ? t("marketplace.installing")
                  : t("marketplace.install")}
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs leading-relaxed text-[#d4d4d4] line-clamp-2">
          {pluginDescriptionKeys[plugin.name]
            ? t(pluginDescriptionKeys[plugin.name]!)
            : plugin.description}
        </p>

        <PluginConnectionInfo
          plugin={plugin}
          connections={effective.length ? effective : related}
        />

        <div className="flex items-center justify-between gap-2 text-[11px] text-[#969696] pt-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span>
              {plugin.skillSlugs.length === 0 && plugin.mcpServers
                ? `${t("marketplace.tabMcp")} · ${Object.keys(plugin.mcpServers).length}`
                : t("marketplace.pluginSkillsCount").replace(
                    "{count}",
                    String(plugin.skillSlugs.length),
                  )}
            </span>
            <span>·</span>
            <span>{t("marketplace.globalScope")}</span>
          </div>
          <span className="flex items-center gap-0.5 text-[#969696] group-hover:text-white transition-colors shrink-0">
            <span>{t("marketplace.viewPluginDetails")}</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        {confirmId === installation?.id && installation && (
          <div
            className="rounded-xl bg-[#2b2b2b] p-3 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-white">
              {t("marketplace.pluginUninstallConfirm").replace(
                "{name}",
                plugin.interface.displayName,
              )}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending !== null}
                onClick={() =>
                  mutate(
                    installation.id,
                    () =>
                      window.electron!.marketplace!.uninstallPlugin({
                        id: installation.id,
                        workspacePath,
                      }),
                    t("marketplace.pluginUninstalledSuccess").replace(
                      "{name}",
                      plugin.interface.displayName,
                    ),
                  )
                }
                className="h-7 px-3 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
              >
                {t("marketplace.uninstall")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending !== null}
                onClick={() => setConfirmId(null)}
                className="h-7 px-3 text-xs text-[#969696] hover:text-white"
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-sm text-[#d4d4d4]">
          {t("marketplace.pluginLoadError")}
        </p>
      )}
      {visibleInstalled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
            {t("marketplace.installedSection")} ({visibleInstalled.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {visibleInstalled.map((plugin) => card(plugin, plugin))}
          </div>
        </section>
      )}
      {(available.length > 0 || search.trim()) && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
            {t("marketplace.availableSection")} ({available.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {available.map((plugin) => card(plugin))}
          </div>
          {available.length === 0 && (
            <p className="text-xs text-[#969696]">
              {t("marketplace.noAvailableDesc")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
