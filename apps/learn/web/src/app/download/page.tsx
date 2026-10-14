'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo } from '@const/ui';
import { useI18n } from '../../context/I18nContext';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import CustomCursor from '../../components/CustomCursor';

type PlatformCategory = 'desktop' | 'mobile';
type LinuxPkg = 'pacman' | 'aur' | 'apt' | 'dnf';

const linuxCommands: Record<LinuxPkg, string> = {
  pacman: 'sudo pacman -S constlearn',
  aur: 'yay -S const-learn-bin',
  apt: 'sudo apt install ./const-learn.deb',
  dnf: 'sudo dnf install ./const-learn.rpm',
};

interface DownloadTarget {
  id: string;
  filename: string;
  url: string;
  isExternal?: boolean;
}

const RELEASES_BASE_URL = 'https://github.com/alifconstantine/const/releases/latest/download';

export default function DownloadPage() {
  const { t } = useI18n();
  const [category, setCategory] = useState<PlatformCategory>('desktop');
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [linuxPkg, setLinuxPkg] = useState<LinuxPkg>('pacman');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const targets: Record<string, DownloadTarget> = {
    'mac-arm64': { id: 'mac-arm64', filename: 'Const-Learn-0.0.1-arm64.dmg', url: `${RELEASES_BASE_URL}/Const-Learn-0.0.1-arm64.dmg` },
    'mac-intel': { id: 'mac-intel', filename: 'Const-Learn-0.0.1-x64.dmg', url: `${RELEASES_BASE_URL}/Const-Learn-0.0.1-x64.dmg` },
    'win-x64': { id: 'win-x64', filename: 'Const-Learn-Setup-0.0.1-x64.exe', url: `${RELEASES_BASE_URL}/Const-Learn-Setup-0.0.1-x64.exe` },
    'win-arm64': { id: 'win-arm64', filename: 'Const-Learn-Setup-0.0.1-arm64.exe', url: `${RELEASES_BASE_URL}/Const-Learn-Setup-0.0.1-arm64.exe` },
    'linux-deb': { id: 'linux-deb', filename: 'const-learn_0.0.1_amd64.deb', url: `${RELEASES_BASE_URL}/const-learn_0.0.1_amd64.deb` },
    'linux-rpm': { id: 'linux-rpm', filename: 'const-learn-0.0.1.x86_64.rpm', url: `${RELEASES_BASE_URL}/const-learn-0.0.1.x86_64.rpm` },
    'linux-appimage': { id: 'linux-appimage', filename: 'Const-Learn-0.0.1-x86_64.AppImage', url: `${RELEASES_BASE_URL}/Const-Learn-0.0.1-x86_64.AppImage` },
    'linux-arm-deb': { id: 'linux-arm-deb', filename: 'const-learn_0.0.1_arm64.deb', url: `${RELEASES_BASE_URL}/const-learn_0.0.1_arm64.deb` },
    'linux-arm-rpm': { id: 'linux-arm-rpm', filename: 'const-learn-0.0.1.aarch64.rpm', url: `${RELEASES_BASE_URL}/const-learn-0.0.1.aarch64.rpm` },
    'linux-arm-appimage': { id: 'linux-arm-appimage', filename: 'Const-Learn-0.0.1-arm64.AppImage', url: `${RELEASES_BASE_URL}/Const-Learn-0.0.1-arm64.AppImage` },
    'android-apk': { id: 'android-apk', filename: 'Const-Learn-0.0.1.apk', url: `${RELEASES_BASE_URL}/Const-Learn-0.0.1.apk` },
    'android-play': { id: 'android-play', filename: 'Google Play Store', url: 'https://play.google.com/store/apps', isExternal: true },
    'ios-testflight': { id: 'ios-testflight', filename: 'Apple TestFlight', url: 'https://testflight.apple.com', isExternal: true },
  };

  const handleDownload = (targetKey: string) => {
    const target = targets[targetKey];
    if (!target) return;

    if (target.isExternal) {
      window.open(target.url, '_blank', 'noopener,noreferrer');
      return;
    }

    setDownloadToast(target.filename);
    setTimeout(() => {
      setDownloadToast(null);
    }, 4000);

    const a = document.createElement('a');
    a.href = target.url;
    a.download = target.filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyCommand = (cmd: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      setTimeout(() => {
        setCopiedCmd(false);
      }, 2000);
    }
  };

  return (
    <div
      className="landing-page font-sans min-h-screen flex flex-col bg-[#fafafa] dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 transition-colors duration-300"
      style={{ fontFamily: "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)" }}
    >
      <CustomCursor />
      <Navbar />

      <main className="flex-1 pt-32 pb-24 px-6 max-w-7xl mx-auto w-full">
        {/* Header Hero - Clean without top badge, crisp Inter typography */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 leading-tight select-none"
            style={{ fontFamily: "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif)" }}
          >
            {t.downloadPage.title}
          </h1>
          <p
            className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed font-normal"
            style={{ fontFamily: "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif)" }}
          >
            {t.downloadPage.subtitle}
          </p>

          {/* Primary Segmented Category Toggle (Desktop / Mobile) */}
          <div className="inline-flex p-1.5 rounded-full border border-zinc-200 dark:border-[#262626] bg-zinc-200/50 dark:bg-[#141414] mt-8 shadow-inner">
            <button
              type="button"
              onClick={() => setCategory('desktop')}
              className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                category === 'desktop'
                  ? 'bg-white dark:bg-[#222222] text-zinc-900 dark:text-white shadow-sm font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>{t.downloadPage.tabDesktop}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategory('mobile')}
              className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                category === 'mobile'
                  ? 'bg-white dark:bg-[#222222] text-zinc-900 dark:text-white shadow-sm font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              <span>{t.downloadPage.tabMobile}</span>
            </button>
          </div>
        </div>

        {/* Content Container matching Image 1 */}
        <AnimatePresence mode="wait">
          {category === 'desktop' ? (
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
                  <BrandLogo id="apple" size="xs" className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">MacOS</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Soon
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
                    Soon
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
                    Soon
                  </span>
                </div>
              </div>

              {/* Column 2: Windows */}
              <div className="flex flex-col gap-3 font-sans">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo id="windows" size="xs" className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">Windows</h2>
                </div>

                {/* Windows (64-bit) */}
                <button
                  type="button"
                  onClick={() => handleDownload('win-x64')}
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
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">v0.0.1</span>
                </button>

                {/* Windows (ARM64) */}
                <button
                  type="button"
                  onClick={() => handleDownload('win-arm64')}
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
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">v0.0.1</span>
                </button>
              </div>

              {/* Column 3: Linux */}
              <div className="flex flex-col gap-3 font-sans">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo id="linux" size="xs" className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">Linux</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    Beta
                  </span>
                </div>

                {/* Linux Terminal Package Manager Card */}
                <div className="w-full flex flex-col justify-between p-4 rounded-2xl border border-zinc-200 dark:border-[#262626] bg-white dark:bg-[#18181b] shadow-xs font-sans min-h-[124px]">
                  {/* Top bar: package manager pills & copy button */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-[#27272a] border border-zinc-200/80 dark:border-white/5">
                      {(['pacman', 'aur', 'apt', 'dnf'] as const).map((pkg) => (
                        <button
                          key={pkg}
                          type="button"
                          onClick={() => setLinuxPkg(pkg)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                            linuxPkg === pkg
                              ? 'bg-white dark:bg-[#1e1e22] text-zinc-900 dark:text-white font-semibold shadow-xs'
                              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {pkg}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyCommand(linuxCommands[linuxPkg])}
                      className="inline-flex items-center gap-1.5 text-xs font-sans font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#27272a] hover:bg-zinc-200 dark:hover:bg-[#323238] border border-zinc-200/80 dark:border-white/5 transition-all cursor-pointer select-none"
                      title="Copy install command"
                    >
                      {copiedCmd ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Command code block styled adaptively */}
                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-[#121214] px-3.5 py-2.5 rounded-xl border border-zinc-200/70 dark:border-white/5 overflow-x-auto select-all">
                    <span className="text-zinc-400 dark:text-zinc-500 select-none font-semibold">$</span>
                    <span className="font-medium tracking-tight whitespace-nowrap">{linuxCommands[linuxPkg]}</span>
                  </div>
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
                  <BrandLogo id="android" size="xs" className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">Android</h2>
                </div>

                {/* Android Direct APK */}
                <button
                  type="button"
                  onClick={() => handleDownload('android-apk')}
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
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">v0.0.1</span>
                </button>

                {/* Google Play Store */}
                <button
                  type="button"
                  onClick={() => handleDownload('android-play')}
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
                  <span className="text-xs font-sans font-normal text-zinc-400 dark:text-zinc-500">v0.0.1</span>
                </button>
              </div>

              {/* iOS & iPadOS Column */}
              <div className="flex flex-col gap-3 font-sans opacity-85">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <BrandLogo id="apple" size="xs" className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight font-sans">iOS & iPadOS</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Soon
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
                    Soon
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
                    Soon
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                <span className="font-semibold block">Downloading...</span>
                <span className="font-mono opacity-80">{downloadToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer with giant ConstLearn wordmark */}
      <Footer />
    </div>
  );
}
