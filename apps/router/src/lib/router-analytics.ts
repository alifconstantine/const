export function formatUsd(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.000001)
    return value < 0 ? "−<$0.000001" : "<$0.000001";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export type TimelinePoint = {
  timestamp: number;
  tokens: number;
  requests: number;
  costUsd: number;
};

/** Sum hourly telemetry into elapsed-time buckets without dropping older usage. */
export function chartBuckets(
  timeline: TimelinePoint[],
  range: string,
  now = Date.now(),
): TimelinePoint[] {
  if (!timeline.length) return [];
  const hour = 3_600_000;
  const end = Math.max(now, ...timeline.map((point) => point.timestamp));
  const start =
    range === "today" || range === "24h"
      ? end - 24 * hour
      : range === "7d"
        ? end - 7 * 24 * hour
        : range === "30d"
          ? end - 30 * 24 * hour
          : Math.min(...timeline.map((point) => point.timestamp));
  const step = Math.max(hour, Math.ceil((end - start) / (48 * hour)) * hour);
  const first = Math.floor(start / step) * step;
  const buckets = Array.from(
    { length: Math.floor((end - first) / step) + 1 },
    (_, index) => ({
      timestamp: first + index * step,
      tokens: 0,
      requests: 0,
      costUsd: 0,
    }),
  );
  for (const point of timeline) {
    const index = Math.floor((point.timestamp - first) / step);
    const bucket = buckets[index];
    if (bucket) {
      bucket.tokens += point.tokens;
      bucket.requests += point.requests;
      bucket.costUsd += point.costUsd;
    }
  }
  return buckets;
}
