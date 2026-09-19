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
  env?: Record<string, string>;
  isDefault?: boolean;
  isCustom?: boolean;
  status: "ready" | "needs_auth" | "disabled";
}

export interface McpConfigurationState {
  servers: McpServerConfig[];
}

export const MOBILE_PRESET_MCP_SERVERS: McpServerConfig[] = [
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
    isDefault: true,
    status: "ready",
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
    isDefault: true,
    status: "ready",
  },
];

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
      };
    } else {
      mcpServers[server.id] = {
        url: server.url || "",
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
    const servers: McpServerConfig[] = [];

    for (const [id, val] of Object.entries<any>(mcpServers)) {
      if (val.url) {
        servers.push({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, " "),
          transport: (val.transport as McpTransport) || "sse",
          scope: val.scope || "user",
          timeoutMs: val.timeoutMs || 30000,
          protocolVersion: val.protocolVersion || "auto",
          url: val.url,
          status: "ready",
          isCustom: true,
        });
      } else {
        servers.push({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, " "),
          transport: "stdio",
          scope: val.scope || "user",
          timeoutMs: val.timeoutMs || 30000,
          protocolVersion: val.protocolVersion || "auto",
          command: val.command || "npx",
          args: val.args || [],
          env: val.env || {},
          status: "ready",
          isCustom: true,
        });
      }
    }

    return { servers };
  } catch (err: any) {
    throw new Error(`Invalid MCP JSON syntax: ${err?.message || String(err)}`);
  }
}

/**
 * Retrieves the stored MCP configuration from localStorage, or falls back to presets
 */
export function getStoredMcpConfig(): McpConfigurationState {
  if (typeof window === "undefined") {
    return { servers: MOBILE_PRESET_MCP_SERVERS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.servers) && parsed.servers.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return { servers: MOBILE_PRESET_MCP_SERVERS };
}

/**
 * Saves the MCP configuration to localStorage
 */
export function saveStoredMcpConfig(config: McpConfigurationState): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}
