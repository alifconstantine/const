"use client";
import { Download, Layers, Monitor, Terminal } from "lucide-react";
import { GitHubIcon } from "./GitHubIcon";
import { useI18n } from "@/context/I18nContext";
import { WorkbenchPreview } from "./WorkbenchPreview";
import { LINKS } from "@/lib/links";

export function HeroSection() {
  const { t } = useI18n();
  const shortcuts = [
    { icon: Monitor, label: t("platform.0.title"), href: "#download" },
    { icon: Terminal, label: t("platform.1.title"), href: "#terminal" },
    { icon: Layers, label: t("capabilities.0.title"), href: "#features" },
    { icon: GitHubIcon, label: "GitHub", href: LINKS.repository },
  ];
  return (
    <section className="ch-hero" id="product">
      <div className="ch-shell">
        <h1 className="ch-hero-title">
          Const <span>Harness</span>
        </h1>
        <p className="ch-hero-subtitle">{t("hero.subtitle")}</p>
        <div className="ch-hero-actions">
          <a href="#download" className="ch-button ch-button-lg">
            <Download size={17} />
            {t("getstarted.primary")}
          </a>
        </div>
        <div className="ch-hero-shortcuts">
          {shortcuts.map(({ icon: Icon, label, href }) => (
            <a key={href} href={href}>
              <Icon size={21} />
              <span>{label}</span>
            </a>
          ))}
        </div>
        <div className="ch-hero-preview">
          <WorkbenchPreview />
        </div>
      </div>
    </section>
  );
}
