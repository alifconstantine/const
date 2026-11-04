"use client";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueries, type RequestForQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { AccountMenu } from "./account-menu";
import { Button, ScrollArea, cn, ConstLogoIcon } from "@const/ui";
import { formatUsd } from "@/lib/router-analytics";
import { LayoutGrid, ScrollText, Key, Terminal, GitFork, Box, Bot, Settings, BookOpen, PanelLeftClose, PanelLeftOpen, Wallet } from "lucide-react";

const navigation = [
  { title: "Workspace", items: [
    { title: "Overview", href: "/dashboard", icon: LayoutGrid },
    { title: "Playground", href: "/generation", icon: Bot },
    { title: "Models & pricing", href: "/models", icon: Box },
    { title: "Endpoints", href: "/endpoints", icon: Terminal },
  ] },
  { title: "Manage", items: [
    { title: "API keys", href: "/keys", icon: Key },
    { title: "Usage logs", href: "/logs", icon: ScrollText },
    { title: "Combos", href: "/combos", icon: GitFork },
  ] },
  { title: "Account", items: [
    { title: "Credits", href: "/credits", icon: Wallet },
    { title: "Settings", href: "/settings", icon: Settings },
  ] },
];
export function Sidebar({ onNavigate, className, isCollapsed = false, onToggleCollapse }: {
  onNavigate?: () => void; className?: string; isCollapsed?: boolean; onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { isAuthenticated } = useRouterAuth();
  const queries = useMemo((): RequestForQueries => isAuthenticated ? {
    wallet: { query: api.router.credits.getUserCredits, args: {} },
  } : {}, [isAuthenticated]);
  const result = useQueries(queries);
  const failed = result.wallet instanceof Error;
  const wallet: FunctionReturnType<typeof api.router.credits.getUserCredits> | undefined = failed ? undefined : result.wallet;
  return <aside aria-label="Workspace navigation" className={cn("flex h-full w-full min-h-0 flex-col bg-sidebar text-sidebar-foreground", className)}>
    <div className={cn("flex h-20 shrink-0 items-center gap-2", isCollapsed ? "justify-center px-2" : "justify-between px-5")}>
      {!isCollapsed && <Link href="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5 text-foreground" aria-label="Const Router overview"><ConstLogoIcon size="sm" className="size-6 shrink-0" /><span className="text-base font-semibold tracking-tight">Const<span className="ml-1.5 font-normal text-muted-foreground">Router</span></span></Link>}
      {onToggleCollapse && <Button variant="ghost" size="icon" onClick={onToggleCollapse} aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"} className="size-8 shrink-0 text-muted-foreground">{isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}</Button>}
    </div>
    <ScrollArea className="min-h-0 flex-1">
      <nav className={cn("space-y-7 pb-6", isCollapsed ? "px-3" : "px-3.5")}>
        {navigation.map(section => <div key={section.title} className="space-y-1">
          {!isCollapsed && <h2 className="mb-2 px-3 text-[11px] font-medium text-muted-foreground">{section.title}</h2>}
          {section.items.map(item => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={isCollapsed ? item.title : undefined}
              className={cn("flex min-h-10 items-center gap-3 rounded-lg text-[13px] transition-colors", isCollapsed ? "justify-center px-2" : "px-3", active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              <Icon className={cn("size-4 shrink-0 stroke-[1.65]", active && "text-[var(--router-highlight)]")} />{!isCollapsed && <span>{item.title}</span>}
            </Link>;
          })}
        </div>)}
      </nav>
    </ScrollArea>
    {!isCollapsed && <div className="shrink-0 space-y-4 px-5 pb-4">
      <Link href="/docs" onClick={onNavigate} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><BookOpen className="size-3.5" />Documentation</Link>
      {failed ? <p className="text-xs text-muted-foreground">Balance unavailable. Open Credits to retry.</p> : <Link href="/credits" onClick={onNavigate} className="block space-y-2 text-xs" aria-label="View credit balance">
        <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Available credit</span><span className="tabular-nums text-foreground">{wallet ? formatUsd(wallet.availableUsd) : "…"}</span></div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">Add credit with QRIS</p>
      </Link>}
    </div>}
    <div className={cn("shrink-0 pb-3", isCollapsed ? "px-2" : "px-3")}><AccountMenu isCollapsed={isCollapsed} /></div>
  </aside>;
}
