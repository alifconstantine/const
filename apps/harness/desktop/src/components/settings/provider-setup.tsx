import { EditorSetupPanel } from "./editor-setup";
import { FolderOpen } from "lucide-react";
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import type { McpConnectionView } from "../../lib/mcp/types";
import { ARTCRAFT_APPS } from "../../lib/mcp/artcraft";
import {
  FIGMA_DESKTOP_URL,
  FIGMA_REMOTE_URL,
  FIGMA_DESKTOP_GUIDE,
  FIGMA_REMOTE_GUIDE,
} from "../../lib/mcp/presets";

export function ProviderSetup({
  connection,
  busy,
  run,
  workspacePath,
}: {
  connection: McpConnectionView;
  busy: boolean;
  workspacePath?: string;
  run: (id: string, operation: () => Promise<unknown>) => Promise<void>;
}) {
  const { t, language } = useTranslation();
  const bridge = window.electron?.mcp;
  if (connection.builtin === "editor" && connection.editorApp)
    return (
      <EditorSetupPanel
        connection={connection}
        busy={busy}
        workspacePath={workspacePath}
        run={run}
      />
    );
  if (connection.builtin === "artcraft" && connection.artcraftApp) {
    const profile = ARTCRAFT_APPS[connection.artcraftApp];
    return (
      <div className="space-y-3 text-sm text-[#969696]">
        <p>{t("mcp.artcraftSetup")}</p>
        <p className="break-all text-xs text-[#d4d4d4]">
          {connection.detectedRuntime ?? t("mcp.artcraftMissing")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["detect", "browse"] as const).map((action) => (
            <Button
              key={action}
              size="sm"
              variant="ghost"
              disabled={busy || !connection.enabled || !connection.isEffective}
              onClick={() =>
                bridge &&
                void run(connection.id, () =>
                  bridge.configureArtcraft(
                    connection.id,
                    action,
                    workspacePath,
                    language,
                  ),
                )
              }
            >
              {t(
                action === "detect"
                  ? "mcp.artcraftDetect"
                  : "mcp.artcraftBrowse",
              )}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void window.electron?.openExternal(
                `https://getartcraft.com/apps/${connection.artcraftApp}`,
              )
            }
          >
            {t("mcp.artcraftDownload")}
          </Button>
        </div>
        <p className="text-xs">{t("mcp.artcraftFiles")}</p>
        {!workspacePath && (
          <p className="text-xs">{t("mcp.artcraftWorkspace")}</p>
        )}
        {!profile.roots && (
          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5 accent-white"
              checked={!!connection.localFileAccess}
              disabled={busy || !connection.enabled || !connection.isEffective}
              onChange={(event) =>
                bridge &&
                void run(connection.id, () =>
                  bridge.save({
                    ...connection,
                    localFileAccess: event.target.checked,
                  }),
                )
              }
            />
            <span>{t("mcp.artcraftLocalAccess")}</span>
          </label>
        )}
      </div>
    );
  }
  if (connection.builtin === "obsidian")
    return (
      <div className="space-y-3 text-sm text-[#969696]">
        <p>{t("mcp.obsidianSetup")}</p>
        {connection.vaultPath && (
          <p className="break-all text-xs text-[#d4d4d4]">
            {connection.vaultPath}
          </p>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !connection.enabled || !connection.isEffective}
          onClick={() =>
            bridge &&
            void run(connection.id, () =>
              bridge.chooseVault(
                connection.id,
                connection.workspacePath,
                language,
              ),
            )
          }
        >
          <FolderOpen className="size-4 mr-2" />
          {t(connection.vaultPath ? "mcp.changeVault" : "mcp.chooseVault")}
        </Button>
      </div>
    );
  if (connection.key !== "plugin-figma-figma") return null;
  const remote = connection.url === FIGMA_REMOTE_URL;
  const mode = remote
    ? "remote"
    : connection.url === FIGMA_DESKTOP_URL
      ? "desktop"
      : undefined;
  return (
    <div className="space-y-3 text-sm text-[#969696]">
      <label className="space-y-2 block">
        <span>{t("mcp.figmaConnection")}</span>
        <Select
          value={mode}
          disabled={busy}
          onValueChange={(value) =>
            bridge &&
            void run(connection.id, () =>
              bridge.save({
                ...connection,
                url: value === "remote" ? FIGMA_REMOTE_URL : FIGMA_DESKTOP_URL,
                auth: value === "remote" ? "oauth" : "none",
                scopes: value === "remote" ? "mcp:connect" : undefined,
                clientId: undefined,
              }),
            )
          }
        >
          <SelectTrigger
            className="max-w-sm rounded-xl bg-[#222222]"
            aria-label={t("mcp.figmaConnection")}
          >
            <SelectValue placeholder={t("mcp.figmaConnection")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desktop">{t("mcp.figmaDesktop")}</SelectItem>
            <SelectItem value="remote">{t("mcp.figmaRemote")}</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <p>{t(remote ? "mcp.figmaRemoteSetup" : "mcp.figmaDesktopSetup")}</p>
      <button
        type="button"
        className="text-xs underline underline-offset-4 hover:text-white"
        onClick={() =>
          void window.electron?.openExternal(
            remote ? FIGMA_REMOTE_GUIDE : FIGMA_DESKTOP_GUIDE,
          )
        }
      >
        {t("mcp.setupGuide")}
      </button>
    </div>
  );
}
