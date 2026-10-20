"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { Card, Skeleton, cn } from "@const/ui";
import { Zap, Clock, ImageIcon } from "lucide-react";

import { calculateQuotaMetrics } from "@/lib/quota";

export function QuotaCard({ className }: { className?: string }) {
  const { isAuthenticated } = useRouterAuth();
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );

  const metrics = useMemo(() => {
    return calculateQuotaMetrics(quota);
  }, [quota]);

  if (!isAuthenticated) return null;

  return (
    <Card
      className={cn(
        "rounded-3xl border border-border/70 bg-card p-5 sm:p-6 shadow-none transition-colors flex flex-col justify-between h-full gap-5",
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
              <span>Resets in {metrics.resetsInText}</span>
            </div>
          </div>

          {/* Tokens Quota */}
          <div className="space-y-3">
            {/* Top row: Big Number on Left, Percentage on Right */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-sans tabular-nums leading-none">
                  {metrics.formattedRemaining}
                </div>
                <div className="text-xs text-muted-foreground font-normal font-sans pt-0.5">
                  tokens left
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground font-sans tabular-nums leading-none">
                  {metrics.percentRemaining.toFixed(0)}%
                </div>
                <div className="text-[11px] text-muted-foreground font-light font-sans pt-1">
                  remaining
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden border border-border/40 p-[1px]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  metrics.barColor
                )}
                style={{ width: `${metrics.percentRemaining}%` }}
              />
            </div>

            {/* Details: Used vs Limit */}
            <div className="flex items-center justify-between text-xs text-muted-foreground font-sans tabular-nums">
              <span>
                <strong className="font-medium text-foreground/90">
                  {metrics.formattedUsed}
                </strong>{" "}
                used
              </span>
              <span>
                of{" "}
                <strong className="font-medium text-foreground/90">
                  {metrics.formattedLimit}
                </strong>{" "}
                limit
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-border/50" />

          {/* Images Quota (Generations & Edits) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Images</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground font-normal">
                  Generate &amp; Edit
                </span>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                <strong className="font-semibold text-foreground">
                  {metrics.remainingImages}
                </strong>{" "}
                left
              </div>
            </div>

            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border/40 p-[1px]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  metrics.isImageCapped
                    ? "bg-rose-500"
                    : metrics.percentImagesRemaining <= 25
                    ? "bg-amber-400"
                    : "bg-foreground"
                )}
                style={{ width: `${metrics.percentImagesRemaining}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground font-sans tabular-nums">
              <span>
                <strong className="font-medium text-foreground/90">
                  {metrics.usedImages}
                </strong>{" "}
                used
              </span>
              <span>
                of{" "}
                <strong className="font-medium text-foreground/90">
                  {metrics.limitImages}
                </strong>{" "}
                images / week
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
