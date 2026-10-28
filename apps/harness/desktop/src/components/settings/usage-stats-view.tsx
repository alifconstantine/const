import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "../../lib/i18n";
import { WeeklyQuotaCard, type WeeklyQuota } from "./weekly-quota-card";
import {
  cn,
  toast,
  TooltipProvider,
  ScrollArea,
} from "@const/ui";
import {
  RefreshCw,
  Terminal,
  Cpu,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Database,
  Trash2,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb } from "../../lib/db";
import { useRemoteRuntime } from "../../lib/remote-runtime";
import { useHostUsageLogs } from "../../lib/use-host-usage-logs";
import {
  GitHubActivity,
  type Contribution,
  type GitHubActivityVariant,
  type ContributionLevel,
} from "../ui/github-activity";

export interface UsageStatsViewProps {
  quota?: WeeklyQuota | null;
  activeModel?: string;
  user?: any;
}

function formatTokens(tokens: number): string {
  if (!tokens || tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

function formatSessionDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 m";
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours > 0) {
    return `${hours} h ${mins} m`;
  }
  return `${mins} m`;
}

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Generate smooth cubic bezier SVG path from coordinate points
function getSmoothLinePath(points: Array<{ x: number; y: number }>): string {
  const pStart = points[0];
  if (!pStart || points.length === 0) return "";
  if (points.length === 1) return `M ${pStart.x} ${pStart.y}`;

  let path = `M ${pStart.x} ${pStart.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = (i > 0 ? points[i - 1] : pStart) ?? pStart;
    const p1 = points[i] ?? pStart;
    const p2 = points[i + 1] ?? p1;
    const p3 = (i < points.length - 2 ? points[i + 2] : p2) ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

interface DonutModelItem {
  name: string;
  tokens: number;
  percent: string;
  color: string;
  shareRatio: number;
  offsetRatio: number;
}

function UsageStatsInner({
  // i18n hook

  quota,
  activeModel = "agy/gemini-3.8-flash-tiered",
}: UsageStatsViewProps) {
  const { t } = useTranslation();
  const remote = useRemoteRuntime();
  // Time range selection: "7d" (Last 7 days) or "30d" (Last 30 days)
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");
  // Activity tab mode: "daily" | "weekly" | "cumulative"
  const [activityMode, setActivityMode] = useState<"daily" | "weekly" | "cumulative">("daily");
  // Activity surface style variant: "white" | "calamansi" | "slate" | "citrus"
  const [activityVariant, setActivityVariant] = useState<GitHubActivityVariant>("white");
  // Refresh state
  const [isLocallyRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const hostUsage = useHostUsageLogs(!!remote, refreshKey);
  const isRefreshing = remote ? hostUsage.loading : isLocallyRefreshing;

  // Sync conversations to local IndexedDB on mount
  useEffect(() => {
    if (!remote) void localDb.syncLogsFromConversations().catch(() => {});
  }, [!!remote]);

  // 1. Reactive query from local Dexie database
  const cachedLogs = useLiveQuery(
    () => remote ? [] : localDb.getRequestLogs(),
    [refreshKey, !!remote]
  );
  const localLogs = remote ? hostUsage.logs : cachedLogs;

  // 2. Local conversations fallback / aggregation (STRICTLY REAL DATA, ZERO DUMMY)
  const localStats = useMemo(() => {
    try {
      if (localLogs && localLogs.length > 0) {
        let totalTokens = 0;
        const modelMap = new Map<string, number>();
        const dayMap = new Map<string, { tokens: number; count: number }>();

        for (const log of localLogs) {
          totalTokens += log.totalTokens;
          const modelKey = log.model || (log.toolNames && log.toolNames[0]) || activeModel || "gemini-3.8-flash";
          modelMap.set(modelKey, (modelMap.get(modelKey) || 0) + log.totalTokens);

          const d = new Date(log.createdAt);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const key = `${yyyy}-${mm}-${dd}`;

          const existing = dayMap.get(key) || { tokens: 0, count: 0 };
          existing.tokens += log.totalTokens;
          existing.count += 1;
          dayMap.set(key, existing);
        }

        return {
          totalTokens,
          modelMap,
          dayMap,
          requestCount: localLogs.length,
        };
      }

      return null;
    } catch {
      return null;
    }
  }, [localLogs, activeModel, refreshKey]);

  // Normalize active model display name
  const modelDisplayName = useMemo(() => {
    if (activeModel.includes("gemini-3.8-flash") || activeModel.includes("agy")) {
      return "agy/gemini-3.8-flash-tiered";
    }
    return activeModel || "agy/gemini-3.8-flash-tiered";
  }, [activeModel]);

  // Handle Refresh action
  const handleRefresh = useCallback(async () => {
    if (remote) { setRefreshKey(key => key + 1); return; }
    setIsRefreshing(true);
    try {
      await localDb.syncLogsFromConversations();
      setRefreshKey(key => key + 1);
      toast.success(t("settings.usageStatsUpdated"));
    } catch {
      toast.error(t("settings.usageStatsLoadFailed"));
    } finally {
      setIsRefreshing(false);
    }
  }, [!!remote, t]);

  // 1. Top KPI Summary Metrics (ZERO DUMMY DATA - STRICTLY FROM LOCAL DB)
  const { totalTokensStr, peakTokensStr, longestSessionStr, currentStreakStr, longestStreakStr } = useMemo(() => {
    // Local IndexedDB calculations
    if (localStats && localStats.totalTokens > 0) {
      const total = localStats.totalTokens;
      let peak = 0;
      localStats.dayMap.forEach((v) => {
        if (v.tokens > peak) peak = v.tokens;
      });
      // Safety: peak can never exceed total
      peak = Math.min(total, peak);

      // Longest session duration
      let maxDurationMs = 0;
      if (localLogs && localLogs.length > 0) {
        for (const log of localLogs) {
          if (log.durationMs && log.durationMs > maxDurationMs) {
            maxDurationMs = log.durationMs;
          }
        }
      }
      const sessionMins = maxDurationMs > 0 ? Math.max(1, Math.round(maxDurationMs / 1000 / 60)) : 1;

      // Calculate streak
      let curStreak = 0;
      let maxStreak = 0;
      let run = 0;
      const now = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const hasActivity = (localStats.dayMap.get(key)?.tokens || 0) > 0;

        if (i === 0 && hasActivity) curStreak = 1;
        else if (curStreak === i && hasActivity) curStreak++;

        if (hasActivity) {
          run++;
          if (run > maxStreak) maxStreak = run;
        } else {
          run = 0;
        }
      }

      return {
        totalTokensStr: formatTokens(total),
        peakTokensStr: formatTokens(peak),
        longestSessionStr: formatSessionDuration(sessionMins),
        currentStreakStr: `${curStreak} d`,
        longestStreakStr: `${Math.max(curStreak, maxStreak)} d`,
      };
    }

    // NO DUMMY DATA: If database is empty, return exact 0s
    return {
      totalTokensStr: "0",
      peakTokensStr: "0",
      longestSessionStr: "0 m",
      currentStreakStr: "0 d",
      longestStreakStr: "0 d",
    };
  }, [localStats, localLogs, refreshKey]);

  // 2. Activity Contributions for GitHubActivity Component (ZERO DUMMY, NO DRAWER)
  const activityContributions = useMemo<Contribution[]>(() => {
    const contributions: Contribution[] = [];
    const dateMap = localStats?.dayMap;

    let maxDayTokens = 1;
    if (dateMap && dateMap.size > 0) {
      dateMap.forEach((v) => {
        if (v.tokens > maxDayTokens) maxDayTokens = v.tokens;
      });
    }

    const now = new Date();
    // Anchor to the Saturday ending the current week
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - dayOfWeek));
    endOfWeek.setHours(23, 59, 59, 999);

    // 53 full weeks = 371 days (always starts on Sunday, ends on Saturday)
    const TOTAL_WEEKS = 53;
    const TOTAL_DAYS = TOTAL_WEEKS * 7;
    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - (TOTAL_DAYS - 1));
    startDate.setHours(0, 0, 0, 0);

    const nowYear = now.getFullYear();
    const nowMonth = String(now.getMonth() + 1).padStart(2, "0");
    const nowDate = String(now.getDate()).padStart(2, "0");
    const todayStr = `${nowYear}-${nowMonth}-${nowDate}`;

    for (let i = 0; i < TOTAL_DAYS; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, "0");
      const dd = String(cur.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;

      // Future days beyond today: marked isFuture: true so they are invisible, matching GitHub (Image 2)
      if (dateKey > todayStr) {
        contributions.push({
          date: dateKey,
          count: 0,
          level: 0,
          isFuture: true,
        });
        continue;
      }

      const entry = dateMap?.get(dateKey);
      const count = entry?.tokens || 0;
      let level: ContributionLevel = 0;

      if (count > 0) {
        const ratio = count / maxDayTokens;
        if (ratio > 0.75) level = 4;
        else if (ratio > 0.45) level = 3;
        else if (ratio > 0.15) level = 2;
        else level = 1;
      }

      contributions.push({
        date: dateKey,
        count,
        level,
        isFuture: false,
      });
    }

    return contributions;
  }, [localStats]);

  // 3. Daily Token Trend Chart (Smooth Cubic Bezier SVG Curve) - ZERO DUMMY
  const { trendPoints, trendSvgLine, trendSvgArea, trendDates, trendModelName, hasTrendData } = useMemo(() => {
    const is7d = timeRange === "7d";
    const count = is7d ? 8 : 30;
    const dates: string[] = [];
    const values: number[] = [];
    const dateMap = localStats?.dayMap;

    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;
      const label = d.toLocaleString("en-US", { month: "short", day: "numeric" });
      dates.push(label);

      // STRICTLY REAL DATA FROM DB
      const tok = dateMap?.get(key)?.tokens || 0;
      values.push(tok);
    }

    const svgWidth = 660;
    const svgHeight = 150;
    const paddingX = 15;
    const paddingTop = 15;
    const paddingBottom = 20;
    const chartW = svgWidth - paddingX * 2;
    const chartH = svgHeight - paddingTop - paddingBottom;

    const maxVal = Math.max(...values, 0);
    const hasData = maxVal > 0;

    const points = values.map((val, idx) => {
      const x = paddingX + (idx / Math.max(1, values.length - 1)) * chartW;
      const normalizedY = hasData ? 1 - val / maxVal : 1; // baseline if 0
      const y = paddingTop + normalizedY * chartH;
      return { x, y, value: val, date: dates[idx] || "" };
    });

    const linePath = getSmoothLinePath(points);
    const lastP = points[points.length - 1];
    const firstP = points[0];
    const baselineY = paddingTop + chartH;
    const areaPath =
      lastP && firstP && hasData
        ? `${linePath} L ${lastP.x} ${baselineY} L ${firstP.x} ${baselineY} Z`
        : "";

    const modelName =
      Array.from(localStats?.modelMap.keys() || [])[0] ||
      modelDisplayName;

    return {
      trendPoints: points,
      trendSvgLine: linePath,
      trendSvgArea: areaPath,
      trendDates: dates,
      trendModelName: modelName,
      hasTrendData: hasData,
    };
  }, [timeRange, localStats, modelDisplayName, refreshKey]);

  // 4. Model Usage Donut & Breakdown Data (ZERO DUMMY)
  const donutModelList = useMemo<DonutModelItem[]>(() => {
    const palette = ["#3b82f6", "#60a5fa", "#93c5fd", "#38bdf8", "#0284c7"];

    if (localStats && localStats.modelMap.size > 0 && localStats.totalTokens > 0) {
      const entries = Array.from(localStats.modelMap.entries());
      const totalT = localStats.totalTokens;
      let offset = 0;
      return entries.map(([mName, tok], idx) => {
        const ratio = tok / totalT;
        const color = palette[idx % palette.length]!;
        const item: DonutModelItem = {
          name: mName,
          tokens: tok,
          percent: `${Math.round(ratio * 100)}%`,
          color,
          shareRatio: ratio,
          offsetRatio: offset,
        };
        offset += ratio;
        return item;
      });
    }

    // ZERO DUMMY: Return empty array if no usage in database
    return [];
  }, [localStats, refreshKey]);

  const totalDonutTokens = useMemo(() => {
    return donutModelList.reduce((acc: number, m: DonutModelItem) => acc + m.tokens, 0);
  }, [donutModelList]);

  // Clear local request logs
  const handleClearLogs = async () => {
    if (window.confirm("Are you sure you want to clear local request and tool execution logs?")) {
      await db.requestLogs.clear();
      setRefreshKey((k) => k + 1);
      toast.success("Local request logs cleared");
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col gap-5 w-full max-w-3xl pb-8 select-none">
        {remote && hostUsage.error && <p role="alert" className="text-sm text-muted-foreground">{t("settings.usageStatsLoadFailed")}</p>}
        {/* ------------------------------------------------------------- */}
        {/* Header with "Usage stats" & "App usage" Pill                  */}
        {/* ------------------------------------------------------------- */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-[#262626] dark:text-white font-sans">
              {t("settings.usageStats")}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ebebed] dark:bg-[#252528] border border-[#dedee2] dark:border-[#333336] text-[11px] font-medium text-[#737373] dark:text-[#a0a0a3]">
              {t("settings.appUsage")}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#dedee2] dark:border-[#38383e] bg-[#ffffff] dark:bg-[#232427] hover:bg-[#f4f4f6] dark:hover:bg-[#2d2e33] text-xs font-medium text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer shadow-xs active:scale-95"
            title={t("settings.refreshUsageStats")}
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-primary")}
            />
            <span>{t("common.refresh")}</span>
          </button>
        </div>

        <WeeklyQuotaCard quota={quota} />

        {/* ------------------------------------------------------------- */}
        {/* 5 KPI Metric Summary Cards (Strictly Real Data)               */}
        {/* ------------------------------------------------------------- */}
        <div className="rounded-xl border border-[#dedee2] dark:border-[#2f2f32] bg-[#f9f9fb] dark:bg-[#18181a] p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#dedee2] dark:divide-[#2e2e32]">
            {/* 1. Total tokens */}
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-lg sm:text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white">
                {totalTokensStr}
              </span>
              <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] mt-0.5">
                {t("settings.totalTokens")}
              </span>
            </div>

            {/* 2. Peak tokens */}
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-lg sm:text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white">
                {peakTokensStr}
              </span>
              <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] mt-0.5">
                {t("settings.peakTokens")}
              </span>
            </div>

            {/* 3. Longest session */}
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-lg sm:text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white">
                {longestSessionStr}
              </span>
              <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] mt-0.5">
                {t("settings.longestSession")}
              </span>
            </div>

            {/* 4. Current streak */}
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-lg sm:text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white">
                {currentStreakStr}
              </span>
              <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] mt-0.5">
                {t("settings.currentStreak")}
              </span>
            </div>

            {/* 5. Longest streak */}
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-lg sm:text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white">
                {longestStreakStr}
              </span>
              <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] mt-0.5">
                {t("settings.longestStreak")}
              </span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Token Activity Section (Powered by GitHubActivity Component)  */}
        {/* ------------------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#262626] dark:text-white">
              {t("settings.tokenActivity")}
            </span>

            {/* Surface Theme Variant Picker */}
            <div className="inline-flex items-center rounded-lg bg-[#ececef] dark:bg-[#232427] p-0.5 border border-[#dedee2] dark:border-[#333338] text-[11px]">
              {(["white", "calamansi", "slate", "citrus"] as GitHubActivityVariant[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActivityVariant(v)}
                  className={cn(
                    "px-2.5 py-1 rounded-md capitalize font-medium transition-all cursor-pointer",
                    activityVariant === v
                      ? "bg-white dark:bg-[#34353a] text-[#171717] dark:text-white shadow-xs font-semibold"
                      : "text-[#737373] dark:text-[#a0a0a5] hover:text-[#171717] dark:hover:text-white"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* GitHubActivity integrated component */}
          <div className="w-full flex justify-center">
            <GitHubActivity
              variant={activityVariant}
              contributions={activityContributions}
              className="w-full max-w-full"
            />
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Time Range Controls                                          */}
        {/* ------------------------------------------------------------- */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-medium text-[#262626] dark:text-white">
            {t("settings.timeRange")}
          </span>
          <div className="inline-flex items-center rounded-lg bg-[#ececef] dark:bg-[#232427] p-0.5 border border-[#dedee2] dark:border-[#333338]">
            <button
              type="button"
              onClick={() => setTimeRange("7d")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                timeRange === "7d"
                  ? "bg-white dark:bg-[#34353a] text-[#171717] dark:text-white shadow-xs font-semibold"
                  : "text-[#737373] dark:text-[#a0a0a5] hover:text-[#171717] dark:hover:text-white"
              )}
            >
              {t("settings.last7Days")}
            </button>
            <button
              type="button"
              onClick={() => setTimeRange("30d")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                timeRange === "30d"
                  ? "bg-white dark:bg-[#34353a] text-[#171717] dark:text-white shadow-xs font-semibold"
                  : "text-[#737373] dark:text-[#a0a0a5] hover:text-[#171717] dark:hover:text-white"
              )}
            >
              {t("settings.last30Days")}
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Daily Token Trend Chart Card (Strictly Real Data)             */}
        {/* ------------------------------------------------------------- */}
        <div className="rounded-xl border border-[#dedee2] dark:border-[#2f2f32] bg-[#f9f9fb] dark:bg-[#18181a] p-5 shadow-xs flex flex-col gap-4">
          {/* Title & Legend */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-[#262626] dark:text-white">
              {t("settings.dailyTokenTrend")}
            </span>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
              <span className="text-xs font-medium font-sans text-[#737373] dark:text-[#a3a3a8]">
                {trendModelName}
              </span>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full relative pt-2">
            <svg
              viewBox="0 0 660 150"
              className="w-full h-44 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="tokenTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal dashed grid lines */}
              <line
                x1="0"
                y1="35"
                x2="660"
                y2="35"
                stroke="currentColor"
                className="text-[#e2e2e5] dark:text-[#28282c]"
                strokeDasharray="4 4"
              />
              <line
                x1="0"
                y1="80"
                x2="660"
                y2="80"
                stroke="currentColor"
                className="text-[#e2e2e5] dark:text-[#28282c]"
                strokeDasharray="4 4"
              />
              <line
                x1="0"
                y1="130"
                x2="660"
                y2="130"
                stroke="currentColor"
                className="text-[#e2e2e5] dark:text-[#28282c]"
                strokeDasharray="4 4"
              />

              {/* Gradient Area Fill */}
              {trendSvgArea && <path d={trendSvgArea} fill="url(#tokenTrendGrad)" />}

              {/* Main Smooth Line */}
              {trendSvgLine && (
                <path
                  d={trendSvgLine}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Circle markers */}
              {trendPoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={hasTrendData && pt.value > 0 ? "3.5" : "2"}
                  className="fill-[#3b82f6] stroke-[#ffffff] dark:stroke-[#18181a] stroke-2 hover:r-5 transition-all cursor-pointer"
                >
                  <title>{`${pt.date}: ${formatTokens(pt.value)} tokens`}</title>
                </circle>
              ))}
            </svg>

            {/* Dates row at bottom */}
            <div className="flex justify-between text-[11px] font-sans text-[#737373] dark:text-[#88888e] pt-3 px-1">
              {timeRange === "7d" ? (
                trendDates.map((d, idx) => (
                  <span key={idx}>{d}</span>
                ))
              ) : (
                trendDates.map((d, idx) => {
                  const step = Math.floor(trendDates.length / 6);
                  const isVisible = idx % step === 0 || idx === trendDates.length - 1;
                  return (
                    <span key={idx} className={cn(!isVisible && "opacity-0 select-none")}>
                      {d}
                    </span>
                  );
                })
              )}
            </div>

            {!hasTrendData && (
              <div className="text-center py-2 text-xs text-[#737373] dark:text-[#969696]">
                {t("settings.noTrendData")}
              </div>
            )}
          </div>
        </div>

        {/* Model usage across local conversations. */}
        <div>
          {/* Card 2: Model Usage Card (Strictly Real Data) */}
          <div className="rounded-xl border border-[#dedee2] dark:border-[#2f2f32] bg-[#f9f9fb] dark:bg-[#18181a] p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#262626] dark:text-white">
                {t("settings.modelUsage")}
              </span>
              <span className="text-xs font-sans tabular-nums text-[#737373] dark:text-[#969696]">
                {formatTokens(totalDonutTokens)} {t("settings.modelUsageTotal")}
              </span>
            </div>

            {donutModelList.length > 0 ? (
              <div className="flex items-center gap-4 py-1">
                {/* Donut Chart */}
                <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="currentColor"
                      className="text-[#e5e5e8] dark:text-[#232427]"
                      strokeWidth="18"
                    />
                    {donutModelList.map((m: DonutModelItem, idx: number) => {
                      const circumference = 2 * Math.PI * 46;
                      const strokeLength = m.shareRatio * circumference;
                      const dashOffset = -(m.offsetRatio * circumference);
                      return (
                        <circle
                          key={idx}
                          cx="60"
                          cy="60"
                          r="46"
                          fill="none"
                          stroke={m.color}
                          strokeWidth="18"
                          strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                          strokeDashoffset={dashOffset}
                          className="transition-all duration-700 ease-out"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-sm font-bold font-sans tabular-nums text-[#262626] dark:text-white leading-tight">
                      {formatTokens(totalDonutTokens)}
                    </span>
                    <span className="text-[9px] text-[#737373] dark:text-[#969696] font-medium">
                      tokens
                    </span>
                  </div>
                </div>

                {/* Model Breakdown Legend with ScrollArea */}
                <ScrollArea orientation="vertical" className="flex-1 max-h-28 pr-1">
                  <div className="flex flex-col gap-2.5">
                    {donutModelList.map((m: DonutModelItem, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: m.color }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-[#262626] dark:text-white font-sans truncate" title={m.name}>
                              {m.name}
                            </span>
                            <span className="text-[10px] text-[#737373] dark:text-[#969696] font-sans tabular-nums">
                              {formatTokens(m.tokens)}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-[#262626] dark:text-[#d4d4d4] font-sans tabular-nums shrink-0">
                          {m.percent}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center gap-1.5 text-xs text-[#737373] dark:text-[#969696]">
                <Database className="w-5 h-5 text-[#737373] dark:text-[#969696]" />
                <span>{t("settings.noUsageRecorded")}</span>
              </div>
            )}

            <div className="text-[11px] text-[#737373] dark:text-[#969696] truncate">
              {t("settings.workspaceAggregate")}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Local Requests & Tool Calls Log (Strictly Real Local DB Data) */}
        {/* ------------------------------------------------------------- */}
        <div className="rounded-xl border border-[#dedee2] dark:border-[#2f2f32] bg-[#f9f9fb] dark:bg-[#18181a] p-4 sm:p-5 shadow-xs flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#262626] dark:text-white">
                {t("settings.localRequestsLog")}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-[11px] font-medium font-sans">
                {localLogs ? localLogs.length : 0} logs
              </span>
            </div>

            {!remote && localLogs && localLogs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#737373] dark:text-[#969696] hover:text-[#ef4444] transition-colors cursor-pointer"
                title={t("settings.clearLocalLogs")}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t("settings.clearHistory")}</span>
              </button>
            )}
          </div>

          {/* Table / List using custom ScrollArea */}
          {localLogs && localLogs.length > 0 ? (
            <ScrollArea
              orientation="both"
              className="w-full max-h-64 rounded-lg border border-[#dedee2] dark:border-[#28282c]"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f0f3] dark:bg-[#202024] text-[#737373] dark:text-[#969696] font-medium sticky top-0 z-10 border-b border-[#dedee2] dark:border-[#28282c]">
                  <tr>
                    <th className="py-2 px-3">{t("settings.colType")}</th>
                    <th className="py-2 px-3">{t("settings.colTargetModel")}</th>
                    <th className="py-2 px-3 text-right">{t("settings.colTokens")}</th>
                    <th className="py-2 px-3 text-right">{t("settings.colDuration")}</th>
                    <th className="py-2 px-3 text-center">{t("settings.colStatus")}</th>
                    <th className="py-2 px-3 text-right">{t("settings.colTime")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dedee2] dark:divide-[#242428] font-sans">
                  {localLogs.slice(0, 30).map((log) => {
                    const isTool = log.requestId.startsWith("tool_") || (log.toolNames && log.toolNames.length > 0);
                    return (
                      <tr key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2 px-3 font-medium">
                          {isTool ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-[#a78bfa] border border-[#8b5cf6]/20">
                              <Wrench className="w-3 h-3" />
                              <span>Tool Call</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#3b82f6]/10 text-[#3b82f6] dark:text-[#60a5fa] border border-[#3b82f6]/20">
                              <span>LLM Gen</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-[#262626] dark:text-[#d4d4d4] max-w-[200px] truncate" title={log.model}>
                          {log.model}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#262626] dark:text-[#e4e4e7]">
                          {formatTokens(log.totalTokens)}
                          <span className="text-[10px] text-[#737373] dark:text-[#969696] ml-1">
                            ({formatTokens(log.promptTokens)}/{formatTokens(log.completionTokens)})
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#737373] dark:text-[#969696]">
                          {log.durationMs ? `${log.durationMs}ms` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {log.status === 200 ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#16a34a] dark:text-[#22c55e]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>200</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#ef4444]">
                              <AlertCircle className="w-3 h-3" />
                              <span>{log.status}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[11px] text-[#737373] dark:text-[#969696]">
                          {formatTimeAgo(log.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2 border border-dashed border-[#dedee2] dark:border-[#333338] rounded-lg">
              <Terminal className="w-6 h-6 text-[#737373] dark:text-[#969696]" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-[#262626] dark:text-white">
                  No local requests logged yet
                </span>
                <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                  Tool executions and chat turns will automatically record here.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// Top-Level Error Boundary ensuring that under NO circumstance will UsageStatsView cause a blank/black screen
export class UsageStatsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.warn("UsageStatsErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] flex flex-col items-center justify-center text-center gap-3 max-w-xl mx-auto my-8">
          <AlertCircle className="w-8 h-8 text-[#ef4444]" />
          <h3 className="text-sm font-semibold text-[#262626] dark:text-white">
            Usage Stats Recovery Mode
          </h3>
          <p className="text-xs text-[#737373] dark:text-[#969696] leading-relaxed">
            There was an issue loading the usage telemetry view. Click below to reset the view.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-1.5 rounded-lg bg-[#262626] dark:bg-white text-white dark:text-black text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer mt-2"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function UsageStatsView(props: UsageStatsViewProps) {
  return (
    <UsageStatsErrorBoundary>
      <UsageStatsInner {...props} />
    </UsageStatsErrorBoundary>
  );
}
