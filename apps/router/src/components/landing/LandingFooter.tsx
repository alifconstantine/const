import Link from "next/link";
import { ConstLogoIcon } from "@const/ui";
import { ArrowUpRight } from "lucide-react";
export function LandingFooter() {
  return (
    <footer className="router-footer">
      <div className="router-container">
        <div className="router-footer-main">
          <div>
            <Link href="/" className="router-brand">
              <ConstLogoIcon size="md" />
              <span>
                Const<span className="router-brand-product">Router</span>
              </span>
            </Link>
            <p>A single connection to your next model.</p>
          </div>
          <nav aria-label="Product links">
            <Link href="/models">Models &amp; rates</Link>
            <Link href="/docs">Documentation</Link>
            <Link href="/dashboard">Dashboard</Link>
            <a
              href="https://github.com/alifconstantine/const"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub <ArrowUpRight size={13} />
            </a>
          </nav>
          <nav aria-label="Const ecosystem">
            <a href="https://learn.const.web.id">
              Const Learn <ArrowUpRight size={13} />
            </a>
            <a href="https://accounts.const.web.id">
              Const Accounts <ArrowUpRight size={13} />
            </a>
            <a
              href="https://discord.gg/EmBACq2xED"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord <ArrowUpRight size={13} />
            </a>
          </nav>
        </div>
        <div className="router-footer-bottom">
          <span>© {new Date().getFullYear()} Const</span>
          <div>
            <Link href="/docs">API reference</Link>
            <Link href="/docs#models-allowance">Billing</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
