import type { PluginCatalogEntry } from "../../lib/plugins/types";
import type { McpConnectionView } from "../../lib/mcp/types";
import { useTranslation } from "../../lib/i18n";

export const pluginDescriptionKeys: Record<string, string> = {
  "const-guide": "mcp.guideEmpty",
  "plugins-creator": "mcp.pluginsCreatorDescription",
  "skills-creator": "mcp.skillsCreatorDescription",
  "browser-use": "mcp.browserDescription",
  "computer-use": "mcp.computerDescription",
  context7: "mcp.context7Description",
  tinyfish: "mcp.tinyfishDescription",
  github: "mcp.githubDescription",
  canva: "mcp.canvaDescription",
  hyperframes: "marketplace.hyperframesDescription",
};

export function connectionAccountLabel(connection: McpConnectionView) {
  if (connection.auth === "none") return "mcp.noAccount";
  if (connection.auth === "api-key")
    return connection.hasCredentials
      ? "mcp.credentialSaved"
      : "mcp.requiresKey";
  return connection.hasCredentials && connection.status !== "needs_auth"
    ? "mcp.oauthSuccess"
    : "mcp.requiresAccount";
}

export function ConnectionTime({ at }: { at?: string }) {
  const { t, language } = useTranslation();
  if (!at || !Number.isFinite(Date.parse(at))) return null;
  return (
    <time dateTime={at}>
      {t("mcp.lastConnected", {
        time: new Intl.DateTimeFormat(language, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(at)),
      })}
    </time>
  );
}

/** Status only: account controls live in the plugin's detail page. */
export function PluginConnectionInfo({
  plugin,
  connections,
}: {
  plugin: PluginCatalogEntry;
  connections: McpConnectionView[];
}) {
  const { t } = useTranslation();
  const servers = Object.values(plugin.mcpServers ?? {});
  if (!servers.length) return null;
  const account = servers.some((s) => s.auth === "oauth");
  const key = servers.some((s) => s.auth === "api-key");
  const mostRecent = connections
    .map((c) => c.lastConnectedAt)
    .filter((at): at is string => !!at)
    .sort()
    .at(-1);
  return (
    <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-[#969696]">
      <span>
        {t(
          account
            ? "mcp.requiresAccount"
            : key
              ? "mcp.requiresKey"
              : "mcp.noAccount",
        )}
      </span>
      {connections.map((connection) => (
        <span key={connection.id}>
          {t(
            connection.isEffective
              ? `mcp.${connection.status}`
              : "mcp.overridden",
          )}
        </span>
      ))}
      <ConnectionTime at={mostRecent} />
    </div>
  );
}
