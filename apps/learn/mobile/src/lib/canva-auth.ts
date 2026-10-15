/**
 * Native Canva Authentication Service for Const Learn Mobile.
 * Uses Capacitor In-App Browser & Deep Links with PKCE (RFC 7636).
 */

import {
  createCanvaAuthUrl,
  exchangeCanvaAuthCode,
  getStoredCanvaTokens,
  clearCanvaTokens,
  isCanvaAuthenticated,
  type CanvaTokenData,
} from "@const/ui";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/**
 * Initiates Canva OAuth connection on Mobile.
 */
export async function connectCanvaMobile(): Promise<{
  success: boolean;
  redirectUrl?: string;
  message?: string;
  tokens?: CanvaTokenData;
}> {
  try {
    const authSetup = await createCanvaAuthUrl();

    if (Capacitor.isNativePlatform()) {
      try {
        await Browser.open({ url: authSetup.url, presentationStyle: "popover" });
        return {
          success: true,
          redirectUrl: authSetup.url,
          message: "Membuka browser untuk otorisasi Canva... Silakan selesaikan persetujuan login.",
        };
      } catch (e) {
        console.warn("[connectCanvaMobile] Capacitor Browser open failed:", e);
      }
    }

    window.open(authSetup.url, "_blank");
    return {
      success: true,
      redirectUrl: authSetup.url,
      message: "Membuka tab baru untuk otorisasi Canva... Silakan selesaikan login.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Gagal menginisialisasi login Canva di perangkat mobile.",
    };
  }
}

/**
 * Disconnects the Canva account on Mobile.
 */
export async function disconnectCanvaMobile(): Promise<boolean> {
  clearCanvaTokens();
  return true;
}

/**
 * Checks if Canva is actively connected on Mobile.
 */
export function isCanvaMobileConnected(): boolean {
  return isCanvaAuthenticated();
}

/**
 * Returns the currently connected Canva user's display name on Mobile.
 */
export function getCanvaMobileDisplayName(): string | null {
  const tokens = getStoredCanvaTokens();
  return tokens?.displayName || null;
}
