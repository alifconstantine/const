"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { Card, Skeleton, cn } from "@const/ui";

function formatTokenAmount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

function generateRemainingAsciiBar(
  percentRemaining: number,
  totalLength = 24
): { bar: string; colorClass: string } {
  const clamped = Math.max(0, Math.min(100, percentRemaining));
  let filled = Math.round((clamped / 100) * totalLength);
  if (clamped > 0 && filled === 0) filled = 1;
  if (clamped < 100 && filled === totalLength) filled = totalLength - 1;
  const unfilled = Math.max(0, totalLength - filled);
  const bar = `${"█".repeat(filled)}${"░".repeat(unfilled)}`;

  let colorClass = "text-foreground";
  if (clamped <= 10) {
    colorClass = "text-rose-500";
  } else if (clamped <= 30) {
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

  const percentRemaining = useMemo(() => {
    if (!quota) return 100;
    const limit = quota.weeklyLimitTokens || 7_000_000;
    return Math.max(0, Math.min(100, (quota.remainingTokens / limit) * 100));
  }, [quota]);

  const { bar, colorClass } = useMemo(() => {
    return generateRemainingAsciiBar(percentRemaining, 24);
  }, [percentRemaining]);

  if (!isAuthenticated) return null;

  return (
    <Card
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 sm:p-5 font-mono shadow-xs transition-all",
        className
      )}
    >
      {quota ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-foreground/80">
              FREE WEEKLY QUOTA
            </span>
            <span className="tabular-nums">
              Resets in {quota.resetsInText}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "text-base sm:text-lg font-bold tracking-tighter select-all",
                  colorClass
                )}
              >
                [{bar}]
              </span>
              <span
                className={cn(
                  "text-xs sm:text-sm font-semibold tabular-nums",
                  colorClass
                )}
              >
                {percentRemaining.toFixed(0)}%
              </span>
            </div>

            <div className="text-xs sm:text-sm text-foreground/90 font-medium tabular-nums">
              {formatTokenAmount(quota.remainingTokens)}{" "}
              <span className="text-muted-foreground font-normal">
                / {formatTokenAmount(quota.weeklyLimitTokens)} tokens left
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 py-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded bg-secondary/50" />
            <Skeleton className="h-4 w-24 rounded bg-secondary/50" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-56 rounded bg-secondary/50" />
            <Skeleton className="h-5 w-32 rounded bg-secondary/30" />
          </div>
        </div>
      )}
    </Card>
  );
}
