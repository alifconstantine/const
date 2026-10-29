"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal } from "lucide-react";
import { BrandLogo } from "@const/ui";
import { useI18n } from "@/context/I18nContext";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { LINKS } from "@/lib/links";
import type { DesktopBuild } from "@/lib/releases";

type PlatformCategory = "desktop" | "mobile";

interface DownloadTarget {
  id: string;
  filename: string;
  url: string;
  isExternal?: boolean;
}

const RELEASES_BASE_URL =
  "https://github.com/alifconstantine/const/releases/latest/download";

export function DownloadPage({
  builds = [],
  available = false,
  arch,
  os,
}: {
  builds?: DesktopBuild[];
  available?: boolean;
  arch?: string;
  os?: string;
}) {
  const { t } = useI18n();
  const initialCategory: PlatformCategory =
    os === "android" || os === "ios" ? "mobile" : "desktop";
  const [category, setCategory] = useState<PlatformCategory>(initialCategory);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const targets: Record<string, DownloadTarget> = {
    "mac-arm64": {
      id: "mac-arm64",
      filename: "Const-Harness-0.1.0-arm64.dmg",
      url: `${RELEASES_BASE_URL}/Const-Harness-0.1.0-arm64.dmg`,
    },
    "mac-intel": {
      id: "mac-intel",
      filename: "Const-Harness-0.1.0-x64.dmg",
      url: `${RELEASES_BASE_URL}/Const-Harness-0.1.0-x64.dmg`,
    },
    "win-x64": {
      id: "win-x64",
      filename: "Const.Harness.Setup.0.1.0-x64.exe",
      url: `${RELEASES_BASE_URL}/Const.Harness.Setup.0.1.0-x64.exe`,
    },
    "win-arm64": {
      id: "win-arm64",
      filename: "Const.Harness.Setup.0.1.0-arm64.exe",
      url: `${RELEASES_BASE_URL}/Const.Harness.Setup.0.1.0-arm64.exe`,
    },
    "win-universal": {
      id: "win-universal",
      filename: "Const.Harness.Setup.0.1.0.exe",
      url: `${RELEASES_BASE_URL}/Const.Harness.Setup.0.1.0.exe`,
    },
    "linux-deb": {
      id: "linux-deb",
      filename: "const-harness_0.1.0_amd64.deb",
      url: `${RELEASES_BASE_URL}/const-harness_0.1.0_amd64.deb`,
    },
    "linux-rpm": {
      id: "linux-rpm",
      filename: "const-harness-0.1.0.x86_64.rpm",
      url: `${RELEASES_BASE_URL}/const-harness-0.1.0.x86_64.rpm`,
    },
    "linux-appimage": {
      id: "linux-appimage",
      filename: "Const-Harness-0.1.0-x86_64.AppImage",
      url: `${RELEASES_BASE_URL}/Const-Harness-0.1.0-x86_64.AppImage`,
    },
    "linux-arm-deb": {
      id: "linux-arm-deb",
      filename: "const-harness_0.1.0_arm64.deb",
      url: `${RELEASES_BASE_URL}/const-harness_0.1.0_arm64.deb`,
    },
    "linux-arm-rpm": {
      id: "linux-arm-rpm",
      filename: "const-harness-0.1.0.aarch64.rpm",
      url: `${RELEASES_BASE_URL}/const-harness-0.1.0.aarch64.rpm`,
    },
    "linux-arm-appimage": {
      id: "linux-arm-appimage",
      filename: "Const-Harness-0.1.0-arm64.AppImage",
      url: `${RELEASES_BASE_URL}/Const-Harness-0.1.0-arm64.AppImage`,
    },
    "android-apk": {
      id: "android-apk",
      filename: "Const.Harness.Setup.0.1.0.apk",
      url: `${RELEASES_BASE_URL}/Const.Harness.Setup.0.1.0.apk`,
    },
    "android-play": {
      id: "android-play",
      filename: "Google Play Store",
      url: "https://play.google.com/store/apps",
      isExternal: true,
    },
    "ios-testflight": {
      id: "ios-testflight",
      filename: "Apple TestFlight",
      url: "https://testflight.apple.com",
      isExternal: true,
    },
    "ios-appstore": {
      id: "ios-appstore",
      filename: "Apple App Store",
      url: "https://apple.com/app-store",
      isExternal: true,
    },
  };

  // Wire real builds if returned by API
  if (available && builds.length > 0) {
    for (const b of builds) {
      if (b.os === "windows" && b.arch === "x64") {
        targets["win-x64"] = { id: "win-x64", filename: b.name, url: b.url };
      } else if (b.os === "windows" && b.arch === "arm64") {
        targets["win-arm64"] = { id: "win-arm64", filename: b.name, url: b.url };
      } else if (b.os === "macos" && b.arch === "arm64") {
        targets["mac-arm64"] = { id: "mac-arm64", filename: b.name, url: b.url };
      } else if (b.os === "macos" && b.arch === "x64") {
        targets["mac-intel"] = { id: "mac-intel", filename: b.name, url: b.url };
      } else if (b.os === "linux") {
        targets["linux-appimage"] = { id: "linux-appimage", filename: b.name, url: b.url };
      }
    }
  }

  const handleDownload = (targetKey: string) => {
    const target = targets[targetKey];
    if (!target) return;

    if (target.isExternal) {
      window.open(target.url, "_blank", "noopener,noreferrer");
      return;
    }

    setDownloadToast(target.filename);
    setTimeout(() => {
      setDownloadToast(null);
    }, 4000);

    const a = document.createElement("a");
    a.href = target.url;
    a.download = target.filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="landing-page ch-download-list-page font-sans min-h-screen flex flex-col bg-[#fafafa] dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 transition-colors duration-300"
      style={{
        fontFamily:
          "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      }}
    >
      <Navbar />

      <main
        className="flex-1 pt-32 pb-24 px-6 max-w-7xl mx-auto w-full"
        id="main-content"
        tabIndex={-1}
      >
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 leading-tight select-none"
            style={{
              fontFamily:
                "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif)",
            }}
          >
            {t("builds.title")}
          </h1>
          <p
            className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed font-normal"
            style={{
              fontFamily:
                "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif)",
            }}
          >
            {t("builds.subtitle")}
          </p>

          {/* Primary Segmented Category Toggle (Desktop / Mobile) */}
          <div className="inline-flex p-1.5 rounded-full border border-zinc-200 dark:border-[#262626] bg-zinc-200/50 dark:bg-[#141414] mt-8 shadow-inner">
            <button
              type="button"
              onClick={() => setCategory("desktop")}
              className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                category === "desktop"
                  ? "bg-white dark:bg-[#222222] text-zinc-900 dark:text-white shadow-sm font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>{t("builds.tabDesktop")}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategory("mobile")}
              className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                category === "mobile"
                  ? "bg-white dark:bg-[#222222] text-zinc-900 dark:text-white shadow-sm font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              <span>{t("builds.tabMobile")}</span>
            </button>
          </div>
        </div>

        {/* Content Container matching Learn UI */}
        <AnimatePresence mode="wait">
          {category === "desktop" ? (
            <motion.div
              key="desktop"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
            >
              {/* Column 1: MacOS */}
              <div className="flex flex-col gap-3 font-sans opacity-85">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo
                    id="apple"
                    size="xs"
                    className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent"
                  />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">
                    macOS
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {t("builds.soon")}
                  </span>
                </div>

                {/* macOS (Apple Silicon) */}
                <div className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200/70 dark:border-[#262626]/70 bg-zinc-50/60 dark:bg-[#151517] text-left cursor-not-allowed font-sans select-none shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-500 dark:text-zinc-400 font-sans">
                      macOS (Apple Silicon)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-400 dark:text-zinc-500 border border-zinc-200/50 dark:border-white/5">
                      .dmg
                    </span>
                  </div>
                  <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {t("builds.soon")}
                  </span>
                </div>

                {/* macOS (Intel) */}
                <div className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200/70 dark:border-[#262626]/70 bg-zinc-50/60 dark:bg-[#151517] text-left cursor-not-allowed font-sans select-none shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-500 dark:text-zinc-400 font-sans">
                      macOS (Intel)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-400 dark:text-zinc-500 border border-zinc-200/50 dark:border-white/5">
                      .dmg
                    </span>
                  </div>
                  <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {t("builds.soon")}
                  </span>
                </div>
              </div>

              {/* Column 2: Windows */}
              <div className="flex flex-col gap-3 font-sans">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo
                    id="windows"
                    size="xs"
                    className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent"
                  />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">
                    Windows
                  </h2>
                </div>

                {/* Windows (64-bit) */}
                <button
                  type="button"
                  onClick={() => handleDownload("win-x64")}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-[#262626] bg-white dark:bg-[#18181b] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-[#202024] transition-all text-left group shadow-xs cursor-pointer font-sans"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-white transition-colors font-sans">
                      Windows (64-bit)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/5">
                      .exe
                    </span>
                  </div>
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">
                    v0.1.0
                  </span>
                </button>

                {/* Windows (ARM64) */}
                <button
                  type="button"
                  onClick={() => handleDownload("win-arm64")}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-[#262626] bg-white dark:bg-[#18181b] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-[#202024] transition-all text-left group shadow-xs cursor-pointer font-sans"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-white transition-colors font-sans">
                      Windows (ARM64)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/5">
                      .exe
                    </span>
                  </div>
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">
                    v0.1.0
                  </span>
                </button>

                {/* Windows (Universal) */}
                <button
                  type="button"
                  onClick={() => handleDownload("win-universal")}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-[#262626] bg-white dark:bg-[#18181b] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-[#202024] transition-all text-left group shadow-xs cursor-pointer font-sans"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-white transition-colors font-sans">
                      Windows (Universal)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/5">
                      .exe
                    </span>
                  </div>
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">
                    v0.1.0
                  </span>
                </button>
              </div>

              {/* Column 3: Linux */}
              <div className="flex flex-col gap-3 font-sans opacity-85">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo
                    id="linux"
                    size="xs"
                    className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent"
                  />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">
                    Linux
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {t("builds.soon")}
                  </span>
                </div>

                {/* Linux (x86_64) */}
                <div className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200/70 dark:border-[#262626]/70 bg-zinc-50/60 dark:bg-[#151517] text-left cursor-not-allowed font-sans select-none shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-500 dark:text-zinc-400 font-sans">
                      Linux (x86_64)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-400 dark:text-zinc-500 border border-zinc-200/50 dark:border-white/5">
                      .AppImage / pacman
                    </span>
                  </div>
                  <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {t("builds.soon")}
                  </span>
                </div>

                {/* Linux (ARM64) */}
                <div className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200/70 dark:border-[#262626]/70 bg-zinc-50/60 dark:bg-[#151517] text-left cursor-not-allowed font-sans select-none shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-500 dark:text-zinc-400 font-sans">
                      Linux (ARM64)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-400 dark:text-zinc-500 border border-zinc-200/50 dark:border-white/5">
                      .AppImage
                    </span>
                  </div>
                  <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {t("builds.soon")}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mobile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            >
              {/* Android Column */}
              <div className="flex flex-col gap-3 font-sans">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo
                    id="android"
                    size="xs"
                    className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent"
                  />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">
                    Android
                  </h2>
                </div>

                {/* Android Direct APK */}
                <button
                  type="button"
                  onClick={() => handleDownload("android-apk")}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-[#262626] bg-white dark:bg-[#18181b] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-[#202024] transition-all text-left group shadow-xs cursor-pointer font-sans"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-white transition-colors font-sans">
                      Android (Universal)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-100 dark:bg-[#27272a] text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/5">
                      .apk
                    </span>
                  </div>
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">
                    v0.1.0
                  </span>
                </button>

                {/* Google Play Store */}
                <button
                  type="button"
                  onClick={() => handleDownload("android-play")}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-[#262626] bg-white dark:bg-[#18181b] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-[#202024] transition-all text-left group shadow-xs cursor-pointer font-sans"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-white transition-colors font-sans">
                      Google Play Store
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Beta
                    </span>
                  </div>
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">
                    v0.1.0
                  </span>
                </button>
              </div>

              {/* iOS & iPadOS Column */}
              <div className="flex flex-col gap-3 font-sans opacity-85">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo
                    id="apple"
                    size="xs"
                    className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent"
                  />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">
                    iOS & iPadOS
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {t("builds.soon")}
                  </span>
                </div>

                {/* Apple TestFlight */}
                <div className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200/70 dark:border-[#262626]/70 bg-zinc-50/60 dark:bg-[#151517] text-left cursor-not-allowed font-sans select-none shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-500 dark:text-zinc-400 font-sans">
                      Apple TestFlight
                    </span>
                  </div>
                  <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {t("builds.soon")}
                  </span>
                </div>

                {/* Apple App Store */}
                <div className="w-full flex items-center justify-between p-4 rounded-2xl border border-zinc-200/70 dark:border-[#262626]/70 bg-zinc-50/60 dark:bg-[#151517] text-left cursor-not-allowed font-sans select-none shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-zinc-500 dark:text-zinc-400 font-sans">
                      Apple App Store
                    </span>
                  </div>
                  <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {t("builds.soon")}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Source build instruction */}
        <div className="mt-14 p-6 rounded-2xl border border-zinc-200 dark:border-[#262626] bg-white dark:bg-[#141414] max-w-3xl mx-auto shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Terminal size={15} />
              {t("builds.source")}
            </span>
            <a
              href={LINKS.releases}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("builds.releases")} →
            </a>
          </div>
          <pre className="p-3.5 rounded-xl bg-zinc-100 dark:bg-[#1c1c1f] text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto">
            <code>{`pnpm install\npnpm --filter @const/harness-desktop package:win`}</code>
          </pre>
        </div>

        {/* Back button */}
        <p className="text-center mt-8">
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            ← {t("builds.back")}
          </Link>
        </p>

        {/* Floating Download Toast */}
        <AnimatePresence>
          {downloadToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black shadow-2xl border border-white/10 dark:border-black/10"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#0066ff] animate-ping shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block">{t("builds.downloading")}</span>
                <span className="font-mono opacity-80">{downloadToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
