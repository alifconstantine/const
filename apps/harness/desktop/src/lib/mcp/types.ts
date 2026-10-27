export type McpAuth = "none" | "oauth" | "api-key";
export type McpStatus =
  | "disabled"
  | "disconnected"
  | "connecting"
  | "connected"
  | "needs_auth"
  | "error";

/** Public configuration. Secret values never cross the Electron preload bridge on reads. */
export interface McpConnection {
  id: string;
  key: string;
  name: string;
  scope: "user" | "workspace";
  workspacePath?: string;
  pluginId?: string;
  pluginName?: string;
  transport: "http" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  auth: McpAuth;
  clientId?: string;
  scopes?: string;
  enabled: boolean;
  timeoutMs: number;
  headerNames?: string[];
  envNames?: string[];
}
export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  appResourceUri?: string;
  appOnly?: boolean;
}
export interface McpConnectionView extends McpConnection {
  authOptions?: McpAuth[];
  apiKeyUrl?: string;
  oauthUrl?: string;
  oauthClientRequired?: boolean;
  managedOAuth?: "github" | "google";
  accountEmail?: string;
  setupUrl?: string;
  lastConnectedAt?: string;
  status: McpStatus;
  tools: McpToolInfo[];
  isEffective: boolean;
  hasCredentials: boolean;
  error?:
    | "connection"
    | "auth"
    | "storage"
    | "busy"
    | "invalid"
    | "setup"
    | "scope"
    | "account";
}
export interface McpSaveInput extends Partial<McpConnection> {
  name: string;
  scope: "user" | "workspace";
  transport: "http" | "stdio";
  auth: McpAuth;
  apiKey?: string;
  clientSecret?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}
export interface McpBridge {
  list(workspacePath?: string): Promise<McpConnectionView[]>;
  save(input: McpSaveInput): Promise<void>;
  remove(id: string, workspacePath?: string): Promise<void>;
  override(id: string, workspacePath: string): Promise<void>;
  connect(id: string, workspacePath?: string): Promise<void>;
  authenticate(
    id: string,
    workspacePath?: string,
    language?: string,
  ): Promise<void>;
  disconnect(id: string, workspacePath?: string): Promise<void>;
  onChanged(callback: () => void): () => void;
  appView(id: string): Promise<import("./apps").McpAppView>;
  appCall(id: string, name: string, args: Record<string, unknown>, approved?: boolean): Promise<any>;
  appContext(id: string, text: string): Promise<void>;
  saveDiagram(id: string, scene: NonNullable<import("./apps").McpAppView["scene"]>): Promise<string>;
  readDiagram(filePath: string): Promise<Pick<import("./apps").McpAppView, "id" | "title" | "filePath" | "scene">>;
}
