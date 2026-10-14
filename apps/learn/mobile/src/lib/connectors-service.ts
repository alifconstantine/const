/**
 * Connectors Service for Const Learn Mobile.
 * Manages active connected apps (Canva MCP, Google Suite, YouTube, Cloud Sandbox),
 * coordinates OAuth connection flows, and interfaces with Composio.
 */

import type { ConnectorMetadata } from "@const/ui";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  getComposioApiKey,
  getComposioBaseUrl,
  getLocalDeviceId,
  getRouterBaseUrl,
} from "./composio";

export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url, presentationStyle: "popover" });
      return;
    } catch (e) {
      console.warn("[openExternalUrl] Capacitor Browser failed, falling back to window.open", e);
    }
  }
  window.open(url, "_blank");
}

const CONNECTED_CONNECTORS_KEY = "const_learn_connected_connectors_mobile_v1";

/**
 * Returns list of IDs of currently connected apps.
 * "cloud-sandbox" is always active by default.
 */
export function getConnectedConnectorIds(): string[] {
  if (typeof window === "undefined") {
    return ["cloud-sandbox"];
  }

  try {
    const raw = localStorage.getItem(CONNECTED_CONNECTORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(["cloud-sandbox", ...parsed]));
      }
    }
  } catch {}

  return ["cloud-sandbox"];
}

/**
 * Saves connected connector IDs into localStorage.
 */
export function saveConnectedConnectorIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Set(["cloud-sandbox", ...ids]));
  localStorage.setItem(CONNECTED_CONNECTORS_KEY, JSON.stringify(unique));
  window.dispatchEvent(new Event("connectors_changed"));
}

/**
 * Checks if a given connector is currently connected.
 */
export function isConnectorActive(connectorId: string): boolean {
  if (connectorId === "cloud-sandbox") return true;
  const connected = getConnectedConnectorIds();
  return connected.includes(connectorId);
}

/**
 * Connects an app on mobile.
 * Initiates Composio OAuth flow via Const Router MCP Gateway.
 */
export async function connectConnector(
  connector: ConnectorMetadata,
  userEmailOrId?: string
): Promise<{ success: boolean; redirectUrl?: string; message?: string }> {
  const current = getConnectedConnectorIds();
  const userId = userEmailOrId || getLocalDeviceId();
  const targetSlug = connector.toolkitSlug;

  if (connector.authType !== "No Auth") {
    const routerBaseUrl = getRouterBaseUrl();

    // 1. Primary path: Request OAuth authorization link from Const Router MCP Gateway
    try {
      const res = await fetch(`${routerBaseUrl}/mcp/auth-link`, {
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
        await openExternalUrl(data.redirectUrl);
        saveConnectedConnectorIds([...current, connector.id]);
        if (data.connectedAccountId) {
          localStorage.setItem(`composio_ca_${connector.id}`, data.connectedAccountId);
        }
        return {
          success: true,
          redirectUrl: data.redirectUrl,
          message: `Membuka otorisasi ${connector.name}... Silakan selesaikan login di browser.`,
        };
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (routerErr: any) {
      console.warn("[Mobile Connect] Router gateway auth-link warning, checking fallback:", routerErr);
      if (routerErr?.message && !routerErr.message.includes("fetch")) {
        throw routerErr;
      }
    }

    // 2. Direct Composio fallback if local API key is configured
    const apiKey = getComposioApiKey();
    if (!apiKey) {
      throw new Error(
        `Gagal menghubungkan ${connector.name} via Const Router Gateway.`
      );
    }

    const baseUrl = getComposioBaseUrl();

    // 2a. Session creation
    const sessRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/tool_router/session`, {
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
      const errTxt = await sessRes.text().catch(() => "");
      throw new Error(`Gagal membuat sesi Composio (${sessRes.status}): ${errTxt || "Periksa API key Anda"}`);
    }

    const sessData = await sessRes.json();
    const sessionId = sessData.session_id;

    // 2b. Request link session
    const linkRes = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/tool_router/session/${sessionId}/link`,
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
      const errTxt = await linkRes.text().catch(() => "");
      throw new Error(`Gagal mendapatkan link otorisasi (${linkRes.status}): ${errTxt}`);
    }

    const linkData = await linkRes.json();
    const redirectUrl = linkData.redirect_url || linkData.redirectUrl;

    if (redirectUrl) {
      await openExternalUrl(redirectUrl);
      saveConnectedConnectorIds([...current, connector.id]);
      if (linkData.connected_account_id) {
        localStorage.setItem(`composio_ca_${connector.id}`, linkData.connected_account_id);
      }
      return {
        success: true,
        redirectUrl,
        message: `Membuka otorisasi ${connector.name}... Silakan selesaikan login di browser.`,
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
 * Disconnects an app on mobile.
 */
export async function disconnectConnector(connectorId: string): Promise<boolean> {
  if (connectorId === "cloud-sandbox") return false;
  try {
    const current = getConnectedConnectorIds();
    saveConnectedConnectorIds(current.filter((id) => id !== connectorId));

    const storedCa = localStorage.getItem(`composio_ca_${connectorId}`);
    if (storedCa) {
      localStorage.removeItem(`composio_ca_${connectorId}`);

      // Try router gateway disconnect
      const routerBaseUrl = getRouterBaseUrl();
      const userId = getLocalDeviceId();
      try {
        await fetch(`${routerBaseUrl}/mcp/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-Id": userId,
          },
          body: JSON.stringify({
            accountId: storedCa,
            userId,
          }),
        });
      } catch {
        // Fallback to direct DELETE if local API key exists
        const apiKey = getComposioApiKey();
        const baseUrl = getComposioBaseUrl();
        if (apiKey) {
          await fetch(`${baseUrl.replace(/\/+$/, "")}/connected_accounts/${storedCa}`, {
            method: "DELETE",
            headers: { "x-api-key": apiKey },
          }).catch(() => {});
        }
      }
    }
    return true;
  } catch (err) {
    console.error("[disconnectConnector mobile Error]", err);
    return false;
  }
}
