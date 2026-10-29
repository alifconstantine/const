import { useEffect, useState } from "react";
import { Button } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { EDITORS, type EditorAction } from "../../lib/mcp/editors";
import type { McpConnectionView } from "../../lib/mcp/types";

export function EditorSetupPanel({
  connection,
  busy,
  workspacePath,
  run,
}: {
  connection: McpConnectionView;
  busy: boolean;
  workspacePath?: string;
  run: (id: string, operation: () => Promise<unknown>) => Promise<void>;
}) {
  const { t, language } = useTranslation();
  const app = connection.editorApp!;
  const profile = EDITORS[app];
  const [port, setPort] = useState(
    String(connection.editorPort ?? profile.port),
  );
  useEffect(
    () => setPort(String(connection.editorPort ?? profile.port)),
    [connection.editorPort, profile.port],
  );
  const disabled =
    busy ||
    connection.editorInstalling ||
    !connection.enabled ||
    !connection.isEffective;
  const action = (value: EditorAction) => {
    const bridge = window.electron?.mcp;
    if (bridge)
      void run(connection.id, () =>
        bridge.configureEditor(connection.id, value, workspacePath, language),
      );
  };
  return (
    <div className="space-y-4 text-sm text-[#969696]">
      <p>{t("mcp.editorLocal")}</p>
      <ol className="space-y-4 list-decimal pl-5 marker:text-[#969696]">
        <li className="space-y-2 pl-1">
          <p className="text-[#d4d4d4]">{t("mcp.editorChooseProject")}</p>
          <p className="break-all text-xs">
            {connection.detectedProject ?? t("mcp.editorNoProject")}
          </p>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || !workspacePath}
            onClick={() => action("project")}
          >
            {t("mcp.editorChooseProject")}
          </Button>
          {!workspacePath && (
            <p className="text-xs">{t("mcp.editorWorkspace")}</p>
          )}
        </li>
        <li className="space-y-2 pl-1">
          <p className="text-[#d4d4d4]">{t("mcp.editorPrepare")}</p>
          <p className="text-xs">
            {t(
              connection.editorInstalling
                ? "mcp.editorInstalling"
                : connection.editorPrepared
                  ? "mcp.editorPrepared"
                  : "mcp.editorDownloadHint",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {connection.editorInstalling ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => action("cancel")}
              >
                {t("common.cancel")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={
                  disabled || !workspacePath || !connection.detectedProject
                }
                onClick={() => action("install")}
              >
                {t("mcp.editorPrepare")}
              </Button>
            )}
            {app === "blender" && connection.editorPrepared && (
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => action("reveal")}
              >
                {t("mcp.editorRevealAddon")}
              </Button>
            )}
            {app === "unity" && connection.editorPrepared && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => action("login")}
                >
                  {t("mcp.editorUnityLogin")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => action("pipeline")}
                >
                  {t("mcp.editorPipeline")}
                </Button>
              </>
            )}
          </div>
        </li>
        <li className="space-y-2 pl-1">
          <p className="text-[#d4d4d4]">{t("mcp.editorEnable")}</p>
          <p className="text-xs leading-relaxed">{t(`mcp.${app}Setup`)}</p>
          <p className="text-xs">{t("mcp.editorTestHint")}</p>
          <button
            type="button"
            className="text-xs underline underline-offset-4 hover:text-white"
            onClick={() => void window.electron?.openExternal(profile.guide)}
          >
            {t("mcp.setupGuide")}
          </button>
        </li>
      </ol>
      {(app === "blender" || app === "unreal") && (
        <label className="flex items-center gap-3 text-xs">
          <span>{t("mcp.editorPort")}</span>
          <input
            type="number"
            min={1024}
            max={65535}
            value={port}
            disabled={disabled}
            aria-label={t("mcp.editorPort")}
            className="w-24 rounded-xl bg-[#2b2b2b] px-3 py-2 text-[#d4d4d4] outline-none"
            onChange={(event) => setPort(event.target.value)}
            onBlur={() => {
              const value = Number(port);
              if (!Number.isInteger(value) || value < 1024 || value > 65535) {
                setPort(String(connection.editorPort ?? profile.port));
                return;
              }
              const bridge = window.electron?.mcp;
              if (bridge && value !== (connection.editorPort ?? profile.port))
                void run(connection.id, () =>
                  bridge.save({ ...connection, editorPort: value }),
                );
            }}
          />
        </label>
      )}
      <p className="text-xs leading-relaxed">{t("mcp.editorShared")}</p>
    </div>
  );
}
