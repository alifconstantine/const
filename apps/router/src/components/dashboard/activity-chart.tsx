"use client";

import { useId, useMemo, useState } from "react";
import { ScrollArea, cn } from "@const/ui";
import {
  chartBuckets,
  formatUsd,
  type TimelinePoint,
} from "@/lib/router-analytics";
import { formatTokenAmount } from "@/lib/quota";

export function ActivityChart({
  timeline,
  range,
}: {
  timeline: TimelinePoint[];
  range: string;
}) {
  const [metric, setMetric] = useState<"tokens" | "requests" | "costUsd">(
    "tokens",
  );
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const points = useMemo(
    () => chartBuckets(timeline, range),
    [timeline, range],
  );
  const max = Math.max(0, ...points.map((point) => point[metric]));
  const format = (value: number) =>
    metric === "costUsd"
      ? formatUsd(value)
      : metric === "tokens"
        ? formatTokenAmount(value)
        : value.toLocaleString();
  const selected = active === null ? undefined : points[active];
  const date = (timestamp: number) =>
    new Date(timestamp).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Usage over time</h2>
        <div className="flex gap-1" role="group" aria-label="Chart metric">
          {(
            [
              ["tokens", "Tokens"],
              ["requests", "Requests"],
              ["costUsd", "Cost · USD"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={metric === value}
              onClick={() => {
                setMetric(value);
                setActive(null);
              }}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                metric === value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!timeline.length ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm">No activity in this period</p>
          <p className="max-w-xs text-xs leading-5 text-muted-foreground">
            Send a request from the playground or your SDK, or choose another
            date range to see earlier activity.
          </p>
        </div>
      ) : (
        <>
          <div
            className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            <span>
              {selected
                ? date(selected.timestamp)
                : "All model tiers · aggregated hourly telemetry"}
            </span>
            <span className="text-foreground">
              {selected
                ? `${format(selected[metric])} ${metric === "costUsd" ? "USD" : metric}`
                : `${format(max)} peak`}
            </span>
          </div>
          <svg
            viewBox="0 0 800 206"
            className="h-52 w-full overflow-visible"
            role="img"
            aria-labelledby={titleId}
            preserveAspectRatio="none"
          >
            <title id={titleId}>
              {metric === "costUsd" ? "Paid cost in USD" : metric} over the
              selected period. Exact values are available in the data table
              below.
            </title>
            {[0, 1, 2, 3].map((line) => (
              <line
                key={line}
                x1="0"
                x2="800"
                y1={line * 64 + 4}
                y2={line * 64 + 4}
                stroke="currentColor"
                className="text-border"
                strokeDasharray={line === 3 ? undefined : "3 5"}
              />
            ))}
            {points.map((point, index) => {
              const width = 800 / points.length;
              const height = (point[metric] / (max || 1)) * 180;
              return (
                <g key={point.timestamp}>
                  <rect
                    x={index * width}
                    y="0"
                    width={width}
                    height="200"
                    fill="transparent"
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                  />
                  <rect
                    x={index * width + 1}
                    y={196 - height}
                    width={Math.max(1, width - 3)}
                    height={height}
                    rx="1.5"
                    fill="currentColor"
                    className={
                      active === index
                        ? "text-foreground"
                        : "text-[var(--router-highlight)]"
                    }
                    pointerEvents="none"
                  >
                    <title>
                      {date(point.timestamp)}: {format(point[metric])}
                    </title>
                  </rect>
                </g>
              );
            })}
          </svg>
          <div className="flex justify-between gap-3 text-[11px] text-muted-foreground">
            <span>{date(points[0]!.timestamp)}</span>
            <span>{date(points[points.length - 1]!.timestamp)}</span>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              View chart data
            </summary>
            <ScrollArea
              className="mt-3 max-h-60"
              orientation="both"
              viewportRef={(node) => {
                if (node) {
                  node.tabIndex = 0;
                  node.setAttribute("aria-label", "Usage chart data");
                  node.setAttribute("role", "region");
                }
              }}
            >
              <table className="w-full min-w-[440px] text-left tabular-nums">
                <caption className="sr-only">Usage by time bucket</caption>
                <thead>
                  <tr>
                    {["Period start", "Requests", "Tokens", "Cost (USD)"].map(
                      (label) => (
                        <th key={label} className="py-2 pr-4 font-medium">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr
                      key={point.timestamp}
                      className="border-t border-border"
                    >
                      <td className="py-2 pr-4">{date(point.timestamp)}</td>
                      <td>{point.requests.toLocaleString()}</td>
                      <td>{point.tokens.toLocaleString()}</td>
                      <td>{formatUsd(point.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </details>
        </>
      )}
    </div>
  );
}
