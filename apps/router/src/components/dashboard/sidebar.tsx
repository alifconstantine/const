"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueries, type RequestForQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { AccountMenu } from "./account-menu";
import { Button, cn, ConstLogoIcon } from "@const/ui";
import { calculateQuotaMetrics } from "@/lib/quota";
import {
  LayoutGrid,
  ScrollText,
  Key,
  Terminal,
  GitFork,
  Box,
  Bot,
  Layers,
  Settings,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  Wallet,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isExternal?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "BUILD",
    items: [
      {
        title: "API Keys",
        href: "/keys",
        icon: Key,
      },
      {
        title: "Usage logs",
        href: "/logs",
        icon: ScrollText,
      },
      {
        title: "Playground",
        href: "/generation",
        icon: Bot,
      },
      {
        title: "Combos",
        href: "/combos",
        icon: GitFork,
      },
    ],
  },
  {
    title: "DISCOVER",
    items: [
      {
        title: "Models & pricing",
        href: "/models",
        icon: Box,
      },
      {
        title: "Endpoints",
        href: "/endpoints",
        icon: Terminal,
      },
      {
        title: "Integrations",
        href: "/integrations",
        icon: Layers,
      },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      {
        title: "Credits & deposit",
        href: "/credits",
        icon: Wallet,
      },
      {
        title: "Settings & data",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
  {
    title: "DEVELOP",
    items: [
      {
        title: "Documentation",
        href: "/docs",
        icon: BookOpen,
        isExternal: true,
      },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  onNavigate,
  className,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useRouterAuth();
  // Sidebar data is optional. useQueries returns failures as values so a
  // temporarily unavailable backend cannot take down navigation or the page.
  // Convex's subscription hook tracks this object's identity. Keep it stable
  // across rerenders, including the empty pre-authentication subscription set.
  const queries = useMemo((): RequestForQueries => {
    if (!isAuthenticated) return {};
    return {
      quota: { query: api.router.quotas.getUserQuota, args: {} },
      settings: { query: api.router.settings.getSettings, args: {} },
    };
  }, [isAuthenticated]);
  const results = useQueries(queries);
  const quotaFailed = results.quota instanceof Error;
  const quota:
    FunctionReturnType<typeof api.router.quotas.getUserQuota> | undefined =
    quotaFailed ? undefined : results.quota;
  const settings:
    FunctionReturnType<typeof api.router.settings.getSettings> | undefined =
    results.settings instanceof Error ? undefined : results.settings;
  const metrics = useMemo(() => {
    return calculateQuotaMetrics(quota);
  }, [quota]);

  const isOverviewActive = pathname === "/dashboard" || pathname === "/";

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-sidebar text-sidebar-foreground select-none transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* 1. Top Logo in Sidebar matching AtmoRouter design */}
      {isCollapsed ? (
        <div className="h-14 px-2 flex items-center justify-center border-b border-border/70 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="h-14 px-4 flex items-center justify-between border-b border-border/70 shrink-0">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2.5 group min-w-0"
          >
            <ConstLogoIcon
              size="sm"
              className="w-6 h-6 text-foreground shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex items-center gap-2 truncate">
              <span className="font-serif text-lg font-normal tracking-tight text-foreground">
                Const
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                Router
              </span>
            </div>
          </Link>

          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer shrink-0"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* 2. Navigation Menus */}
      <nav className="flex-1 overflow-y-auto px-2 sm:px-3 pt-3 pb-3 space-y-3.5 scrollbar-thin">
        {/* Top-level Overview Item */}
        <div className="space-y-0.5">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            title={isCollapsed ? "Overview" : undefined}
            className={cn(
              "rounded-xl text-xs font-sans transition-colors group flex items-center",
              isCollapsed
                ? "justify-center p-2.5"
                : "justify-between px-3 py-2",
              isOverviewActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-xs"
                : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/80",
            )}
          >
            <div
              className={cn(
                "flex items-center min-w-0",
                !isCollapsed && "gap-2.5",
              )}
            >
              <LayoutGrid
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isOverviewActive
                    ? "text-sidebar-accent-foreground stroke-[2]"
                    : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground stroke-[1.75]",
                )}
              />
              {!isCollapsed && (
                <span className="truncate font-medium">Overview</span>
              )}
            </div>
          </Link>
        </div>

        {/* Categorized Navigation Sections */}
        {navSections.map((section, idx) => (
          <div key={section.title} className="space-y-0.5">
            {isCollapsed ? (
              idx > 0 && <div className="my-2 border-t border-border/30" />
            ) : (
              <h3 className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 font-semibold">
                {section.title}
              </h3>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={isCollapsed ? item.title : undefined}
                    className={cn(
                      "rounded-xl text-xs font-sans transition-colors group flex items-center",
                      isCollapsed
                        ? "justify-center p-2.5"
                        : "justify-between px-3 py-2",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-xs"
                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/80",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center min-w-0",
                        !isCollapsed && "gap-2.5",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-sidebar-accent-foreground stroke-[2]"
                            : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground stroke-[1.75]",
                        )}
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.title}</span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5">
                        {item.isExternal && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                        )}
                        {item.badge && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 3. Mini Free usage Quota Indicator in Sidebar */}
      {!isCollapsed && isAuthenticated && (
        <div className="px-2 pt-2">
          {quotaFailed ? (
            <div
              role="status"
              className="p-3 rounded-xl bg-card border border-border text-xs space-y-2"
            >
              <p className="text-muted-foreground">Free usage unavailable</p>
              <button
                type="button"
                className="underline underline-offset-4 cursor-pointer"
                onClick={() => window.location.reload()}
              >
                Retry connection
              </button>
            </div>
          ) : (
            <Link
              href="/dashboard"
              onClick={onNavigate}
              title={
                quota
                  ? `${metrics.formattedUsed} used of ${metrics.formattedLimit} free tokens`
                  : "Loading free usage"
              }
              className="block p-3 rounded-xl bg-card hover:bg-card/90 border border-border transition-all font-mono group"
            >
              <div className="flex items-center justify-between text-xs text-foreground mb-2">
                <span className="font-semibold uppercase tracking-wider text-foreground">
                  Free usage
                </span>
                <span className="tabular-nums font-bold text-foreground">
                  {quota ? `${metrics.percentRemaining.toFixed(0)}%` : "..."}
                </span>
              </div>

              {/* Full-width Graphical Progress Bar */}
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mb-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    metrics.barColor,
                  )}
                  style={{ width: `${quota ? metrics.percentRemaining : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="tabular-nums font-medium text-foreground/90">
                  {quota
                    ? `${metrics.formattedRemaining} free tokens`
                    : "Loading free usage…"}
                </span>
                <span className="uppercase text-muted-foreground">
                  {quota && metrics.resetsInText
                    ? `reset in ${metrics.resetsInText}`
                    : ""}
                </span>
              </div>
            </Link>
          )}
        </div>
      )}

      {settings?.notifyLowQuota && metrics.isLow && (
        <p role="status" className="px-4 pb-3 text-xs text-amber-500">
          {isCollapsed ? "Low quota" : "Less than 15% of free tokens remain."}
        </p>
      )}
      {/* 4. Account Profile Card at the Bottom */}
      <div className="p-2 shrink-0 bg-sidebar border-t border-border/50">
        <AccountMenu isCollapsed={isCollapsed} />
      </div>
    </aside>
  );
}
