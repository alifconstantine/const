import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { McpConnection, McpSaveInput } from "../../src/lib/mcp/types";

const pairs = z.record(z.string().min(1).max(200), z.string().max(16_384));
const inputSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(100)
    .optional(),
  name: z.string().trim().min(1).max(100),
  scope: z.enum(["user", "workspace"]),
  workspacePath: z.string().optional(),
  transport: z.enum(["http", "stdio"]),
  url: z.string().max(2048).optional(),
  command: z.string().max(2048).optional(),
  args: z.array(z.string().max(4096)).max(100).optional(),
  cwd: z.string().optional(),
  auth: z.enum(["none", "oauth", "api-key"]),
  clientId: z.string().max(2048).optional(),
  scopes: z.string().max(4096).optional(),
  enabled: z.boolean().optional(),
  timeoutMs: z.number().int().min(1000).max(300_000).optional(),
  apiKey: z.string().max(16_384).optional(),
  clientSecret: z.string().max(16_384).optional(),
  headers: pairs.optional(),
  env: pairs.optional(),
  headerNames: z.array(z.string()).max(100).optional(),
  envNames: z.array(z.string()).max(100).optional(),
});
export interface McpSecrets {
  apiKey?: string;
  clientSecret?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  tokens?: OAuthTokens;
  clientInformation?: OAuthClientInformationMixed;
}
export interface SecretCodec {
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

export function atomicJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
      mode: 0o600,
    });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}
export function validWorkspace(value?: string): string | undefined {
  if (!value || value === "Outside Project") return undefined;
  if (!path.isAbsolute(value)) throw new Error("invalid");
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
export function validateEndpoint(value: string): URL {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("invalid");
  return url;
}

/** Workspace files contain public settings; every secret stays in the user's encrypted vault. */
export class McpStore {
  constructor(
    readonly home: string,
    private readonly codec: SecretCodec,
  ) {}
  private file(workspacePath?: string) {
    const workspace = validWorkspace(workspacePath);
    return workspace
      ? path.join(workspace, ".const", "mcp.json")
      : path.join(this.home, "mcp.json");
  }
  private records(workspacePath?: string): McpConnection[] {
    const data = readJson<{ version: number; connections: McpConnection[] }>(
      this.file(workspacePath),
      { version: 1, connections: [] },
    );
    if (data.version !== 1 || !Array.isArray(data.connections))
      throw new Error("invalid");
    // Parse public fields too: a repository can edit its workspace configuration.
    return data.connections.map((record) => {
      const checked = inputSchema.parse(record);
      if (!checked.id || !checked.key) throw new Error("invalid");
      if (checked.transport === "http") validateEndpoint(checked.url ?? "");
      const {
        apiKey: _key,
        clientSecret: _secret,
        headers: _headers,
        env: _env,
        ...publicFields
      } = checked;
      return {
        ...publicFields,
        id: checked.id,
        key: checked.key,
        enabled: checked.enabled !== false,
        timeoutMs: checked.timeoutMs ?? 30_000,
        scope: workspacePath ? "workspace" : "user",
        workspacePath: validWorkspace(workspacePath),
        headerNames: record.headerNames,
        envNames: record.envNames,
      };
    });
  }
  list(workspacePath?: string): McpConnection[] {
    const workspace = validWorkspace(workspacePath);
    return [...(workspace ? this.records(workspace) : []), ...this.records()];
  }
  get(id: string, workspacePath?: string) {
    const result = this.list(workspacePath).find((record) => record.id === id);
    if (!result) throw new Error("invalid");
    return result;
  }
  fingerprint(record: McpConnection): string {
    return createHash("sha256")
      .update(
        JSON.stringify([
          record.id,
          record.key,
          record.scope,
          record.workspacePath,
          record.transport,
          record.url,
          record.command,
          record.args ?? [],
          record.cwd,
          record.auth,
          record.clientId,
          record.scopes,
        ]),
      )
      .digest("hex");
  }
  isTrusted(record: McpConnection): boolean {
    return (
      readJson<Record<string, string>>(
        path.join(this.home, "mcp-trust.json"),
        {},
      )[record.id] === this.fingerprint(record)
    );
  }
  trust(record: McpConnection) {
    const file = path.join(this.home, "mcp-trust.json");
    atomicJson(file, {
      ...readJson<Record<string, string>>(file, {}),
      [record.id]: this.fingerprint(record),
    });
  }
  private vault(): Record<string, string> {
    return readJson(path.join(this.home, "mcp-secrets.json"), {});
  }
  secrets(id: string): McpSecrets {
    const encrypted = this.vault()[id];
    return encrypted
      ? JSON.parse(this.codec.decrypt(Buffer.from(encrypted, "base64")))
      : {};
  }
  writeSecrets(id: string, value: McpSecrets) {
    const encrypted = this.codec.encrypt(JSON.stringify(value));
    const vault = this.vault();
    vault[id] = encrypted.toString("base64");
    atomicJson(path.join(this.home, "mcp-secrets.json"), vault);
  }
  clearSecrets(id: string) {
    const vault = this.vault();
    delete vault[id];
    atomicJson(path.join(this.home, "mcp-secrets.json"), vault);
  }
  save(raw: McpSaveInput): McpConnection {
    const input = inputSchema.parse(raw);
    const workspace =
      input.scope === "workspace"
        ? validWorkspace(input.workspacePath)
        : undefined;
    if (input.scope === "workspace" && !workspace) throw new Error("invalid");
    if (input.transport === "http") validateEndpoint(input.url ?? "");
    else if (!input.command?.trim() || input.auth !== "none")
      throw new Error("invalid");
    if (input.cwd && !path.isAbsolute(input.cwd)) throw new Error("invalid");
    const records = this.records(workspace);
    const previous = input.id
      ? records.find((item) => item.id === input.id)
      : undefined;
    if (input.id && !previous) throw new Error("invalid");
    const id = previous?.id ?? randomUUID();
    const key = previous?.key ?? input.key ?? `custom-${id}`;
    if (records.some((item) => item.key === key && item.id !== id))
      throw new Error("invalid");
    const endpointChanged =
      previous &&
      (previous.url !== input.url ||
        previous.command !== input.command ||
        previous.transport !== input.transport ||
        previous.auth !== input.auth ||
        previous.clientId !== input.clientId ||
        previous.scopes !== input.scopes);
    const resetSecrets =
      !!endpointChanged || !!(previous && !this.isTrusted(previous));
    const oldSecrets = resetSecrets ? {} : this.secrets(id);
    const { apiKey, clientSecret, headers, env, ...publicFields } = input;
    const secrets: McpSecrets = {
      ...oldSecrets,
      ...(apiKey !== undefined ? { apiKey } : {}),
      ...(clientSecret !== undefined ? { clientSecret } : {}),
      ...(headers !== undefined ? { headers } : {}),
      ...(env !== undefined ? { env } : {}),
    };
    if (Object.keys(secrets).length) this.writeSecrets(id, secrets);
    else if (resetSecrets) this.clearSecrets(id);
    const record: McpConnection = {
      ...publicFields,
      id,
      key,
      workspacePath: workspace,
      enabled: input.enabled ?? true,
      timeoutMs: input.timeoutMs ?? 30_000,
      headerNames: Object.keys(secrets.headers ?? {}),
      envNames: Object.keys(secrets.env ?? {}),
    };
    atomicJson(this.file(workspace), {
      version: 1,
      connections: [...records.filter((item) => item.id !== id), record],
    });
    this.trust(record);
    return record;
  }
  remove(id: string, workspacePath?: string) {
    const record = this.get(id, workspacePath);
    atomicJson(this.file(record.workspacePath), {
      version: 1,
      connections: this.records(record.workspacePath).filter(
        (item) => item.id !== id,
      ),
    });
    this.clearSecrets(id);
  }
}
