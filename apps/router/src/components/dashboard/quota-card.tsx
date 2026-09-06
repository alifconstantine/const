"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { Card, Skeleton, cn } from "@const/ui";
import { Zap, Clock } from "lucide-react";

function formatTokenAmount(tokens: number): string {
  if (tokens < 1000) return `${tokens.toLocaleString()}`;
  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  const m = tokens / 1_000_000;
  return m % 1 === 0 ? `${m}M` : `${m.toFixed(2)}M`;
}

export function QuotaCard({ className }: { className?: string }) {
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

  const barColor = useMemo(() => {
    if (percentRemaining <= 10) return "bg-rose-500";
    if (percentRemaining <= 30) return "bg-amber-400";
    return "bg-[#d4d4d4]";
  }, [percentRemaining]);

  if (!isAuthenticated) return null;

  return (
    <Card
      className={cn(
        "rounded-3xl border border-border/70 bg-card p-5 sm:p-6 shadow-none transition-colors flex flex-col justify-between h-full",
        className
      )}
    >
      {quota ? (
        <>
          {/* Header without subheading */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/50 shrink-0">
                <Zap className="h-4 w-4 stroke-[1.75]" />
              </div>
              <span className="text-sm font-semibold text-foreground font-sans tracking-tight">
                Free Weekly Quota
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border/50 text-[11px] font-sans text-muted-foreground tabular-nums shrink-0">
              <Clock className="h-3 w-3 text-muted-foreground/80" />
              <span>Resets in {quota.resetsInText}</span>
            </div>
          </div>

          {/* Main Body: Clean Metric + Sleek Linear Bar */}
          <div className="space-y-3.5 my-auto py-1">
            {/* Top row: Big Number on Left, Percentage on Right */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground font-sans tabular-nums leading-none">
                  {formatTokenAmount(quota.remainingTokens)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground font-normal font-sans pt-0.5">
                  token left
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-sans tabular-nums leading-none">
                  {percentRemaining.toFixed(0)}%
                </div>
                <div className="text-[11px] text-muted-foreground font-light font-sans pt-1">
                  remaining
                </div>
              </div>
            </div>

            {/* Sleek Minimalist Progress Bar */}
            <div className="h-3 w-full bg-[#242424] rounded-full overflow-hidden border border-border/40 p-[1.5px]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  barColor
                )}
                style={{ width: `${percentRemaining}%` }}
              />
            </div>

            {/* Bottom Row Details: Used vs Limit */}
            <div className="flex items-center justify-between text-xs text-muted-foreground font-sans tabular-nums">
              <span>
                <strong className="font-medium text-foreground/90">
                  {formatTokenAmount(quota.usedTokens)}
                </strong>{" "}
                used
              </span>
              <span>
                of{" "}
                <strong className="font-medium text-foreground/90">
                  {formatTokenAmount(quota.weeklyLimitTokens)}
                </strong>{" "}
                limit
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col justify-between h-full space-y-4">
          <div className="w-full flex justify-between items-center">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="space-y-3 py-2">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <Skeleton className="h-9 w-28 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-8 w-14 rounded" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// Backward-compatibility aliases
export { QuotaCard as CliQuotaCard, QuotaCard as WeeklyQuotaCard };
