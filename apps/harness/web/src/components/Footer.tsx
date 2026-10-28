"use client";
import { Languages } from "lucide-react";
import { GitHubIcon } from "./GitHubIcon";
import { useI18n } from "@/context/I18nContext";
import { ThemeToggle } from "./ui/theme-toggle";
import { LINKS } from "@/lib/links";
export function Footer() {
  const { t, locale, setLocale, locales } = useI18n();
  const columns = [
    {
      heading: t("footer.col.product"),
      links: [
        [t("footer.link.desktop"), "/#product"],
        [t("footer.link.learn"), LINKS.learn],
        [t("footer.link.router"), LINKS.router],
        [t("footer.link.accounts"), LINKS.accounts],
      ],
    },
    {
      heading: t("footer.col.platforms"),
      links: [
        ["Windows", "/download?os=windows"],
        ["Mac", "/download?os=macos"],
        ["iOS", "/download?os=ios"],
        ["Android", "/download?os=android"],
        [t("footer.link.download"), "/download"],
      ],
    },
    {
      heading: t("footer.col.capabilities"),
      links: [
        [t("capabilities.0.title"), "/#features"],
        [t("capabilities.2.title"), "/#features"],
        [t("capabilities.4.title"), "/#terminal"],
        [t("platform.2.title"), "/#platforms"],
      ],
    },
    {
      heading: t("footer.col.ecosystem"),
      links: [
        [t("footer.link.platform"), "https://const.web.id"],
        ["Model Context Protocol", "https://modelcontextprotocol.io"],
        ["Const Router", LINKS.router],
        ["GitHub", LINKS.repository],
      ],
    },
    {
      heading: t("footer.col.resources"),
      links: [
        [t("footer.link.docs"), LINKS.docs],
        [t("footer.link.changelog"), LINKS.changelog],
        [t("footer.link.cli"), LINKS.cli],
        [t("faq.short"), "/#faq"],
      ],
    },
    {
      heading: t("footer.col.company"),
      links: [
        [t("footer.link.about"), "https://const.web.id"],
        [t("footer.link.contact"), `${LINKS.repository}/issues`],
        [t("footer.link.source"), LINKS.repository],
        [t("footer.link.releases"), LINKS.releases],
      ],
    },
  ];
  return (
    <footer className="ch-footer">
      <div className="ch-shell ch-shell-wide">
        <div className="ch-footer-grid">
          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="ch-footer-heading">{column.heading}</h3>
              <ul className="ch-footer-links">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a className="ch-footer-link" href={href}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="ch-footer-bottom">
          <span>{t("footer.copyright")}</span>
          <div className="ch-footer-controls">
            <Languages size={17} />
            <select
              className="ch-locale-select"
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value as typeof locale)
              }
              aria-label={t("footer.language")}
            >
              {locales.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
            </select>
            <ThemeToggle />
            <a href={LINKS.repository} aria-label="GitHub">
              <GitHubIcon size={19} />
            </a>
          </div>
        </div>
        <div className="ch-footer-masthead" aria-label="Const Harness">
          Const<span>Harness</span>
          <span>.</span>
        </div>
      </div>
    </footer>
  );
}
