"use client";
import { Languages } from "lucide-react";
import { GitHubIcon } from "./GitHubIcon";
import { useI18n } from "@/context/I18nContext";
import { ThemeToggle } from "./ui/theme-toggle";
import { LINKS } from "@/lib/links";
interface FooterColumn {
  heading: string;
  links: [label: string, href: string][];
}

export function Footer() {
  const { t, locale, setLocale, locales } = useI18n();
  const columns: FooterColumn[] = [
    {
      heading: t("footer.col.product"),
      links: [
        [t("footer.col.capabilities"), "/#features"],
        [t("footer.link.tasks"), "/#capabilities"],
        [t("footer.col.platforms"), "/#platforms"],
        [t("footer.link.comparison"), "/#comparison"],
        [t("footer.link.download"), "/download"],
      ],
    },
    {
      heading: t("footer.col.platforms"),
      links: [
        ["Windows", "/download?os=windows"],
        ["macOS", "/download?os=macos"],
        ["Linux", "/download?os=linux"],
        ["Android", "/download?os=android"],
        ["iOS", "/download?os=ios"],
      ],
    },
    {
      heading: t("footer.col.capabilities"),
      links: [
        [t("capabilities.0.title"), "/#features"],
        [t("capabilities.1.title"), "/#features"],
        [t("capabilities.2.title"), "/#features"],
        [t("capabilities.3.title"), "/#features"],
        [t("capabilities.4.title"), "/#features"],
      ],
    },
    {
      heading: t("footer.col.ecosystem"),
      links: [
        [t("footer.link.router"), LINKS.router],
        [t("footer.link.accounts"), LINKS.accounts],
        [t("footer.link.learn"), LINKS.learn],
        ["Model Context Protocol", "https://modelcontextprotocol.io"],
      ],
    },
    {
      heading: t("footer.col.resources"),
      links: [
        [t("footer.link.docs"), LINKS.docs],
        [t("footer.link.changelog"), LINKS.changelog],
        [t("footer.link.releases"), LINKS.releases],
        [t("faq.short"), "/#faq"],
        [t("nav.start"), "/#get-started"],
      ],
    },
    {
      heading: t("footer.col.company"),
      links: [
        [t("footer.link.platform"), "https://const.web.id"],
        [t("footer.link.source"), LINKS.repository],
        [t("footer.link.issues"), LINKS.issues],
        [t("footer.link.pullRequests"), LINKS.pulls],
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
                {column.links.map(([label, href]) => {
                  const isExternal = href.startsWith("http");
                  return (
                    <li key={label}>
                      <a
                        className="ch-footer-link"
                        href={href}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                      >
                        {label}
                      </a>
                    </li>
                  );
                })}
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
            <a
              href={LINKS.repository}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
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
