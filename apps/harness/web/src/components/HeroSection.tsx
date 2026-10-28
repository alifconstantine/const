"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, Globe } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { WorkbenchPreview } from "./WorkbenchPreview";

function WindowsIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.801" />
    </svg>
  );
}

function AppleIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.66 1.38-.56.65-.99 1.7-0.87 2.73 1.05.08 2.07-.53 2.61-1.24z" />
    </svg>
  );
}

function AndroidIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v6c0 .83.67 1.5 1.5 1.5S5 16.33 5 15.5v-6C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-6c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 2.23 12.96 2 12 2c-.96 0-1.86.23-2.66.63L7.85 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 4.26 6 5.92 6 7.8h12c0-1.88-.97-3.54-2.47-4.64zM10 5.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm4 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
    </svg>
  );
}

export function HeroSection() {
  const { t } = useI18n();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Supported platforms: Web, Windows, Mac, iOS, Android (Web & Mobile are remote clients for the desktop app)
  const platforms = [
    {
      id: "web",
      icon: Globe,
      label: "Web",
      detail: "Browser Remote · No installation needed",
      href: "/download?os=web",
    },
    {
      id: "windows",
      icon: WindowsIcon,
      label: "Windows",
      detail: "Windows 10/11 (.exe) · x64 / ARM64",
      href: "/download?os=windows",
    },
    {
      id: "macos",
      icon: AppleIcon,
      label: "Mac",
      detail: "macOS 12+ (.dmg) · Apple Silicon & Intel",
      href: "/download?os=macos",
    },
    {
      id: "ios",
      icon: AppleIcon,
      label: "iOS",
      detail: "iPhone & iPad · Mobile remote control",
      href: "/download?os=ios",
    },
    {
      id: "android",
      icon: AndroidIcon,
      label: "Android",
      detail: "Android 9+ (.apk) · Mobile remote control",
      href: "/download?os=android",
    },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section className="ch-hero" id="product">
      <div className="ch-hero-backdrop-glow" aria-hidden="true" />
      <div className="ch-hero-shell">
        {/* Top Header: Title, Subtitle, CTA, Platforms */}
        <div className="ch-hero-header">
          <h1 className="ch-hero-main-title">Const Harness</h1>
          <p className="ch-hero-main-subtitle">
            {t("hero.subtitle")}
          </p>

          {/* Download CTA Dropdown Button */}
          <div className="ch-hero-cta-wrap" ref={dropdownRef}>
            <div className="relative inline-block">
              <button
                type="button"
                className="ch-hero-download-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <WindowsIcon size={16} />
                <span>{t("hero.downloadButton") || "Download Const Harness"}</span>
                <ChevronDown
                  size={14}
                  className={`opacity-70 ml-0.5 transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu with 4 platforms */}
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    className="ch-download-dropdown-menu"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    <div className="ch-dropdown-header">
                      <span>Desktop App & Remote (Web / Mobile)</span>
                    </div>
                    <div className="ch-dropdown-list">
                      {platforms.map((p) => {
                        const Icon = p.icon;
                        return (
                          <a
                            key={p.id}
                            href={p.href}
                            className="ch-dropdown-item"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <div className="ch-dropdown-item-icon">
                              <Icon size={18} />
                            </div>
                            <div className="ch-dropdown-item-info">
                              <div className="ch-dropdown-item-title">
                                <span>{p.label}</span>
                              </div>
                              <span className="ch-dropdown-item-desc">{p.detail}</span>
                            </div>
                            <ExternalLink size={13} className="ch-dropdown-item-arrow" />
                          </a>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Platforms Badges Row: Only Windows, Mac, iOS, Android */}
          <div
            className="ch-hero-platforms-row"
            role="navigation"
            aria-label="Supported platforms"
          >
            {platforms.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                className="ch-hero-platform-pill"
                title={`Download for ${label}`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Elevated App Window Mockup */}
        <div className="ch-hero-preview-container">
          <WorkbenchPreview />
        </div>
      </div>
    </section>
  );
}
