/**
 * MCP Server Configuration & Management Service for Const Learn Mobile.
 * Strictly adheres to the standard Model Context Protocol (mcpServers) schema.
 */

export type McpTransport = "stdio" | "sse" | "http";
export type McpScope = "user" | "workspace";

export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransport;
  scope?: McpScope;
  timeoutMs?: number;
  protocolVersion?: string;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled?: boolean;
  isDefault?: boolean;
  isCustom?: boolean;
  status?: "ready" | "needs_auth" | "disabled" | "error";
  errorMessage?: string;
}

export interface McpConfigurationState {
  servers: McpServerConfig[];
}

export const AVAILABLE_PRESET_MCP_SERVERS: McpServerConfig[] = [
  {
    id: "composio",
    name: "Composio",
    transport: "stdio",
    scope: "user",
    timeoutMs: 30000,
    protocolVersion: "auto",
    command: "npx",
    args: ["-y", "composio-mcp"],
    env: {
      COMPOSIO_API_KEY: "",
    },
    enabled: true,
    status: "ready",
    isCustom: false,
  },
  {
    id: "canva",
    name: "Canva",
    transport: "stdio",
    scope: "user",
    timeoutMs: 30000,
    protocolVersion: "auto",
    command: "npx",
    args: ["-y", "mcp-remote@latest", "https://mcp.canva.com/mcp"],
    env: {},
    enabled: true,
    status: "ready",
    isCustom: false,
  },
  {
    id: "parallel-search",
    name: "parallel-search",
    transport: "http",
    scope: "user",
    timeoutMs: 30000,
    protocolVersion: "auto",
    url: "https://search.parallel.ai/mcp",
    headers: {},
    enabled: false,
    status: "ready",
    isCustom: false,
  },
  {
    id: "tinyfish",
    name: "tinyfish",
    transport: "http",
    scope: "user",
    timeoutMs: 30000,
    protocolVersion: "auto",
    url: "https://agent.tinyfish.ai/mcp?source=tinyfish_cli&client=zcode",
    headers: {},
    enabled: false,
    status: "ready",
    isCustom: false,
  },
  {
    id: "context7",
    name: "Context7",
    transport: "http",
    scope: "user",
    timeoutMs: 30000,
    protocolVersion: "auto",
    url: "https://mcp.context7.com/mcp",
    headers: {},
    enabled: false,
    status: "ready",
    isCustom: false,
  },
  {
    id: "github",
    name: "GitHub",
    transport: "stdio",
    scope: "user",
    timeoutMs: 30000,
    protocolVersion: "auto",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: "",
    },
    enabled: false,
    status: "ready",
    isCustom: false,
  },
];

export const MOBILE_PRESET_MCP_SERVERS = AVAILABLE_PRESET_MCP_SERVERS;

const STORAGE_KEY = "const_mcp_configuration_mobile_v3";

/**
 * Converts internal server state to official mcpServers JSON format
 */
export function exportMcpJson(config: McpConfigurationState): string {
  const mcpServers: Record<string, any> = {};

  for (const server of config.servers) {
    if (server.transport === "stdio") {
      mcpServers[server.id] = {
        command: server.command || "npx",
        args: server.args || [],
        ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
        ...(server.enabled === false ? { disabled: true } : {}),
      };
    } else {
      mcpServers[server.id] = {
        url: server.url || "",
        ...(server.headers && Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
        ...(server.enabled === false ? { disabled: true } : {}),
      };
    }
  }

  return JSON.stringify({ mcpServers }, null, 2);
}

/**
 * Parses official mcpServers JSON into internal server state
 */
export function importMcpJson(jsonString: string): McpConfigurationState {
  try {
    const parsed = JSON.parse(jsonString);
    const mcpServers = parsed.mcpServers || parsed;
    if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
      throw new Error('Format JSON mcpServers tidak valid (harus berupa objek "mcpServers").');
    }
    const servers: McpServerConfig[] = [];

    for (const [id, val] of Object.entries<any>(mcpServers)) {
      if (val && typeof val === "object") {
        const isHttp = Boolean(val.url);
        if (!isHttp && !val.command) {
          throw new Error(`Server "${id}" wajib memiliki properti "command" (stdio) atau "url" (http/sse).`);
        }

        if (isHttp && val.url) {
          try {
            const u = new URL(val.url);
            if (!["http:", "https:"].includes(u.protocol)) throw new Error();
          } catch {
            throw new Error(`Server "${id}" memiliki URL tidak valid: "${val.url}". Harus berupa HTTP/HTTPS.`);
          }
        }

        servers.push({
          id,
          name: val.name || id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, " "),
          transport: (val.transport as McpTransport) || (isHttp ? (val.url?.startsWith("http") ? "http" : "sse") : "stdio"),
          scope: val.scope || "user",
          timeoutMs: val.timeoutMs || 30000,
          protocolVersion: val.protocolVersion || "auto",
          url: val.url,
          command: val.command || (isHttp ? undefined : "npx"),
          args: val.args || [],
          headers: val.headers || {},
          env: val.env || {},
          enabled: val.disabled ? false : true,
          status: "ready",
          isCustom: true,
        });
      }
    }

    return { servers };
  } catch (err: any) {
    throw new Error(`Format JSON MCP tidak valid: ${err?.message || String(err)}`);
  }
}

/**
 * Retrieves the stored MCP configuration from localStorage.
 * Defaults to EMPTY array so user starts with a clean slate as requested.
 */
export function getStoredMcpConfig(): McpConfigurationState {
  if (typeof window === "undefined") {
    return { servers: [] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.servers)) {
        return parsed;
      }
    }
  } catch {}

  return { servers: [] };
}

/**
 * Saves the MCP configuration to localStorage
 */
export function saveStoredMcpConfig(config: McpConfigurationState): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("mcp_servers_changed", { detail: config }));
  }
}
