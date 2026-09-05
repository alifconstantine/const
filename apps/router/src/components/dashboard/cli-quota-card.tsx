"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { Card, Skeleton, cn } from "@const/ui";
import { Terminal, ShieldCheck, Zap } from "lucide-react";

function formatTokenAmount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

function generateAsciiBar(percent: number, totalLength = 24): { bar: string; colorClass: string } {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * totalLength);
  const unfilled = Math.max(0, totalLength - filled);
  const bar = `${"█".repeat(filled)}${"░".repeat(unfilled)}`;

  let colorClass = "text-emerald-400";
  if (clamped >= 90) {
    colorClass = "text-rose-500";
  } else if (clamped >= 70) {
    colorClass = "text-amber-400";
  }

  return { bar, colorClass };
}

export function CliQuotaCard({ className }: { className?: string }) {
  const { isAuthenticated } = useRouterAuth();
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );

  const { bar, colorClass } = useMemo(() => {
    return generateAsciiBar(quota?.percentUsed ?? 0, 24);
  }, [quota?.percentUsed]);

  if (!isAuthenticated) return null;

  return (
    <Card
      className={cn(
        "rounded-2xl border border-border/70 bg-zinc-950/60 dark:bg-zinc-950/80 backdrop-blur-sm p-4 sm:p-5 font-mono shadow-xs overflow-hidden transition-all",
        className
      )}
    >
      {/* Terminal Top Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground font-semibold select-none">$</span>
          <span className="text-foreground/90 font-medium">
            const quota --status
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground border border-border/50 font-medium">
            TIER: FREE (WEEKLY)
          </span>
          {quota && (
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border font-semibold",
                quota.isCapped
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              )}
            >
              {quota.isCapped ? "CAPPED" : "HEALTHY"}
            </span>
          )}
        </div>
      </div>

      {/* ASCII Gauge Section */}
      <div className="pt-4 pb-2 space-y-3">
        {quota ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className={cn("text-base sm:text-lg font-bold tracking-tighter select-all", colorClass)}>
                  [{bar}]
                </span>
                <span className={cn("text-xs sm:text-sm font-semibold tabular-nums", colorClass)}>
                  {quota.percentUsed.toFixed(1)}%
                </span>
              </div>

              <div className="text-xs sm:text-sm text-foreground/90 font-semibold tabular-nums">
                {formatTokenAmount(quota.usedTokens)}{" "}
                <span className="text-muted-foreground font-normal">
                  / {formatTokenAmount(quota.weeklyLimitTokens)} TOKENS
                </span>
              </div>
            </div>

            {/* CLI Breakdown Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/60 select-none">&gt;</span>
                <span>REMAINING:</span>
                <span className="text-foreground font-medium tabular-nums">
                  {formatTokenAmount(quota.remainingTokens)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/60 select-none">&gt;</span>
                <span>RESETS IN:</span>
                <span className="text-foreground font-medium tabular-nums uppercase">
                  {quota.resetsInText}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:justify-end">
                <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="text-[10px] text-emerald-400/90 font-medium tracking-tight">
                  BYOK TRAFFIC: UNMETERED
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2 py-1">
            <Skeleton className="h-5 w-64 rounded bg-secondary/50" />
            <Skeleton className="h-4 w-full rounded bg-secondary/30" />
          </div>
        )}
      </div>
    </Card>
  );
}
