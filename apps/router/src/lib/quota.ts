/**
 * Shared Token and Quota Utilities for Const Router
 * Provides unified token formatting and reactive quota calculation across
 * sidebar, dashboard, models catalog, and settings.
 */

export interface QuotaLike {
  weeklyLimitTokens?: number;
  usedTokens?: number;
  remainingTokens?: number;
  percentRemaining?: number;
  percentUsed?: number;
  resetsInText?: string;
  isCapped?: boolean;
}

export interface QuotaMetrics {
  limitTokens: number;
  usedTokens: number;
  remainingTokens: number;
  percentRemaining: number;
  percentUsed: number;
  resetsInText: string;
  isCapped: boolean;
  isLow: boolean;       // <= 15% remaining
  isCritical: boolean;  // <= 5% remaining
  barColor: string;     // Rose if critical/low, amber if moderate, foreground if healthy
  formattedRemaining: string;
  formattedUsed: string;
  formattedLimit: string;
}

export const DEFAULT_WEEKLY_LIMIT = 7_000_000;

/**
 * Consistently format token counts with human-readable SI suffixes (k, M).
 * Examples:
 *   - 0 -> "0"
 *   - 850 -> "850"
 *   - 1200 -> "1.2k"
 *   - 50000 -> "50k"
 *   - 146000 -> "146k"
 *   - 146500 -> "146.5k"
 *   - 6850000 -> "6.85M"
 *   - 7000000 -> "7M"
 */
export function formatTokenAmount(tokens?: number | null): string {
  if (tokens === undefined || tokens === null || isNaN(tokens) || tokens <= 0) {
    return "0";
  }

  if (tokens < 1000) {
    return Math.round(tokens).toLocaleString();
  }

  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    const rounded = Math.round(k * 10) / 10;
    return rounded % 1 === 0 ? `${rounded.toFixed(0)}k` : `${rounded.toFixed(1)}k`;
  }

  const m = tokens / 1_000_000;
  const rounded = Math.round(m * 100) / 100;
  if (rounded % 1 === 0) return `${rounded.toFixed(0)}M`;
  if ((rounded * 10) % 1 === 0) return `${rounded.toFixed(1)}M`;
  return `${rounded.toFixed(2)}M`;
}

/**
 * Calculates uniform quota metrics from a Convex quota document or state.
 */
export function calculateQuotaMetrics(quota?: QuotaLike | null): QuotaMetrics {
  const limitTokens = quota?.weeklyLimitTokens || DEFAULT_WEEKLY_LIMIT;
  const usedTokens = quota?.usedTokens ?? 0;
  const remainingTokens = quota?.remainingTokens ?? Math.max(0, limitTokens - usedTokens);

  const percentRemaining = Math.max(
    0,
    Math.min(100, (remainingTokens / limitTokens) * 100)
  );

  const percentUsed = Math.max(
    0,
    Math.min(100, (usedTokens / limitTokens) * 100)
  );

  const isLow = percentRemaining <= 15;
  const isCritical = percentRemaining <= 5;

  let barColor = "bg-foreground";
  if (percentRemaining <= 10) {
    barColor = "bg-rose-500";
  } else if (percentRemaining <= 30) {
    barColor = "bg-amber-400";
  }

  return {
    limitTokens,
    usedTokens,
    remainingTokens,
    percentRemaining,
    percentUsed,
    resetsInText: quota?.resetsInText || "7d",
    isCapped: quota?.isCapped ?? (usedTokens >= limitTokens),
    isLow,
    isCritical,
    barColor,
    formattedRemaining: formatTokenAmount(remainingTokens),
    formattedUsed: formatTokenAmount(usedTokens),
    formattedLimit: formatTokenAmount(limitTokens),
  };
}
