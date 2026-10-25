"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { LINKS } from "@/lib/links";
import type { DesktopBuild } from "@/lib/releases";

export function DownloadPage({
  builds,
  available,
  arch,
  os,
}: {
  builds: DesktopBuild[];
  available: boolean;
  arch?: string;
  os?: string;
}) {
  const { t } = useI18n();
  const platforms = [
    { id: "windows", label: "Windows", command: "package:win" },
    { id: "macos", label: "macOS", command: "package:mac" },
    { id: "linux", label: "Linux", command: "package:linux" },
  ];
  const queryFor = (value?: string) =>
    "/download" +
    (value || os
      ? "?" +
        new URLSearchParams({
          ...(value ? { arch: value } : {}),
          ...(os ? { os } : {}),
        })
      : "");
  return (
    <>
      <Navbar />
      <main className="ch-download-page" id="main-content" tabIndex={-1}>
        <div className="ch-shell">
          <h1 className="ch-title">{t("builds.title")}</h1>
          <p className="ch-subtitle">{t("builds.subtitle")}</p>
          <nav className="ch-download-filters" aria-label={t("builds.arch")}>
            {[
              { value: undefined, label: t("builds.all") },
              { value: "x64", label: "x64" },
              { value: "arm64", label: "ARM64" },
            ].map((item) => (
              <Link
                key={item.label}
                href={queryFor(item.value)}
                className={`ch-button ${arch === item.value ? "ch-button-primary" : "ch-button-secondary"}`}
                aria-current={arch === item.value ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ch-download-builds">
            {platforms
              .filter(
                (platform) =>
                  !os ||
                  !platforms.some((item) => item.id === os) ||
                  platform.id === os,
              )
              .map((platform) => {
                const matches = builds.filter(
                  (build) =>
                    build.os === platform.id &&
                    (!arch ||
                      !["x64", "arm64"].includes(arch) ||
                      build.arch === arch ||
                      build.arch === "universal"),
                );
                return (
                  <article className="ch-download-build" key={platform.id}>
                    <h2>{platform.label}</h2>
                    {matches.length ? (
                      matches.map((build) => (
                        <a
                          key={build.url}
                          href={build.url}
                          className="ch-button ch-button-primary"
                        >
                          <Download size={16} />
                          <span>{build.name}</span>
                        </a>
                      ))
                    ) : (
                      <p>
                        {t(available ? "builds.empty" : "builds.unavailable")}
                      </p>
                    )}
                    <a href={LINKS.releases} className="ch-text-link">
                      {t("builds.releases")}
                    </a>
                    <a href={LINKS.docs} className="ch-text-link">
                      {t("builds.source")}
                    </a>
                    <pre>
                      <code>{`pnpm install\npnpm --filter @const/harness-desktop ${platform.command}`}</code>
                    </pre>
                  </article>
                );
              })}
          </div>
          <p className="ch-note">
            <Link href="/">{t("builds.back")}</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
