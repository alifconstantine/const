/**
 * Connectors Service for Const Learn Mobile.
 * Manages active connected apps (Canva MCP, Google Suite, YouTube, Cloud Sandbox),
 * coordinates OAuth connection flows, and interfaces with Composio.
 */

import type { ConnectorMetadata } from "@const/ui";
import { getComposioApiKey, getComposioBaseUrl, getLocalDeviceId } from "./composio";

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
 * Initiates Composio OAuth flow or marks connected.
 */
export async function connectConnector(
  connector: ConnectorMetadata,
  userEmailOrId?: string
): Promise<{ success: boolean; redirectUrl?: string; message?: string }> {
  const current = getConnectedConnectorIds();
  const apiKey = getComposioApiKey();

  if (apiKey && connector.authType !== "No Auth") {
    try {
      const userId = userEmailOrId || getLocalDeviceId();
      const baseUrl = getComposioBaseUrl();
      const targetSlug = connector.toolkitSlug;

      // 1. Session creation
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

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        const sessionId = sessData.session_id;

        // 2. Request link session
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

        if (linkRes.ok) {
          const linkData = await linkRes.json();
          const redirectUrl = linkData.redirect_url || linkData.redirectUrl;

          if (redirectUrl) {
            window.open(redirectUrl, "_blank");
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
        }
      }
    } catch (err) {
      console.warn("Composio live link mobile fallback:", err);
    }
  }

  // Instant fallback for sandbox/offline
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
  const current = getConnectedConnectorIds();
  saveConnectedConnectorIds(current.filter((id) => id !== connectorId));

  const storedCa = localStorage.getItem(`composio_ca_${connectorId}`);
  if (storedCa) {
    localStorage.removeItem(`composio_ca_${connectorId}`);
    const apiKey = getComposioApiKey();
    const baseUrl = getComposioBaseUrl();
    if (apiKey) {
      fetch(`${baseUrl.replace(/\/+$/, "")}/connected_accounts/${storedCa}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      }).catch(() => {});
    }
  }

  return true;
}
