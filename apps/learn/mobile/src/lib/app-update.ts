import { useState, useCallback } from "react";
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

const UPDATE_DISMISSED_KEY = "const_learn_mobile_dismissed_version";

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

  const applyUpdate = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(15);

    // Simulate download progress
    const steps = [35, 60, 85, 100];
    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setDownloadProgress(step);
    }

    setIsDownloading(false);
    setIsReadyToInstall(true);

    if (latestRelease?.downloadUrl) {
      toast.success("Membuka penginstal paket APK...");
      try {
        window.open(latestRelease.downloadUrl, "_system");
      } catch {
        window.open(latestRelease.downloadUrl, "_blank");
      }
    } else {
      toast.success("Pembaruan selesai dipasang!");
    }
  }, [isDownloading, latestRelease]);

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
