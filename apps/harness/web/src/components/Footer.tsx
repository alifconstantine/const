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
        [t("nav.product"), "/product"],
        [t("nav.integrations"), "/integrations"],
        [t("footer.link.remote"), "/docs/remote-control"],
        [t("footer.link.scheduled"), "/docs/scheduled-tasks"],
        [t("footer.link.download"), "/download"],
      ],
    },
    {
      heading: t("footer.col.resources"),
      links: [
        [t("footer.link.docs"), LINKS.docs],
        [t("nav.start"), "/docs/getting-started"],
        [t("footer.link.models"), "/docs/models"],
        [t("footer.link.data"), "/docs/privacy-and-data"],
        [t("footer.link.issues"), LINKS.issues],
      ],
    },
    {
      heading: t("footer.col.ecosystem"),
      links: [
        [t("nav.ecosystem"), "/ecosystem"],
        [t("footer.link.router"), LINKS.router],
        [t("footer.link.accounts"), LINKS.accounts],
        [t("footer.link.learn"), LINKS.learn],
        [t("footer.link.platform"), "https://const.web.id"],
      ],
    },
    {
      heading: t("footer.col.company"),
      links: [
        [t("footer.link.source"), LINKS.repository],
        [t("footer.link.releases"), LINKS.releases],
        [t("footer.link.changelog"), LINKS.changelog],
        [t("footer.link.privacy"), "/privacy-policy"],
        [t("footer.link.terms"), "/terms-of-service"],
      ],
    },
  ];
  return (
    <footer className="ch-footer">
      <div className="ch-shell ch-shell-wide">
        <div className="ch-footer-grid ch-footer-grid-pages">
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
