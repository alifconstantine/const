"use client";

import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { Skeleton, cn } from "@const/ui";
import { calculateQuotaMetrics, type QuotaLike } from "@/lib/quota";

export function QuotaView({
  quota,
  className,
}: {
  quota?: QuotaLike;
  className?: string;
}) {
  const metrics = calculateQuotaMetrics(quota);
  return (
    <section
      aria-label="Weekly free allowance"
      className={cn(
        "flex h-full flex-col justify-between gap-5 rounded-xl border border-border bg-card p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-medium">Weekly free allowance</h2>
        <p className="text-xs text-muted-foreground">
          {quota ? `Resets in ${metrics.resetsInText}` : "Loading…"}
        </p>
      </div>
      {quota ? (
        <>
          <div>
            <p className="text-3xl font-medium tracking-tight tabular-nums">
              {metrics.formattedRemaining}
              <span className="ml-2 text-xs font-normal tracking-normal text-muted-foreground">
                tokens left
              </span>
            </p>
            <div
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Free tokens remaining"
              aria-valuemin={0}
              aria-valuemax={metrics.limitTokens}
              aria-valuenow={metrics.remainingTokens}
            >
              <div
                className={
                  metrics.isLow
                    ? "h-full bg-amber-400"
                    : "h-full bg-[var(--router-highlight)]"
                }
                style={{ width: `${metrics.percentRemaining}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
              <span>{metrics.formattedUsed} used</span>
              <span>{metrics.formattedLimit} per week</span>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                Image generations & edits
              </span>
              <span className="tabular-nums">
                {metrics.remainingImages} remaining
              </span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Free images remaining"
              aria-valuemin={0}
              aria-valuemax={metrics.limitImages}
              aria-valuenow={metrics.remainingImages}
            >
              <div
                className={
                  metrics.isImageCapped
                    ? "h-full bg-red-400"
                    : "h-full bg-[var(--router-highlight)]"
                }
                style={{ width: `${metrics.percentImagesRemaining}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {metrics.usedImages} of {metrics.limitImages} used this week
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
    </section>
  );
}
export function QuotaCard({ className }: { className?: string }) {
  const { isAuthenticated } = useRouterAuth();
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip",
  );
  if (!isAuthenticated) return null;
  return <QuotaView quota={quota} className={className} />;
}
export { QuotaCard as CliQuotaCard, QuotaCard as WeeklyQuotaCard };
