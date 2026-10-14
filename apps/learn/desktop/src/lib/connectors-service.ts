/**
 * Connectors Service for Const Learn Desktop.
 * Manages active connected apps (Canva MCP, Google Suite, YouTube),
 * coordinates OAuth connection flows, and interfaces with Composio.
 */

import type { ConnectorMetadata } from "@const/ui";
import { getComposioApiKey } from "./mcp-connectors";

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

/**
 * Connects an app.
 * Initiates OAuth via Composio REST API v3.1 / IPC and opens the authorization URL in the system browser.
 */
export async function connectConnector(
  connector: ConnectorMetadata,
  userEmailOrId?: string
): Promise<{ success: boolean; redirectUrl?: string; message?: string }> {
  const current = getConnectedConnectorIds();
  const apiKey = getComposioApiKey();
  const userId = userEmailOrId || localStorage.getItem("const_device_id") || "learn_desktop_user";
  const targetSlug = connector.toolkitSlug;

  // 1. Electron Native IPC path (no CORS, direct shell.openExternal)
  if ((window as any).electron?.composio?.getAuthLink) {
    try {
      const ipcRes = await (window as any).electron.composio.getAuthLink({
        toolkit: targetSlug,
        userId,
        apiKey,
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
      // If IPC failed with explicit message other than missing method, throw to inform user
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
    const routerBase =
      (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
      (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
      "https://router.const.web.id/v1";

    try {
      const res = await fetch(`${routerBase.replace(/\/+$/, "")}/mcp/auth-link`, {
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
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (routerErr: any) {
      console.warn("[Router Gateway auth-link warning]", routerErr);
      if (routerErr?.message && !routerErr.message.includes("fetch")) {
        throw routerErr;
      }
    }

    // 2b. Direct Composio fallback if local API key is configured
    if (!apiKey) {
      throw new Error(
        `Gagal menghubungkan ${connector.name} via Const Router Gateway.`
      );
    }

    // 2c. Create or resume session
    const sessRes = await fetch("https://backend.composio.dev/api/v3.1/tool_router/session", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        manage_connections: { enable: true },
      }),
    });

    if (!sessRes.ok) {
      const errTxt = await sessRes.text();
      throw new Error(`Gagal membuat sesi Composio (${sessRes.status}): ${errTxt}`);
    }

    const sessData = await sessRes.json();
    const sessionId = sessData.session_id;

    // 2d. Request link session with toolkit
    const linkRes = await fetch(
      `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/link`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toolkit: targetSlug,
          callback_url: "https://accounts.const.web.id/auth-success?connector=" + connector.id,
        }),
      }
    );

    if (!linkRes.ok) {
      const errTxt = await linkRes.text();
      throw new Error(`Gagal mendapatkan link otorisasi (${linkRes.status}): ${errTxt}`);
    }

    const linkData = await linkRes.json();
    const redirectUrl = linkData.redirect_url || linkData.redirectUrl;

    if (redirectUrl) {
      if ((window as any).electron?.openExternal) {
        await (window as any).electron.openExternal(redirectUrl);
      } else {
        window.open(redirectUrl, "_blank");
      }

      saveConnectedConnectorIds([...current, connector.id]);
      if (linkData.connected_account_id) {
        localStorage.setItem(`composio_ca_${connector.id}`, linkData.connected_account_id);
      }

      return {
        success: true,
        redirectUrl,
        message: `Membuka browser untuk otorisasi ${connector.name}... Silakan selesaikan login.`,
      };
    }

    throw new Error("Composio tidak mengembalikan URL redirect otorisasi.");
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
        const routerBase =
          (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
          (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
          "https://router.const.web.id/v1";
        try {
          await fetch(`${routerBase.replace(/\/+$/, "")}/mcp/disconnect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId: storedCa }),
          });
        } catch {
          const apiKey = getComposioApiKey();
          if (apiKey) {
            await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts/${storedCa}`, {
              method: "DELETE",
              headers: { "x-api-key": apiKey },
            }).catch(() => {});
          }
        }
      }
    }
    return true;
  } catch (err) {
    console.error("[disconnectConnector Error]", err);
    return false;
  }
}
