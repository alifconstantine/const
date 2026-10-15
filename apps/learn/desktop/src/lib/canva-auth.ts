/**
 * Native Canva Authentication Service for Const Learn Desktop.
 * Uses Electron in-app auth window or deep linking with PKCE (RFC 7636).
 */

import {
  createCanvaAuthUrl,
  exchangeCanvaAuthCode,
  getStoredCanvaTokens,
  clearCanvaTokens,
  isCanvaAuthenticated,
  registerCanvaRequestExecutor,
  type CanvaTokenData,
} from "@const/ui";

// Register Electron IPC request executor to bypass browser CORS if available
if (typeof window !== "undefined" && (window as any).electron?.canva?.request) {
  registerCanvaRequestExecutor(async (url: string, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          headers[k] = v;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) {
          headers[k] = v;
        }
      } else {
        Object.assign(headers, init.headers);
      }
    }

    const res = await (window as any).electron.canva.request({
      url,
      method: init?.method || "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    return new Response(res.text || "", {
      status: res.status || (res.ok ? 200 : 500),
      headers: {
        "content-type": "application/json",
      },
    });
  });
}

/**
 * Initiates Canva OAuth connection for Desktop.
 * Opens the user's default system browser (Chrome/Edge/Firefox) where their Google and Canva accounts
 * are already logged in, and captures the callback via a local loopback HTTP server or deep link.
 */
export async function connectCanvaDesktop(): Promise<{
  success: boolean;
  redirectUrl?: string;
  message?: string;
  tokens?: CanvaTokenData;
}> {
  try {
    const authSetup = await createCanvaAuthUrl();

    // 1. Electron Default Browser + Loopback Server (Instant, uses existing Google/Canva session)
    if ((window as any).electron?.canva?.openAuthWindow) {
      const authResult = await (window as any).electron.canva.openAuthWindow({
        authUrl: authSetup.url,
        redirectUri: authSetup.redirectUri,
      });

      if (!authResult || !authResult.success) {
        throw new Error(authResult?.error || "Otorisasi Canva dibatalkan.");
      }

      if (!authResult.code) {
        throw new Error("Tidak ada kode otorisasi yang diterima dari Canva.");
      }

      // Exchange code for tokens via PKCE
      const tokens = await exchangeCanvaAuthCode({
        code: authResult.code,
        state: authResult.state,
        verifier: authSetup.verifier,
        redirectUri: authSetup.redirectUri,
      });

      return {
        success: true,
        tokens,
        message: tokens.displayName
          ? `Berhasil terhubung ke Canva sebagai ${tokens.displayName}!`
          : "Akun Canva berhasil terhubung secara native!",
      };
    }

    // 2. Fallback: External browser
    if ((window as any).electron?.openExternal) {
      await (window as any).electron.openExternal(authSetup.url);
    } else {
      window.open(authSetup.url, "_blank");
    }

    return {
      success: true,
      redirectUrl: authSetup.url,
      message: "Membuka browser untuk otorisasi Canva... Silakan selesaikan persetujuan login.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Gagal menginisialisasi login Canva.",
    };
  }
}

/**
 * Disconnects the Canva account and wipes local tokens.
 */
export async function disconnectCanvaDesktop(): Promise<boolean> {
  clearCanvaTokens();
  return true;
}

/**
 * Checks if Canva is actively connected on Desktop.
 */
export function isCanvaDesktopConnected(): boolean {
  return isCanvaAuthenticated();
}

/**
 * Returns the currently connected Canva user's display name, if available.
 */
export function getCanvaDesktopDisplayName(): string | null {
  const tokens = getStoredCanvaTokens();
  return tokens?.displayName || null;
}
