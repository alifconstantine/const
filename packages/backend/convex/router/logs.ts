import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { resolveIdentity } from "./access";
import { NANO_USD } from "./modelCatalog";
const since = (range?: string) =>
  range === "today" || range === "24h"
    ? Date.now() - 86400000
    : range === "7d"
      ? Date.now() - 7 * 86400000
      : range === "30d"
        ? Date.now() - 30 * 86400000
        : 0;
export const listLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx);
    return ctx.db
      .query("routerLogs")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(100, Math.max(1, args.limit ?? 6)));
  },
});
export const paginateLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    timeRange: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    statusFilter: v.optional(v.string()),
    tier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx);
    const start = since(args.timeRange),
      search = args.searchQuery?.trim();
    const logs = search?.startsWith("req_")
      ? ctx.db
          .query("routerLogs")
          .withIndex("by_request_id", (q) => q.eq("requestId", search))
          .filter((q) => q.eq(q.field("userId"), userId))
      : search
        ? ctx.db
            .query("routerLogs")
            .withSearchIndex("search_logs", (q) =>
              q.search("searchText", search).eq("userId", userId),
            )
        : ctx.db
            .query("routerLogs")
            .withIndex("by_user_created", (q) =>
              q.eq("userId", userId).gte("createdAt", start),
            )
            .order("desc");
    return logs
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), start),
          args.statusFilter === "errors"
            ? q.gte(q.field("status"), 400)
            : args.statusFilter === "success"
              ? q.lt(q.field("status"), 400)
              : q.eq(1, 1),
          args.tier && args.tier !== "all"
            ? q.eq(q.field("billingTier"), args.tier)
            : q.eq(1, 1),
        ),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(50, args.paginationOpts.numItems),
      });
  },
});
export const getDashboardAnalytics = query({
  args: { timeRange: v.optional(v.string()), tzOffset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx);
    const start = Math.floor(since(args.timeRange) / 3600000) * 3600000;
    const buckets = await ctx.db
      .query("routerUsageBuckets")
      .withIndex("by_user_bucket", (q) =>
        q.eq("userId", userId).gte("bucketAt", start),
      )
      .collect();
    const sum = (
      field:
        | "requests"
        | "successes"
        | "promptTokens"
        | "completionTokens"
        | "cachedTokens"
        | "totalTokens"
        | "costNanoUsd"
        | "durationMs"
        | "ttftSum"
        | "ttftCount",
    ) => buckets.reduce((n, b) => n + b[field], 0);
    const totalRequests = sum("requests"),
      totalTokens = sum("totalTokens"),
      duration = sum("durationMs"),
      costUsd = sum("costNanoUsd") / NANO_USD;
    const models = new Map<
      string,
      {
        model: string;
        requests: number;
        tokens: number;
        costUsd: number;
        tier: string;
      }
    >();
    const timeline = new Map<
      number,
      { timestamp: number; tokens: number; requests: number; costUsd: number }
    >();
    for (const b of buckets) {
      const m = models.get(b.model) ?? {
        model: b.model,
        requests: 0,
        tokens: 0,
        costUsd: 0,
        tier: b.tier,
      };
      m.requests += b.requests;
      m.tokens += b.totalTokens;
      m.costUsd += b.costNanoUsd / NANO_USD;
      models.set(b.model, m);
      const t = timeline.get(b.bucketAt) ?? {
        timestamp: b.bucketAt,
        tokens: 0,
        requests: 0,
        costUsd: 0,
      };
      t.tokens += b.totalTokens;
      t.requests += b.requests;
      t.costUsd += b.costNanoUsd / NANO_USD;
      timeline.set(b.bucketAt, t);
    }
    const freeTokens = buckets
      .filter((b) => b.tier === "free")
      .reduce((n, b) => n + b.totalTokens, 0);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      kpi: {
        totalRequests,
        totalTokens,
        promptTokens: sum("promptTokens"),
        completionTokens: sum("completionTokens"),
        cachedTokens: sum("cachedTokens"),
        costUsd,
        freeTokens,
        paidTokens: buckets
          .filter((b) => b.tier === "paid")
          .reduce((n, b) => n + b.totalTokens, 0),
        legacyTokens: buckets
          .filter((b) => b.tier === "legacy")
          .reduce((n, b) => n + b.totalTokens, 0),
        successRate: totalRequests
          ? (sum("successes") / totalRequests) * 100
          : 0,
        avgDurationMs: totalRequests ? duration / totalRequests : 0,
        avgTtftMs: sum("ttftCount") ? sum("ttftSum") / sum("ttftCount") : 0,
        avgSpeed: duration ? (sum("completionTokens") / duration) * 1000 : 0,
      },
      modelBreakdown: [...models.values()].sort((a, b) => b.tokens - a.tokens),
      timeline: [...timeline.values()].sort(
        (a, b) => a.timestamp - b.timestamp,
      ),
      activeKeysCount: keys.filter((k) => k.status === "active").length,
      aggregation: "hourly",
      historicalCostsAvailable: false,
    };
  },
});
