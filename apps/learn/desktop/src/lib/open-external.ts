/**
 * Safely opens an external URL in the user's default system browser.
 * In Electron desktop environments, it delegates to `window.electron.openExternal`
 * which launches the operating system's default browser (Chrome, Firefox, Safari, Edge, etc.).
 * In web browser environments, it falls back to `window.open`.
 */
export async function openExternalUrl(url?: string): Promise<boolean> {
  if (!url) return false;
  const targetUrl = url.trim();
  if (!targetUrl) return false;

  const normalizedUrl = /^https?:\/\//i.test(targetUrl)
    ? targetUrl
    : `https://${targetUrl}`;

  try {
    if (window.electron?.openExternal) {
      const success = await window.electron.openExternal(normalizedUrl);
      if (success) return true;
    }
  } catch (error) {
    console.error("[openExternalUrl] Failed to open external URL via Electron:", error);
  }

  try {
    const win = window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    return !!win;
  } catch (err) {
    console.error("[openExternalUrl] Fallback window.open failed:", err);
    try {
      window.open(normalizedUrl);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Opens a local file or directory using the OS default application.
 */
export async function openExternalPath(targetPath?: string): Promise<boolean> {
  if (!targetPath) return false;
  try {
    if (window.electron?.openPath) {
      await window.electron.openPath(targetPath);
      return true;
    }
  } catch (error) {
    console.error("[openExternalPath] Failed to open path via Electron:", error);
  }
  return false;
}
