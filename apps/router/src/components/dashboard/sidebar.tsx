"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { AccountMenu } from "./account-menu";
import { Button, cn } from "@const/ui";
import {
  LayoutGrid,
  ScrollText,
  Key,
  Terminal,
  GitFork,
  Box,
  Cpu,
  Bot,
  Layers,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutGrid,
      },
      {
        title: "Request logs",
        href: "/logs",
        icon: ScrollText,
      },
    ],
  },
  {
    title: "DEVELOPER",
    items: [
      {
        title: "API keys",
        href: "/keys",
        icon: Key,
      },
      {
        title: "Endpoints",
        href: "/endpoints",
        icon: Terminal,
      },
      {
        title: "Combos",
        href: "/combos",
        icon: GitFork,
      },
      {
        title: "Models",
        href: "/models",
        icon: Box,
      },
      {
        title: "Providers",
        href: "/providers",
        icon: Cpu,
      },
      {
        title: "Generation",
        href: "/generation",
        icon: Bot,
      },
      {
        title: "Integrations",
        href: "/integrations",
        icon: Layers,
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
  const [searchQuery, setSearchQuery] = useState("");
  const { isAuthenticated } = useRouterAuth();
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );

  const sidebarPercentRemaining = useMemo(() => {
    const limit = quota?.weeklyLimitTokens || 7_000_000;
    const remaining = quota?.remainingTokens ?? limit;
    return Math.max(0, Math.min(100, (remaining / limit) * 100));
  }, [quota?.remainingTokens, quota?.weeklyLimitTokens]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return navSections;
    const query = searchQuery.toLowerCase().trim();

    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.title.toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery]);

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-[#2b2b2b] text-[#d4d4d4] select-none transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Top Header Row of Sidebar: Search on left & Close icon on right */}
      {isCollapsed ? (
        <div className="h-14 px-2 flex items-center justify-center shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 rounded-lg text-[#969696] hover:text-white cursor-pointer"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-3 shrink-0">
          {/* Search Input positioned on the left */}
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#5d5d5d] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full h-8 pl-8 pr-7 rounded-lg bg-[#1b1b1b] text-xs text-[#d4d4d4] placeholder:text-[#5d5d5d] outline-none border border-[#2e2e2e] focus:border-[#383838] transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-[#969696] hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Sidebar Close Button */}
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-8 w-8 rounded-lg text-[#969696] hover:text-white hover:bg-[#383838] cursor-pointer shrink-0"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Navigation Menus */}
      <nav className="flex-1 overflow-y-auto px-2 sm:px-3 py-3 space-y-4 scrollbar-thin">
        {filteredSections.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-[#969696]">
            {isCollapsed ? "—" : `No menus found for "${searchQuery}"`}
          </div>
        ) : (
          filteredSections.map((section, idx) => (
            <div key={section.title} className="space-y-0.5">
              {isCollapsed ? (
                idx > 0 && <div className="my-2" />
              ) : (
                <h3 className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#969696] font-semibold">
                  {section.title}
                </h3>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href || pathname?.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.title : undefined}
                      className={cn(
                        "rounded-xl text-xs font-sans transition-colors group flex items-center",
                        isCollapsed
                          ? "justify-center p-2"
                          : "justify-between px-2.5 py-2",
                        isActive
                          ? "bg-[#383838] text-white font-medium"
                          : "text-[#d4d4d4] hover:text-white hover:bg-[#383838]/80"
                      )}
                    >
                      <div className={cn("flex items-center min-w-0", !isCollapsed && "gap-2.5")}>
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive
                              ? "text-white stroke-[2]"
                              : "text-[#d4d4d4] group-hover:text-white stroke-[1.75]"
                          )}
                        />
                        {!isCollapsed && <span className="truncate">{item.title}</span>}
                      </div>
                      {!isCollapsed && item.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[#1b1b1b] text-[#969696] border border-[#2e2e2e]">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Mini Quota Indicator in Sidebar */}
      {!isCollapsed && isAuthenticated && (
        <div className="px-2 pt-2">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="block p-3 rounded-xl bg-[#1b1b1b] hover:bg-[#222222] border border-[#2e2e2e] transition-all font-mono group"
          >
            <div className="flex items-center justify-between text-xs text-white mb-2">
              <span className="font-semibold uppercase tracking-wider text-white">
                FREE QUOTA
              </span>
              <span className="tabular-nums font-bold text-white">
                {quota ? `${sidebarPercentRemaining.toFixed(0)}%` : "..."}
              </span>
            </div>

            {/* Full-width Graphical Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-[#2a2a2a] overflow-hidden mb-2">
              <div
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${sidebarPercentRemaining}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-white">
              <span className="tabular-nums font-medium text-white">
                {quota
                  ? `${(quota.remainingTokens / 1_000_000).toFixed(1)}M / 7M left`
                  : "7.0M / 7M left"}
              </span>
              <span className="uppercase text-white">
                {quota?.resetsInText ? `reset in ${quota.resetsInText}` : ""}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Account Profile Card at the Bottom */}
      <div className="p-2 shrink-0 bg-[#2b2b2b]">
        <AccountMenu isCollapsed={isCollapsed} />
      </div>
    </aside>
  );
}
