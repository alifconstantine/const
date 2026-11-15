"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Download, RefreshCw, Terminal } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import type { CopyKey } from "@/i18n";
import type { PublishedBuild } from "@/lib/releases";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import "./download-page.css";

function WindowsPlatformIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
    </svg>
  );
}

function AndroidPlatformIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v6c0 .83.67 1.5 1.5 1.5S5 16.33 5 15.5v-6C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-6c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 2.23 12.96 2 12 2c-.96 0-1.86.23-2.66.63L7.85 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 4.26 6 5.92 6 7.8h12c0-1.88-.97-3.54-2.47-4.64zM10 5.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm4 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
    </svg>
  );
}

function ApplePlatformIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.66 1.38-.56.65-.99 1.7-0.87 2.73 1.05.08 2.07-.53 2.61-1.24z" />
    </svg>
  );
}

export function DownloadPage({
  builds = [],
  available = false,
  arch,
  os,
}: {
  builds?: PublishedBuild[];
  available?: boolean;
  arch?: string;
  os?: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const installer = (
    platform: "windows" | "android",
    architecture: PublishedBuild["arch"],
    title: CopyKey,
    description: CopyKey,
  ) => {
    const build = available
      ? builds.find(
          (entry) => entry.os === platform && entry.arch === architecture,
        )
      : undefined;
    const primary =
      platform === "android" ||
      architecture === (arch === "arm64" ? "arm64" : "x64");
    const content = (
      <>
        <span className="ch-installer-copy">
          <span className="ch-installer-title">{t(title)}</span>
          <span className="ch-installer-description">{t(description)}</span>
          {build && (
            <span className="ch-installer-meta">
              v{build.version} <span aria-hidden="true">·</span>{" "}
              {platform === "android" ? ".apk" : ".exe"}{" "}
              <span aria-hidden="true">·</span>{" "}
              {new Intl.NumberFormat(locale, {
                style: "unit",
                unit: "megabyte",
                maximumFractionDigits: 1,
              }).format(build.size / 1_000_000)}
            </span>
          )}
        </span>
        <span className="ch-installer-action">
          {build ? (
            <>
              <span>{t("nav.cta")}</span>
              <Download size={18} aria-hidden="true" />
            </>
          ) : (
            t("builds.notPublished")
          )}
        </span>
      </>
    );
    return build ? (
      <a
        key={architecture}
        className="ch-installer-row"
        data-primary={primary}
        href={build.url}
        aria-label={`${t("nav.cta")} ${t(title)}`}
      >
        {content}
      </a>
    ) : (
      <div key={architecture} className="ch-installer-row" aria-disabled="true">
        {content}
      </div>
    );
  };

  const windows = (
    <section
      key="windows"
      className="ch-platform-download"
      aria-labelledby="download-windows"
    >
      <div className="ch-platform-heading">
        <span className="ch-download-platform-icon ch-download-platform-badge">
          <WindowsPlatformIcon size={20} />
        </span>
        <h2 id="download-windows">Windows</h2>
      </div>
      <p className="ch-platform-description">
        {t("builds.windowsDescription")}
      </p>
      <div className="ch-installer-list">
        {installer("windows", "x64", "builds.windowsX64", "builds.x64Hint")}
        {installer(
          "windows",
          "arm64",
          "builds.windowsArm64",
          "builds.arm64Hint",
        )}
      </div>
      <details className="ch-download-help">
        <summary>
          {t("builds.archHelp")}
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <p>{t("builds.archHelpBody")}</p>
      </details>
    </section>
  );
  const android = (
    <section
      key="android"
      className="ch-platform-download"
      aria-labelledby="download-android"
    >
      <div className="ch-platform-heading">
        <span className="ch-download-platform-icon ch-download-platform-badge ch-download-platform-android">
          <AndroidPlatformIcon size={21} />
        </span>
        <h2 id="download-android">Android</h2>
      </div>
      <p className="ch-platform-description">
        {t("builds.androidDescription")}
      </p>
      <div className="ch-installer-list">
        {installer(
          "android",
          "universal",
          "builds.androidApk",
          "builds.apkHint",
        )}
      </div>
      <details className="ch-download-help">
        <summary>
          {t("builds.apkHelp")}
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <ol>
          <li>{t("builds.apkStep1")}</li>
          <li>{t("builds.apkStep2")}</li>
          <li>{t("builds.apkStep3")}</li>
        </ol>
      </details>
      <p className="ch-download-remote-note">{t("builds.remoteRequirement")}</p>
    </section>
  );

  return (
    <div className="landing-page ch-download-page ch-download-list-page">
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <header className="ch-download-intro">
          <h1>{t("builds.title")}</h1>
          <p>{t("builds.subtitle")}</p>
        </header>
        {!available && (
          <div className="ch-download-status" role="status">
            <p>{t("builds.unavailable")}</p>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={refreshing ? "animate-spin" : undefined}
              />
              {t(refreshing ? "builds.checking" : "builds.retry")}
            </button>
          </div>
        )}
        {available && builds.length === 0 && (
          <p className="ch-download-status" role="status">
            {t("builds.empty")}
          </p>
        )}
        <div className="ch-download-options">
          {os === "android" ? [android, windows] : [windows, android]}
        </div>
        <section
          className="ch-download-upcoming"
          aria-labelledby="download-upcoming"
        >
          <h2 id="download-upcoming">{t("builds.morePlatforms")}</h2>
          <div className="ch-download-upcoming-list">
            <div className="ch-download-upcoming-item">
              <span className="ch-download-platform-icon ch-download-upcoming-icon">
                <ApplePlatformIcon size={16} />
              </span>
              <span>macOS</span>
              <span className="ch-download-soon">{t("builds.soon")}</span>
            </div>
            <div className="ch-download-upcoming-item">
              <span className="ch-download-platform-icon ch-download-upcoming-icon">
                <Terminal size={15} aria-hidden="true" />
              </span>
              <span>Linux</span>
              <span className="ch-download-soon">{t("builds.soon")}</span>
            </div>
            <div className="ch-download-upcoming-item">
              <span className="ch-download-platform-icon ch-download-upcoming-icon">
                <ApplePlatformIcon size={16} />
              </span>
              <span>iPhone</span>
              <span className="ch-download-soon">{t("builds.soon")}</span>
            </div>
          </div>
        </section>
        <aside className="ch-download-browser">
          <div>
            <h2>{t("builds.browserTitle")}</h2>
            <p>{t("builds.browserDescription")}</p>
          </div>
          <Link href="/remote">
            {t("builds.browserAction")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </aside>
        <Link href="/docs/getting-started" className="ch-download-guide">
          {t("builds.setupGuide")}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </main>
      <Footer />
    </div>
  );
}
