import { useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import type {
  InstalledPluginRecord,
  PluginCatalogEntry,
} from "../../lib/plugins/types";
import type { McpConnectionView } from "../../lib/mcp/types";
import { connectionAccountLabel } from "./plugin-connection-info";

/** Account controls stay in detail; these actions are shared with the catalog. */
export function PluginActions({
  plugin,
  installation,
  connections,
  workspacePath,
  onManage,
  onRemoved,
}: {
  plugin: PluginCatalogEntry;
  installation?: InstalledPluginRecord;
  connections: McpConnectionView[];
  workspacePath?: string;
  onManage: () => void;
  onRemoved?: () => void;
}) {
  const { t, language } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const locked = useRef(false);
  const related = installation
    ? connections.filter(
        (connection) =>
          connection.pluginId === installation?.id && connection.isEffective,
      )
    : [];
  const hasMcp = Object.keys(plugin.mcpServers ?? {}).length > 0;
  const connected =
    hasMcp &&
    related.length > 0 &&
    related.every(
      (connection) => connection.enabled && connection.status === "connected",
    );
  const connecting = related.some(
    (connection) => connection.status === "connecting",
  );
  const failed = related.some((connection) => connection.status === "error");
  const label = !installation
    ? "marketplace.install"
    : plugin.placeholder
      ? "mcp.pluginView"
      : !installation.isEnabled
        ? "mcp.pluginEnable"
        : hasMcp
          ? connected
            ? "mcp.connected"
            : connecting
              ? "mcp.connecting"
              : failed
                ? "mcp.error"
                : "mcp.pluginSetup"
          : "marketplace.enabled";
  const lastConnected = related
    .map((connection) => connection.lastConnectedAt)
    .filter((at): at is string => !!at && Number.isFinite(Date.parse(at)))
    .sort()
    .at(-1);
  const hint = [
    ...new Set(
      related.map((connection) => t(connectionAccountLabel(connection))),
    ),
    ...(lastConnected
      ? [
          t("mcp.lastConnected", {
            time: new Intl.DateTimeFormat(language, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(lastConnected)),
          }),
        ]
      : []),
  ].join("\n");
  const mutate = async (
    operation: () => Promise<unknown>,
    success?: string,
  ) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await operation();
      setConfirm(false);
      if (success) toast.success(success);
    } catch {
      toast.error(t("marketplace.pluginMutationError"));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const toggle = () =>
    mutate(async () => {
      const bridge = window.electron?.marketplace;
      if (!bridge || !installation) throw new Error("unavailable");
      await bridge.setEnabled({
        id: installation.id,
        enabled: !installation.isEnabled,
        workspacePath,
      });
    });
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        title={hint || undefined}
        aria-label={`${plugin.interface.displayName}: ${t(label)}`}
        onClick={() => {
          if (!installation)
            void mutate(
              async () => {
                const bridge = window.electron?.marketplace;
                if (!bridge) throw new Error("unavailable");
                await bridge.installPlugin({
                  name: plugin.name,
                  scope: "user",
                  workspacePath,
                });
              },
              t("marketplace.pluginInstalledSuccess").replace(
                "{name}",
                plugin.interface.displayName,
              ),
            );
          else if (!installation.isEnabled && !plugin.placeholder)
            void toggle();
          else onManage();
        }}
        className="h-8 gap-1.5 rounded-full bg-[#222222] px-3 text-xs font-medium text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white focus-visible:bg-[#383838]"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
        ) : !installation ? (
          <Plus className="size-3.5" />
        ) : (installation.isEnabled && connected) ||
          (!hasMcp && installation.isEnabled && !plugin.placeholder) ? (
          <Check className="size-3.5" />
        ) : null}
        {t(label)}
      </Button>
      {installation && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              aria-label={t("mcp.pluginActions").replace(
                "{name}",
                plugin.interface.displayName,
              )}
              className="flex size-8 items-center justify-center rounded-lg text-[#969696] outline-none transition-colors hover:bg-[#2b2b2b] hover:text-white focus-visible:bg-[#383838] focus-visible:text-white disabled:opacity-50"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 rounded-xl border-[#383838] bg-[#222222] p-1 text-[#d4d4d4] shadow-none"
          >
            <DropdownMenuItem
              onSelect={onManage}
              className="gap-2 rounded-lg text-xs"
            >
              <ChevronRight className="size-3.5" />
              {t("marketplace.viewPluginDetails")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void toggle()}
              className="gap-2 rounded-lg text-xs"
            >
              <Power className="size-3.5" />
              {t(
                installation.isEnabled
                  ? "mcp.pluginDisable"
                  : "mcp.pluginEnable",
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setConfirm(true)}
              className="gap-2 rounded-lg text-xs"
            >
              <Trash2 className="size-3.5" />
              {t("marketplace.uninstall")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!locked.current) setConfirm(open);
        }}
      >
        <DialogContent
          hideClose
          className="max-w-sm rounded-2xl border-[#383838] bg-[#222222] p-6 text-white shadow-none"
        >
          <DialogTitle className="text-base font-medium">
            {t("mcp.pluginRemoveTitle").replace(
              "{name}",
              plugin.interface.displayName,
            )}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[#969696]">
            {t("marketplace.pluginUninstallConfirm").replace(
              "{name}",
              plugin.interface.displayName,
            )}
          </DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              className="gap-2 rounded-xl bg-white text-black hover:bg-[#d4d4d4]"
              onClick={() =>
                void mutate(
                  async () => {
                    const bridge = window.electron?.marketplace;
                    if (!bridge || !installation)
                      throw new Error("unavailable");
                    await bridge.uninstallPlugin({
                      id: installation.id,
                      workspacePath,
                    });
                    onRemoved?.();
                  },
                  t("marketplace.pluginUninstalledSuccess").replace(
                    "{name}",
                    plugin.interface.displayName,
                  ),
                )
              }
            >
              {busy && (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              )}
              {t("marketplace.uninstall")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
