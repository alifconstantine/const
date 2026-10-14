/**
 * Connectors Service for Const Learn Desktop.
 * Manages active connected apps (Canva MCP, Google Suite, YouTube),
 * coordinates OAuth connection flows, and interfaces with Composio.
 */

import { type ConnectorMetadata, AVAILABLE_CONNECTORS } from "@const/ui";

const CONNECTED_CONNECTORS_KEY = "const_learn_connected_connectors_v1";

/**
 * Returns list of IDs of currently connected apps.
 * Code Interpreter is excluded on Desktop.
 */
export function getConnectedConnectorIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(CONNECTED_CONNECTORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Exclude cloud-sandbox / codeinterpreter on desktop
        return parsed.filter((id) => id !== "cloud-sandbox");
      }
    }
  } catch {}

  return [];
}

/**
 * Saves connected connector IDs into localStorage.
 */
export function saveConnectedConnectorIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  const filtered = Array.from(new Set(ids.filter((id) => id !== "cloud-sandbox")));
  localStorage.setItem(CONNECTED_CONNECTORS_KEY, JSON.stringify(filtered));
  // Dispatch custom storage event for live UI reactivity
  window.dispatchEvent(new Event("connectors_changed"));
}

/**
 * Checks if a given connector is currently connected.
 */
export function isConnectorActive(connectorId: string): boolean {
  if (connectorId === "cloud-sandbox") return false;
  const connected = getConnectedConnectorIds();
  return connected.includes(connectorId);
}

export function getRouterBaseUrl(): string {
  const explicit =
    (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.CONST_ROUTER_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  return "https://router.const.web.id/v1";
}

export function getRouterBaseUrls(): string[] {
  return [getRouterBaseUrl()];
}

/**
 * Directly communicates with Const Router Gateway in production.
 */
export async function fetchRouterGateway(
  endpointPath: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = getRouterBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${base}${endpointPath}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err || new Error("Gagal terhubung ke Const Router Gateway.");
  }
}

/**
 * Fetches connected accounts from Const Router Gateway and synchronizes local storage.
 */
export async function syncConnectedConnectors(userEmailOrId?: string): Promise<string[]> {
  const userId =
    userEmailOrId ||
    localStorage.getItem("const_user_email") ||
    localStorage.getItem("const_device_id") ||
    "learn_desktop_user";

  try {
    const res = await fetchRouterGateway(
      `/mcp/connected-accounts?userId=${encodeURIComponent(userId)}`,
      {
        headers: {
          "X-Device-Id": userId,
          "X-User-Id": userId,
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const accounts = data.accounts || data.items || [];
      const activeIds: string[] = [];

      for (const acc of accounts) {
        if (acc.status !== "ACTIVE") continue;
        const slug = (acc.toolkit?.slug || acc.toolkit || "").toLowerCase().replace(/[-_]/g, "");
        const match = AVAILABLE_CONNECTORS.find((c) => {
          const cSlug = c.toolkitSlug.toLowerCase().replace(/[-_]/g, "");
          return cSlug === slug || cSlug.includes(slug) || slug.includes(cSlug);
        });
        if (match && match.id !== "cloud-sandbox") {
          activeIds.push(match.id);
          if (acc.id) {
            localStorage.setItem(`composio_ca_${match.id}`, acc.id);
          }
        }
      }

      const unique = Array.from(new Set(activeIds));
      saveConnectedConnectorIds(unique);
      return unique;
    }
  } catch {}

  return getConnectedConnectorIds();
}

/**
 * Connects an app.
 * Initiates OAuth via Const Router MCP Gateway and opens the authorization URL in the system browser.
 */
export async function connectConnector(
  connector: ConnectorMetadata,
  userEmailOrId?: string
): Promise<{ success: boolean; redirectUrl?: string; message?: string }> {
  const current = getConnectedConnectorIds();
  const userId = userEmailOrId || localStorage.getItem("const_device_id") || "learn_desktop_user";
  const targetSlug = connector.toolkitSlug;

  // 1. Electron Native IPC path (no CORS, direct shell.openExternal)
  if ((window as any).electron?.composio?.getAuthLink) {
    try {
      const ipcRes = await (window as any).electron.composio.getAuthLink({
        toolkit: targetSlug,
        userId,
        callbackUrl: "https://accounts.const.web.id/auth-success?connector=" + connector.id,
      });

      if (ipcRes?.success && ipcRes.redirectUrl) {
        saveConnectedConnectorIds([...current, connector.id]);
        if (ipcRes.connectedAccountId) {
          localStorage.setItem(`composio_ca_${connector.id}`, ipcRes.connectedAccountId);
        }
        return {
          success: true,
          redirectUrl: ipcRes.redirectUrl,
          message: `Membuka browser untuk otorisasi ${connector.name}... Silakan selesaikan login.`,
        };
      } else if (ipcRes?.error) {
        throw new Error(ipcRes.error);
      } else if (ipcRes && !ipcRes.success) {
        throw new Error(`Gagal menginisialisasi otorisasi ${connector.name}.`);
      }
    } catch (ipcErr: any) {
      console.warn("[Composio IPC Connect Warning]", ipcErr);
      if (
        ipcErr?.message &&
        !ipcErr.message.toLowerCase().includes("not a function") &&
        !ipcErr.message.toLowerCase().includes("is not defined")
      ) {
        throw ipcErr;
      }
    }
  }

  // 2. Direct Const Router MCP Gateway fallback (for web preview / non-IPC fallback)
  if (connector.authType !== "No Auth") {
    try {
      const res = await fetchRouterGateway("/mcp/auth-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": userId,
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          toolkit: targetSlug,
          userId,
          callbackUrl: "https://accounts.const.web.id/auth-success?connector=" + connector.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.redirectUrl) {
        if ((window as any).electron?.openExternal) {
          await (window as any).electron.openExternal(data.redirectUrl);
        } else {
          window.open(data.redirectUrl, "_blank");
        }

        saveConnectedConnectorIds([...current, connector.id]);
        if (data.connectedAccountId) {
          localStorage.setItem(`composio_ca_${connector.id}`, data.connectedAccountId);
        }

        return {
          success: true,
          redirectUrl: data.redirectUrl,
          message: `Membuka browser untuk otorisasi ${connector.name}... Silakan selesaikan login.`,
        };
      }

      throw new Error(data.error || `Gagal menghubungkan ${connector.name} via Const Router Gateway.`);
    } catch (err: any) {
      throw new Error(err?.message || `Gagal menghubungkan ${connector.name} via Const Router Gateway.`);
    }
  }

  // Fallback ONLY for No-Auth tools
  saveConnectedConnectorIds([...current, connector.id]);
  return {
    success: true,
    message: `${connector.name} berhasil terhubung.`,
  };
}

/**
 * Disconnects an app and deletes the remote connected account if present.
 */
export async function disconnectConnector(connectorId: string): Promise<boolean> {
  try {
    const current = getConnectedConnectorIds();
    saveConnectedConnectorIds(current.filter((id) => id !== connectorId));

    const storedCa = localStorage.getItem(`composio_ca_${connectorId}`);
    if (storedCa) {
      localStorage.removeItem(`composio_ca_${connectorId}`);
      if ((window as any).electron?.composio?.disconnectAccount) {
        await (window as any).electron.composio
          .disconnectAccount({ accountId: storedCa })
          .catch(() => {});
      } else {
        await fetchRouterGateway("/mcp/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: storedCa }),
        }).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    console.error("[disconnectConnector Error]", err);
    return false;
  }
}
