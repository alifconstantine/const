"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { Squircle } from "@/components/ui/github-activity-utils/squircle";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@const/ui";

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export type Contribution = {
  date: string;
  count: number;
  level: ContributionLevel;
  isFuture?: boolean;
};

export type GitHubActivityVariant = "white" | "calamansi" | "slate" | "citrus";

const DEFAULT_CELL_SIZE = 11;
const DEFAULT_MONTHS = 12;

const gapFor = (cellSize: number) => Math.max(2, Math.round(cellSize / 4));

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const CELL_FADE = { duration: 0.18, ease: EASE_OUT } as const;
const TOOLTIP_FADE = { duration: 0.12, ease: EASE_OUT } as const;
const TOOLTIP_EDGE = 8;
const COLUMN_STAGGER = 0.008;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const SURFACE = [
  "relative w-full p-4 font-sans select-none rounded-2xl shadow-xs",
  "sm:p-5",
].join(" ");

const VARIANTS: Record<GitHubActivityVariant, { paint: string; ink: string }> =
  {
    white: {
      paint: "bg-white dark:bg-[#18181a] border border-[#dedee2] dark:border-[#2f2f32]",
      ink: "text-foreground",
    },
    calamansi: {
      paint: [
        "bg-gradient-to-br from-[#8fa37d] via-[#5c7a67] to-[#39564a]",
        "dark:from-[#1b281f] dark:via-[#16221a] dark:to-[#0e1611]",
      ].join(" "),
      ink: "text-white",
    },
    slate: {
      paint: [
        "bg-gradient-to-br from-[#a79cb7] via-[#687396] to-[#4a5a7f]",
        "dark:from-[#1e1b4b] dark:via-[#1e293b] dark:to-[#0f172a]",
      ].join(" "),
      ink: "text-white",
    },
    citrus: {
      paint: [
        "bg-gradient-to-br from-[#d69f7e] via-[#b87152] to-[#7d4128]",
        "dark:from-[#2e170c] dark:via-[#22120b] dark:to-[#140a06]",
      ].join(" "),
      ink: "text-white",
    },
  };

const ACCENTS: Record<GitHubActivityVariant, { empty: string; levels: string[] }> = {
  white: {
    empty: "bg-[#e5e5e8] dark:bg-[#252528] hover:bg-[#d4d4d8] dark:hover:bg-[#323236]",
    levels: [
      "bg-[#1d4ed8] dark:bg-[#1e3a5f]",
      "bg-[#2563eb] dark:bg-[#2b5a8f]",
      "bg-[#3b82f6] dark:bg-[#3b82f6]",
      "bg-[#60a5fa] dark:bg-[#60a5fa]",
    ],
  },
  calamansi: {
    empty: "bg-white/10 dark:bg-white/5 hover:bg-white/20",
    levels: ["#d9f2a6", "#b4e84c", "#8fc22f", "#5f8a14"],
  },
  slate: {
    empty: "bg-white/10 dark:bg-white/5 hover:bg-white/20",
    levels: ["#cfc7e0", "#a79cb7", "#7a83a8", "#4a5a7f"],
  },
  citrus: {
    empty: "bg-white/10 dark:bg-white/5 hover:bg-white/20",
    levels: ["#ffdcb4", "#ffbc80", "#ff9e3d", "#c4691b"],
  },
};

type HoveredDay = { day: Contribution; x: number; y: number };

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatTokensCompact(tokens: number): string {
  if (!tokens || tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

function describeDay({ count, date }: Contribution) {
  const parsedDate = new Date(`${date}T12:00:00Z`);
  const dateStr = isNaN(parsedDate.getTime()) ? date : DATE_FORMAT.format(parsedDate);
  if (count <= 0) {
    return `No tokens on ${dateStr}`;
  }
  return `${formatTokensCompact(count)} tokens (${count.toLocaleString()}) on ${dateStr}`;
}

function toWeeks(contributions: Contribution[]) {
  const weeks: Contribution[][] = [];
  for (let i = 0; i < contributions.length; i += 7) {
    weeks.push(contributions.slice(i, i + 7));
  }
  return weeks;
}

const MIN_LABEL_WEEKS = 3;

function toMonthLabels(weeks: Contribution[][]) {
  const labels: (string | null)[] = weeks.map(() => null);
  const monthAt = (index: number) => {
    const day = weeks[index]?.[3] || weeks[index]?.[0];
    return day?.date ? day.date.slice(5, 7) : "";
  };

  let start = 0;
  for (let i = 1; i <= weeks.length; i++) {
    if (i < weeks.length && monthAt(i) === monthAt(start)) continue;
    if (i - start >= MIN_LABEL_WEEKS) {
      const mNum = Number(monthAt(start));
      if (mNum >= 1 && mNum <= 12) {
        labels[start] = MONTH_NAMES[mNum - 1] ?? null;
      }
    }
    start = i;
  }

  return labels;
}

const Tooltip = ({
  hovered,
  reduceMotion,
}: {
  hovered: HoveredDay;
  reduceMotion: boolean | null;
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const half = el.offsetWidth / 2;
    const edge = TOOLTIP_EDGE + half;
    el.style.left = `${Math.min(Math.max(hovered.x, edge), window.innerWidth - edge)}px`;
  }, [hovered]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-none fixed z-50"
      style={{
        left: hovered.x,
        top: hovered.y,
        transform: "translate(-50%, calc(-100% - 8px))",
      }}
    >
      <motion.div
        className="font-sans whitespace-nowrap rounded-lg bg-[#111113] text-white border border-[#2f2f35] px-2.5 py-1.5 text-[11px] font-medium shadow-xl"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        transition={reduceMotion ? { duration: 0 } : TOOLTIP_FADE}
      >
        {describeDay(hovered.day)}
      </motion.div>
    </div>,
    document.body,
  );
};

const ContributionGrid = ({
  contributions,
  variant,
  cellSize,
  label,
  reduceMotion,
}: {
  contributions: Contribution[];
  variant: GitHubActivityVariant;
  cellSize: number;
  label: string;
  reduceMotion: boolean | null;
}) => {
  const weeks = React.useMemo(() => toWeeks(contributions), [contributions]);
  const gap = gapFor(cellSize);
  const [hovered, setHovered] = React.useState<HoveredDay>();
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to the end (latest contributions) on initial mount or contributions update
  React.useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = viewportRef.current.scrollWidth;
    }
  }, [weeks]);

  const hover = (day: Contribution) => (event: React.PointerEvent) => {
    const cell = event.currentTarget.getBoundingClientRect();
    setHovered({ day, x: cell.left + cell.width / 2, y: cell.top });
  };

  const accentConfig = ACCENTS[variant];
  const isClassBased = variant === "white";

  // Calculate month labels aligned with columns
  const monthLabels = React.useMemo(() => toMonthLabels(weeks), [weeks]);

  return (
    <div
      data-slot="github-activity-grid"
      role="img"
      aria-label={label}
      className="relative w-full"
    >
      <ScrollArea
        orientation="horizontal"
        viewportRef={viewportRef}
        className="w-full pb-1"
        thumbClassName="bg-zinc-400/50 hover:bg-zinc-400 dark:bg-zinc-600/60 dark:hover:bg-zinc-500"
      >
        <div className="min-w-fit flex flex-col gap-1.5 mx-auto px-0.5 py-0.5">
          {/* Month Headers aligned above the grid */}
          <div className="relative h-4 w-full text-[10px] font-sans text-current/50 select-none">
            {monthLabels.map((mLabel, weekIdx) => {
              if (!mLabel) return null;
              const leftPx = weekIdx * (cellSize + gap);
              return (
                <span
                  key={`${mLabel}-${weekIdx}`}
                  style={{ left: `${leftPx}px` }}
                  className="absolute"
                >
                  {mLabel}
                </span>
              );
            })}
          </div>

          {/* 53 Columns of 7 Days */}
          <div
            className="flex justify-start"
            style={{ gap }}
            onPointerLeave={() => setHovered(undefined)}
          >
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col" style={{ gap }}>
                {week.map((day) => {
                  // Days beyond today are not rendered, matching GitHub's contribution graph (Image 2)
                  if (day.isFuture) {
                    return (
                      <div
                        key={day.date}
                        style={{ width: cellSize, height: cellSize }}
                        className="shrink-0 opacity-0 pointer-events-none select-none"
                        aria-hidden="true"
                      />
                    );
                  }

                  const level = day.level;
                  const isLevelZero = level === 0;

                  return (
                    <motion.div
                      key={day.date}
                      onPointerEnter={hover(day)}
                      className={cn(
                        "shrink-0 rounded-[2.5px] transition-colors cursor-pointer",
                        isLevelZero ? accentConfig.empty : ""
                      )}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor:
                          !isLevelZero && !isClassBased
                            ? accentConfig.levels[level - 1]
                            : undefined,
                      }}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        ...CELL_FADE,
                        delay: reduceMotion ? 0 : weekIndex * COLUMN_STAGGER,
                      }}
                    >
                      {!isLevelZero && isClassBased && (
                        <div
                          className={cn(
                            "h-full w-full rounded-[2.5px] transition-opacity",
                            accentConfig.levels[level - 1]
                          )}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <AnimatePresence>
        {hovered && (
          <Tooltip
            key="tooltip"
            hovered={hovered}
            reduceMotion={reduceMotion}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export type GitHubActivityProps = React.ComponentProps<"div"> & {
  /** Pre-fetched calendar. Pass it to drive with real database data. */
  contributions?: Contribution[];
  /** Optional GitHub login / username (for demo or compatibility) */
  username?: string;
  /** Year shown in the heading. Defaults to current year. */
  year?: number;
  /** Surface palette. Default: "white" */
  variant?: GitHubActivityVariant;
  /** Size of one day, in pixels. Default: 11 */
  cellSize?: number;
  /** Number of months (compatibility) */
  months?: number;
  /** Show months row (compatibility) */
  showMonths?: boolean;
  /** Optional label */
  label?: string;
  /** Optional repos/models (ignored, drawer is removed) */
  repos?: any[];
};

export const GitHubActivity = ({
  className,
  contributions = [],
  username,
  year,
  variant = "white",
  cellSize = DEFAULT_CELL_SIZE,
  months,
  showMonths,
  label,
  repos,
  style,
  ...props
}: GitHubActivityProps) => {
  const reduceMotion = useReducedMotion();

  const total = React.useMemo(
    () => contributions.reduce((sum, day) => sum + day.count, 0),
    [contributions],
  );

  const displayYear = year ?? new Date().getFullYear();
  const heading = `${formatTokensCompact(total)} tokens in ${displayYear}`;

  return (
    <div
      data-slot="github-activity"
      data-variant={variant}
      className={cn(SURFACE, VARIANTS[variant].ink, className)}
      style={style}
      {...props}
    >
      <Squircle className={VARIANTS[variant].paint} />

      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-sm font-semibold tracking-tight text-current">
            {heading}
          </p>
          <span className="text-[11px] font-sans text-current/60 tabular-nums">
            {total > 0 ? `${total.toLocaleString()} total tokens` : "0 tokens"}
          </span>
        </div>

        <ContributionGrid
          contributions={contributions}
          variant={variant}
          cellSize={cellSize}
          label={heading}
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );
};

export default GitHubActivity;
