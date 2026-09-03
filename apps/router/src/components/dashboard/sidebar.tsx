"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account-menu";
import {
  LayoutGrid,
  TrendingUp,
  ScrollText,
  Trophy,
  Key,
  Terminal,
  GitFork,
  Box,
  Cpu,
  Bot,
  Layers,
  Activity,
  CreditCard,
  Gift,
  CircleHelp,
  Ticket,
  Search,
  ChevronsLeft,
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
        title: "Overview",
        href: "/dashboard",
        icon: LayoutGrid,
      },
      {
        title: "Usage",
        href: "/usage",
        icon: TrendingUp,
      },
      {
        title: "Request logs",
        href: "/logs",
        icon: ScrollText,
      },
      {
        title: "Leaderboard",
        href: "/leaderboard",
        icon: Trophy,
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
      {
        title: "Status",
        href: "/status",
        icon: Activity,
      },
    ],
  },
  {
    title: "SUBSCRIPTION",
    items: [
      {
        title: "Billing",
        href: "/billing",
        icon: CreditCard,
      },
      {
        title: "Referral",
        href: "/referral",
        icon: Gift,
      },
      {
        title: "Help",
        href: "/help",
        icon: CircleHelp,
      },
    ],
  },
  {
    title: "SUPPORT",
    items: [
      {
        title: "Ticketing",
        href: "/ticketing",
        icon: Ticket,
      },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

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
      className={`w-64 h-full flex flex-col bg-card border-r border-border select-none transition-colors ${
        className || ""
      }`}
    >
      {/* Search Bar at the top of the Sidebar */}
      <div className="px-3 py-3 border-b border-border/70 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full h-8 pl-8 pr-7 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff] transition-all font-sans"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <span className="absolute right-2 text-[10px] font-mono text-muted-foreground/50 select-none">
              <ChevronsLeft className="h-3.5 w-3.5 text-muted-foreground/40" />
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
        {filteredSections.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No menus found for &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <h3 className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 font-semibold">
                {section.title}
              </h3>
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
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans transition-colors group ${
                        isActive
                          ? "bg-secondary text-foreground font-medium border-l-2 border-[#0066ff] rounded-l-none pl-2"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-foreground stroke-[2]"
                              : "text-muted-foreground group-hover:text-foreground stroke-[1.75]"
                          }`}
                        />
                        <span className="truncate">{item.title}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border">
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

      {/* Account Section at the Bottom */}
      <div className="p-2.5 border-t border-border shrink-0 bg-card">
        <AccountMenu />
      </div>
    </aside>
  );
}
