"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Download, RefreshCw } from "lucide-react";
import { BrandLogo } from "@const/ui";
import { useI18n } from "@/context/I18nContext";
import type { CopyKey } from "@/i18n";
import type { PublishedBuild } from "@/lib/releases";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import "./download-page.css";

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
        <BrandLogo
          id="windows"
          size="sm"
          className="ch-download-platform-icon"
        />
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
        <BrandLogo
          id="android"
          size="sm"
          className="ch-download-platform-icon"
        />
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
            {[
              { id: "apple", name: "macOS" },
              { id: "linux", name: "Linux" },
              { id: "apple", name: "iPhone" },
            ].map((platform) => (
              <div key={platform.name} className="ch-download-upcoming-item">
                <BrandLogo
                  id={platform.id}
                  size="xs"
                  className="ch-download-platform-icon"
                />
                <span>{platform.name}</span>
                <span className="ch-download-soon">{t("builds.soon")}</span>
              </div>
            ))}
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
