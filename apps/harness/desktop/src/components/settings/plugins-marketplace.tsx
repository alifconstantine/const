import { useState } from "react";
import { Blocks, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { Button, Switch, toast } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import {
  pluginIconUrl,
  usePluginInventory,
} from "../../lib/plugins/plugins-service";
import type {
  InstalledPluginRecord,
  PluginCatalogEntry,
} from "../../lib/plugins/types";

export function PluginsMarketplace({
  workspacePath,
  scope,
  search,
}: {
  workspacePath?: string;
  scope: "all" | "user" | "workspace";
  search: string;
}) {
  const { t } = useTranslation();
  const { catalog, installed, error } = usePluginInventory(workspacePath);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const targetScope = scope === "workspace" ? "workspace" : "user";
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
  const visibleInstalled = installed.filter(
    (plugin) => (scope === "all" || plugin.scope === scope) && matches(plugin),
  );
  const available = catalog.filter(
    (plugin) =>
      matches(plugin) &&
      !installed.some(
        (item) => item.name === plugin.name && item.scope === targetScope,
      ),
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
  ) => (
    <article
      key={installation?.id ?? plugin.name}
      className="rounded-2xl bg-[#222222] p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white">
          <Blocks className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">
            {plugin.interface.displayName}
          </h3>
          <p className="mt-1 text-xs text-[#969696]">
            {plugin.author.name} · {plugin.version}
          </p>
        </div>
        {installation ? (
          <div className="flex items-center gap-3">
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
              className="p-2 rounded-lg text-[#969696] hover:text-white hover:bg-[#383838] disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Button
            disabled={
              pending !== null ||
              (targetScope === "workspace" && !workspacePath)
            }
            onClick={() =>
              mutate(
                plugin.name,
                () =>
                  window.electron!.marketplace!.installPlugin({
                    name: plugin.name,
                    scope: targetScope,
                    workspacePath,
                  }),
                t("marketplace.pluginInstalledSuccess").replace(
                  "{name}",
                  plugin.interface.displayName,
                ),
              )
            }
            className="rounded-xl bg-white text-black hover:bg-[#d4d4d4] text-xs gap-2"
          >
            {pending === plugin.name && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {pending === plugin.name
              ? t("marketplace.installing")
              : t("marketplace.install")}
          </Button>
        )}
      </div>
      <p className="text-sm leading-relaxed text-[#d4d4d4]">
        {plugin.name === "hyperframes"
          ? t("marketplace.hyperframesDescription")
          : plugin.description}
      </p>
      <div className="flex items-center gap-3 flex-wrap text-xs text-[#969696]">
        <span>
          {t("marketplace.pluginSkillsCount").replace(
            "{count}",
            String(plugin.skillSlugs.length),
          )}
        </span>
        <span>
          {(installation?.scope ?? targetScope) === "workspace"
            ? t("marketplace.workspaceScope")
            : t("marketplace.globalScope")}
        </span>
        {installation && (
          <span>
            {!installation.isEffective ? t("marketplace.pluginOverridden") : installation.isEnabled
              ? t("marketplace.active")
              : t("marketplace.disabled")}
          </span>
        )}
      </div>
      <details className="text-xs text-[#969696]">
        <summary className="flex items-center gap-1.5 cursor-pointer list-none">
          <ChevronDown className="w-3.5 h-3.5" />
          {t("marketplace.pluginIncludedSkills")}
        </summary>
        <div className="flex flex-wrap gap-2 pt-3">
          {plugin.skillSlugs.map((slug) => (
            <span key={slug} className="rounded-lg bg-[#2b2b2b] px-2 py-1">
              {slug}
            </span>
          ))}
        </div>
      </details>
      {confirmId === installation?.id && installation && (
        <div className="rounded-xl bg-[#2b2b2b] p-3 space-y-3">
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
            >
              {t("marketplace.uninstall")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending !== null}
              onClick={() => setConfirmId(null)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </article>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#969696]">
        {t("marketplace.pluginUsageHint")}
      </p>
      {targetScope === "workspace" && !workspacePath && (
        <p className="text-xs text-[#969696]">
          {t("marketplace.pluginChooseWorkspace")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#d4d4d4]">
          {t("marketplace.pluginLoadError")}
        </p>
      )}
      {visibleInstalled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">
            {t("marketplace.installedSection")}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleInstalled.map((plugin) => card(plugin, plugin))}
          </div>
        </section>
      )}
      {(available.length > 0 || search.trim()) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">
            {t("marketplace.availableSection")}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
