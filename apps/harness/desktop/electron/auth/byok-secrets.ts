import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface ByokCipher {
  encrypt: (plain: string) => Buffer;
  decrypt: (encrypted: Buffer) => string;
}

export interface ByokSecretStoreOptions {
  storePath?: string;
  cipher?: ByokCipher;
  requireCipher?: boolean;
}

export interface KeyMaskInfo {
  hasApiKey: boolean;
  apiKeyHint?: string;
}

export function formatApiKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) {
    return `••••${trimmed.slice(-2)}`;
  }
  const prefix = /^[a-z]{2,6}-/i.exec(trimmed)?.[0] || "";
  return `${prefix}••••${trimmed.slice(-4)}`;
}

/**
 * Encrypted vault for BYOK / custom endpoint API keys (backed by Electron safeStorage).
 * Keys are stored outside config.json in 0600 encrypted storage on disk.
 */
export class ByokSecretStore {
  private readonly storePath: string;
  private readonly cipher?: ByokCipher;
  private readonly requireCipher: boolean;
  private secrets: Record<string, string> = {};
  private loaded = false;

  constructor(options: ByokSecretStoreOptions = {}) {
    this.storePath =
      options.storePath ??
      path.join(os.homedir(), ".const", "harness", "byok-secrets.enc");
    this.cipher = options.cipher;
    this.requireCipher = options.requireCipher ?? false;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!fs.existsSync(this.storePath)) return;
      const rawBuf = fs.readFileSync(this.storePath);
      if (!rawBuf.length) return;
      let text: string;
      if (this.cipher) {
        try {
          text = this.cipher.decrypt(rawBuf);
        } catch {
          if (this.requireCipher) {
            this.secrets = {};
            return;
          }
          text = rawBuf.toString("utf8");
        }
      } else {
        text = rawBuf.toString("utf8");
      }
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string" && v.trim()) {
            clean[k] = v.trim();
          }
        }
        this.secrets = clean;
      }
    } catch {
      this.secrets = {};
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const json = JSON.stringify(this.secrets);
    const tmp = `${this.storePath}.${process.pid}.tmp`;
    if (this.cipher) {
      let encrypted: Buffer;
      try {
        encrypted = this.cipher.encrypt(json);
      } catch (err) {
        if (this.requireCipher) {
          throw err;
        }
        fs.writeFileSync(tmp, json, { encoding: "utf8", mode: 0o600 });
        fs.renameSync(tmp, this.storePath);
        return;
      }
      fs.writeFileSync(tmp, encrypted, { mode: 0o600 });
      fs.renameSync(tmp, this.storePath);
      return;
    }
    if (this.requireCipher) {
      throw new Error("Encrypted storage backend unavailable.");
    }
    fs.writeFileSync(tmp, json, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, this.storePath);
  }

  public getKey(secretId: string): string {
    this.ensureLoaded();
    return this.secrets[secretId] || "";
  }

  public hasKey(secretId: string): boolean {
    return this.getKey(secretId).length > 0;
  }

  public getMaskInfo(secretId: string): KeyMaskInfo {
    const key = this.getKey(secretId);
    if (!key) return { hasApiKey: false };
    return {
      hasApiKey: true,
      apiKeyHint: formatApiKeyHint(key),
    };
  }

  public setKey(secretId: string, apiKey: string): boolean {
    this.ensureLoaded();
    const clean = apiKey.trim();
    if (!clean) {
      return this.deleteKey(secretId);
    }
    if (this.secrets[secretId] === clean) return false;
    this.secrets[secretId] = clean;
    this.persist();
    return true;
  }

  public deleteKey(secretId: string): boolean {
    this.ensureLoaded();
    if (!(secretId in this.secrets)) return false;
    delete this.secrets[secretId];
    this.persist();
    return true;
  }

  public scrubProviderList<T extends { id?: string; apiKey?: string; hasApiKey?: boolean; apiKeyHint?: string }>(
    list: T[] | undefined,
    prefix = "",
  ): (T & { hasApiKey?: boolean; apiKeyHint?: string })[] | undefined {
    if (!Array.isArray(list)) return list;
    return list.map((item) => {
      if (!item || !item.id) return item as T & { hasApiKey?: boolean; apiKeyHint?: string };
      const secretKey = `${prefix}${item.id}`;
      const incoming = typeof item.apiKey === "string" ? item.apiKey.trim() : "";
      if (incoming) {
        try {
          this.setKey(secretKey, incoming);
        } catch (err) {
          console.warn(`[ByokSecretStore] Could not encrypt API key for ${secretKey}:`, err);
        }
      } else if (item.hasApiKey === false) {
        try {
          this.deleteKey(secretKey);
        } catch {}
      }
      const mask = this.getMaskInfo(secretKey);
      return {
        ...item,
        apiKey: "",
        hasApiKey: mask.hasApiKey,
        ...(mask.apiKeyHint ? { apiKeyHint: mask.apiKeyHint } : { apiKeyHint: undefined }),
      };
    });
  }

  public redactProviderRecord(
    providers: Record<string, { name: string; baseUrl: string; apiKey?: string; protocol?: any; hasApiKey?: boolean; apiKeyHint?: string }> | undefined,
  ): Record<string, any> | undefined {
    if (!providers || typeof providers !== "object") return providers;
    const out: Record<string, any> = {};
    for (const [id, entry] of Object.entries(providers)) {
      if (!entry) continue;
      const secretKey = `provider:${id}`;
      const incoming = typeof entry.apiKey === "string" ? entry.apiKey.trim() : "";
      if (incoming) {
        try {
          this.setKey(secretKey, incoming);
        } catch (err) {
          console.warn(`[ByokSecretStore] Could not encrypt API key for ${secretKey}:`, err);
        }
      } else if (entry.hasApiKey === false) {
        try {
          this.deleteKey(secretKey);
        } catch {}
      }
      const mask = this.getMaskInfo(secretKey);
      out[id] = {
        ...entry,
        apiKey: "",
        hasApiKey: mask.hasApiKey,
        ...(mask.apiKeyHint ? { apiKeyHint: mask.apiKeyHint } : { apiKeyHint: undefined }),
      };
    }
    return out;
  }
}
