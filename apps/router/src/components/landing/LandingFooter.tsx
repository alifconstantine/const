"use client";

import React from "react";
import Link from "next/link";
import { ConstLogoIcon } from "@const/ui";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="sub-footer" data-section="footer">
      <div className="container sub-footer-inner max-w-7xl mx-auto px-6">
        {/* Navigation Grid (Clean, real links only - no phantom columns) */}
        <div className="sub-footer-grid">
          {/* Col 1: Product */}
          <div className="sub-footer-col">
            <h5>Product</h5>
            <ul>
              <li>
                <Link href="/">Const Router</Link>
              </li>
              <li>
                <a href="https://learn.const.web.id" target="_blank" rel="noopener noreferrer">
                  Const Learn
                </a>
              </li>
              <li>
                <a href="https://accounts.const.web.id" target="_blank" rel="noopener noreferrer">
                  Const Accounts
                </a>
              </li>
              <li>
                <Link href="/dashboard">Dashboard</Link>
              </li>
            </ul>
          </div>

          {/* Col 2: Developers */}
          <div className="sub-footer-col">
            <h5>Developers</h5>
            <ul>
              <li>
                <Link href="/docs">Documentation</Link>
              </li>
              <li>
                <a href="#models">Model Catalog</a>
              </li>
              <li>
                <a href="#start">Quickstart SDK</a>
              </li>
              <li>
                <a href="#pricing">Token Pricing</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Ecosystem */}
          <div className="sub-footer-col">
            <h5>Ecosystem</h5>
            <ul>
              <li>
                <a href="https://github.com/alifconstantine/const" target="_blank" rel="noopener noreferrer">
                  GitHub Repository
                </a>
              </li>
              <li>
                <Link href="/docs">API Reference</Link>
              </li>
              <li>
                <Link href="/models">Model Rates</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Policies */}
          <div className="sub-footer-col">
            <h5>Legal</h5>
            <ul>
              <li>
                <Link href="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <a href="#billing">Billing Rules</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Foot Bar */}
        <div className="foot-bar">
          <div className="foot-bar-left">
            <span className="foot-copy">
              &copy; {currentYear} Const Platform. Universal AI Gateway.
            </span>
            <span className="foot-dot" aria-hidden="true">&bull;</span>
            <Link href="/privacy">Privacy</Link>
            <span className="foot-dot" aria-hidden="true">&bull;</span>
            <Link href="/terms">Terms</Link>
            <span className="foot-dot" aria-hidden="true">&bull;</span>
            <span className="text-[#34d399] inline-flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
              All Systems Operational
            </span>
          </div>

          <div className="foot-social">
            <a
              href="https://discord.gg/EmBACq2xED"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.3 4.5A19.8 19.8 0 0015.4 3l-.4.7a14.6 14.6 0 014.3 2.1 13.6 13.6 0 00-11.6 0A14.6 14.6 0 0112 3.7L11.6 3a19.8 19.8 0 00-4.9 1.5C3.6 9.1 2.8 13.6 3.2 18a19.9 19.9 0 006 3l.8-1.3a13 13 0 01-2.1-1c.2-.1.4-.3.6-.4a14.2 14.2 0 0012 0l.6.4a13 13 0 01-2.1 1l.8 1.3a19.9 19.9 0 006-3c.5-5.1-.8-9.6-3.5-13.5zM9.3 15.3c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3zm5.4 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3z" />
              </svg>
            </a>
            <a
              href="https://github.com/alifconstantine/const"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Masthead Wordmark Watermark */}
        <div className="foot-masthead">
          <p className="foot-masthead-wordmark">
            Const<span className="foot-masthead-accent">Router</span><span className="foot-masthead-period">.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
