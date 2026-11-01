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
import { calculateQuotaMetrics } from "@/lib/quota";
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
    quota: { query: api.router.quotas.getUserQuota, args: {} },
    settings: { query: api.router.settings.getSettings, args: {} },
  } : {}, [isAuthenticated]);
  const result = useQueries(queries);
  const failed = result.quota instanceof Error;
  const quota: FunctionReturnType<typeof api.router.quotas.getUserQuota> | undefined = failed ? undefined : result.quota;
  const settings = result.settings instanceof Error ? undefined : result.settings;
  const metrics = calculateQuotaMetrics(quota);
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
      {failed ? <p className="text-xs text-muted-foreground">Free usage unavailable. Check Overview for details.</p> : <Link href="/dashboard" onClick={onNavigate} className="block space-y-2.5 text-xs" aria-label="View free token allowance">
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Weekly free allowance</span><span className="tabular-nums text-foreground">{quota ? metrics.formattedRemaining + " left" : "…"}</span></div>
        <div role="progressbar" aria-label="Free token allowance remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={quota ? Math.round(metrics.percentRemaining) : undefined} className="h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[var(--router-highlight)] transition-[width] duration-200 motion-reduce:transition-none" style={{ width: (quota ? metrics.percentRemaining : 0) + "%" }} /></div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{quota ? "Resets in " + metrics.resetsInText : "Loading your allowance"}</p>
      </Link>}
      {settings?.notifyLowQuota && metrics.isLow && <p role="status" className="text-xs text-amber-500">Less than 15% of free tokens remain.</p>}
    </div>}
    <div className={cn("shrink-0 pb-3", isCollapsed ? "px-2" : "px-3")}><AccountMenu isCollapsed={isCollapsed} /></div>
  </aside>;
}
