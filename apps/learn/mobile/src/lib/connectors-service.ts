/**
 * Connectors Service for Const Learn Mobile.
 * Manages active connected apps (Canva MCP, Google Suite, YouTube, Cloud Sandbox),
 * coordinates OAuth connection flows, and interfaces with Composio.
 */

import { type ConnectorMetadata, AVAILABLE_CONNECTORS } from "@const/ui";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
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
 * Directly communicates with Const Router Gateway in production.
 */
export async function fetchRouterGateway(
  endpointPath: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = getRouterBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${base}${endpointPath}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err: any) {
    clearTimeout(timer);
    throw err || new Error("Gagal terhubung ke Const Router Gateway.");
  }
}

/**
 * Fetches connected accounts from Const Router Gateway and synchronizes mobile local storage.
 */
export async function syncConnectedConnectors(userEmailOrId?: string): Promise<string[]> {
  const userId = userEmailOrId || getLocalDeviceId();

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
        if (match) {
          activeIds.push(match.id);
          if (acc.id) {
            localStorage.setItem(`composio_ca_${match.id}`, acc.id);
          }
        }
      }

      const unique = Array.from(new Set(["cloud-sandbox", ...activeIds]));
      saveConnectedConnectorIds(unique);
      return unique;
    }
  } catch {}

  return getConnectedConnectorIds();
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

      const userId = getLocalDeviceId();
      await fetchRouterGateway("/mcp/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": userId,
        },
        body: JSON.stringify({
          accountId: storedCa,
          userId,
        }),
      }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error("[disconnectConnector mobile Error]", err);
    return false;
  }
}
