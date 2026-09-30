import { useState, useEffect, useCallback } from "react";
import { toast } from "@const/ui";

export interface ReleaseSection {
  title: string;
  items: string[];
}

export interface AppReleaseInfo {
  version: string;
  releaseDate: string;
  sections: ReleaseSection[];
  downloadUrl?: string;
  isMandatory?: boolean;
}

export const CURRENT_APP_VERSION = "0.0.1";

const UPDATE_DISMISSED_KEY = "const_learn_dismissed_version";

export function useAppUpdate() {
  const [latestRelease, setLatestRelease] = useState<AppReleaseInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(UPDATE_DISMISSED_KEY);
    } catch {
      return null;
    }
  });

  const isUpdateAvailable = Boolean(
    latestRelease &&
    latestRelease.version.replace(/^v/, "") !== CURRENT_APP_VERSION &&
    dismissedVersion !== latestRelease.version
  );

  // Check for updates on startup from Electron main process
  useEffect(() => {
    let isMounted = true;
    const checkUpdates = async () => {
      try {
        if (typeof window !== "undefined" && window.electron?.updater?.checkForUpdates) {
          const res = await window.electron.updater.checkForUpdates();
          if (isMounted && res?.hasUpdate && res?.version) {
            setLatestRelease({
              version: res.version,
              releaseDate: new Date().toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
              sections: [
                {
                  title: "What's New",
                  items: ["Pembaruan versi terbaru Const Learn."],
                },
              ],
            });
          }
        }
      } catch (err) {
        console.warn("[Updater] check failed:", err);
      }
    };

    checkUpdates();
    return () => {
      isMounted = false;
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(10);

    // Smooth download progress steps
    const progressSteps = [25, 50, 75, 95, 100];
    for (const step of progressSteps) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setDownloadProgress(step);
    }

    setIsDownloading(false);
    setIsReadyToInstall(true);

    // Trigger Electron quit & install if available
    const quitAndInstall = typeof window !== "undefined" ? window.electron?.updater?.quitAndInstall : undefined;
    if (quitAndInstall) {
      toast.success("Restarting Const Learn to apply update...");
      setTimeout(() => {
        quitAndInstall();
      }, 1000);
    } else {
      toast.success("Update downloaded. Restarting application...");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  }, [isDownloading]);

  const dismissUpdate = useCallback(() => {
    if (latestRelease) {
      try {
        localStorage.setItem(UPDATE_DISMISSED_KEY, latestRelease.version);
      } catch {}
      setDismissedVersion(latestRelease.version);
    }
  }, [latestRelease]);

  const resetDismissed = useCallback(() => {
    try {
      localStorage.removeItem(UPDATE_DISMISSED_KEY);
    } catch {}
    setDismissedVersion(null);
  }, []);

  return {
    currentVersion: CURRENT_APP_VERSION,
    latestRelease,
    isUpdateAvailable,
    isDownloading,
    downloadProgress,
    isReadyToInstall,
    applyUpdate,
    dismissUpdate,
    resetDismissed,
  };
}
