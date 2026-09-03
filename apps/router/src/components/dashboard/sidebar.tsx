"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  CreditCard,
  Gift,
  CircleHelp,
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
        "h-full flex flex-col bg-card border-r border-border select-none transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Top Header Row of Sidebar: Search on left & Close icon on right */}
      {isCollapsed ? (
        <div className="h-14 px-2 flex items-center justify-center border-b border-border/70 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-3 border-b border-border/70 shrink-0">
          {/* Search Input positioned on the left */}
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full h-8 pl-8 pr-7 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
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
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0"
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
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            {isCollapsed ? "—" : `No menus found for "${searchQuery}"`}
          </div>
        ) : (
          filteredSections.map((section, idx) => (
            <div key={section.title} className="space-y-0.5">
              {isCollapsed ? (
                idx > 0 && <div className="my-2 border-t border-border/40" />
              ) : (
                <h3 className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 font-semibold">
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
                          ? "bg-secondary text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      <div className={cn("flex items-center min-w-0", !isCollapsed && "gap-2.5")}>
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive
                              ? "text-foreground stroke-[2]"
                              : "text-muted-foreground group-hover:text-foreground stroke-[1.75]"
                          )}
                        />
                        {!isCollapsed && <span className="truncate">{item.title}</span>}
                      </div>
                      {!isCollapsed && item.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border">
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

      {/* Account Profile Card at the Bottom */}
      <div className="p-2 border-t border-border shrink-0 bg-card">
        <AccountMenu isCollapsed={isCollapsed} />
      </div>
    </aside>
  );
}
