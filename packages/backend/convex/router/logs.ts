import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "../_generated/dataModel";

// Cryptographic hash for secure API key verification
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 1. Record a completed request log & telemetry entry
export const recordLog = mutation({
  args: {
    rawApiKey: v.optional(v.string()), // Used if called via external sk-const-live- key
    requestId: v.string(),
    keyName: v.optional(v.string()),
    keyPrefix: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    comboId: v.optional(v.string()),
    comboName: v.optional(v.string()),
    status: v.number(),
    errorMessage: v.optional(v.string()),
    promptTokens: v.number(),
    cachedTokens: v.optional(v.number()),
    completionTokens: v.number(),
    totalTokens: v.number(),
    ttftMs: v.optional(v.number()),
    durationMs: v.number(),
    tokensPerSecond: v.optional(v.number()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedUserId: Id<"users"> | null = null;
    let resolvedApiKeyId: Id<"apiKeys"> | undefined = undefined;
    let resolvedKeyName = args.keyName;
    let resolvedKeyPrefix = args.keyPrefix;

    // A. Check if caller has active session auth
    const sessionUserId = await getAuthUserId(ctx);
    if (sessionUserId) {
      resolvedUserId = sessionUserId;
      if (!resolvedKeyName) resolvedKeyName = "Playground / Session";
    }

    // B. Or resolve via raw API key
    if (args.rawApiKey) {
      const keyHash = await hashKey(args.rawApiKey.trim());
      const apiKeyDoc = await ctx.db
        .query("apiKeys")
        .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
        .first();

      if (apiKeyDoc && apiKeyDoc.status === "active") {
        resolvedUserId = apiKeyDoc.userId;
        resolvedApiKeyId = apiKeyDoc._id;
        resolvedKeyName = apiKeyDoc.name;
        resolvedKeyPrefix = apiKeyDoc.keyPrefix;

        // Increment token usage for the API key
        await ctx.db.patch(apiKeyDoc._id, {
          usedTodayTokens: apiKeyDoc.usedTodayTokens + args.totalTokens,
          lastUsedAt: Date.now(),
        });
      }
    }

    // If neither session nor valid API key found, abort write
    if (!resolvedUserId) {
      return { success: false, reason: "Unauthorized" };
    }

    const logId = await ctx.db.insert("routerLogs", {
      userId: resolvedUserId,
      requestId: args.requestId,
      apiKeyId: resolvedApiKeyId,
      keyName: resolvedKeyName || "Default",
      keyPrefix: resolvedKeyPrefix,
      model: args.model,
      provider: args.provider,
      comboId: args.comboId,
      comboName: args.comboName,
      status: args.status,
      errorMessage: args.errorMessage,
      promptTokens: args.promptTokens,
      cachedTokens: args.cachedTokens || 0,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      ttftMs: args.ttftMs,
      durationMs: args.durationMs,
      tokensPerSecond: args.tokensPerSecond,
      ip: args.ip,
      userAgent: args.userAgent,
      createdAt: Date.now(),
    });

    return { success: true, logId };
  },
});

// 2. List request logs with filters and pagination
export const listLogs = query({
  args: {
    statusFilter: v.optional(v.string()), // "all", "200", "errors"
    modelFilter: v.optional(v.string()),
    providerFilter: v.optional(v.string()),
    timeRange: v.optional(v.string()), // "today", "7d", "30d", "all"
    searchQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let logs = await ctx.db
      .query("routerLogs")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 100);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Apply Time Filter
    if (args.timeRange === "today") {
      logs = logs.filter((l) => l.createdAt >= oneDayAgo);
    } else if (args.timeRange === "7d") {
      logs = logs.filter((l) => l.createdAt >= sevenDaysAgo);
    } else if (args.timeRange === "30d") {
      logs = logs.filter((l) => l.createdAt >= thirtyDaysAgo);
    }

    // Apply Status Filter
    if (args.statusFilter === "200" || args.statusFilter === "success") {
      logs = logs.filter((l) => l.status >= 200 && l.status < 300);
    } else if (args.statusFilter === "errors") {
      logs = logs.filter((l) => l.status >= 400);
    }

    // Apply Model Filter
    if (args.modelFilter && args.modelFilter !== "all") {
      const mf = args.modelFilter.toLowerCase();
      logs = logs.filter((l) => l.model.toLowerCase().includes(mf));
    }

    // Apply Provider Filter
    if (args.providerFilter && args.providerFilter !== "all") {
      const pf = args.providerFilter.toLowerCase();
      logs = logs.filter((l) => l.provider.toLowerCase() === pf);
    }

    // Apply Search Query (matches requestId, model, provider, keyName)
    if (args.searchQuery && args.searchQuery.trim()) {
      const q = args.searchQuery.toLowerCase().trim();
      logs = logs.filter(
        (l) =>
          l.requestId.toLowerCase().includes(q) ||
          l.model.toLowerCase().includes(q) ||
          l.provider.toLowerCase().includes(q) ||
          (l.keyName && l.keyName.toLowerCase().includes(q))
      );
    }

    return logs;
  },
});

// 3. Aggregate metrics & activity buckets for mini activity chart
export const getLogMetrics = query({
  args: {
    timeRange: v.optional(v.string()), // "today", "7d", "30d", "all"
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        promptTokens: 0,
        cachedTokens: 0,
        completionTokens: 0,
        avgTtftMs: 0,
        avgDurationMs: 0,
        avgSpeed: 0,
        successRate: 100,
        activityBuckets: [],
      };
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let logs = await ctx.db
      .query("routerLogs")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(500);

    if (args.timeRange === "today") {
      logs = logs.filter((l) => l.createdAt >= oneDayAgo);
    } else if (args.timeRange === "7d") {
      logs = logs.filter((l) => l.createdAt >= sevenDaysAgo);
    } else if (args.timeRange === "30d") {
      logs = logs.filter((l) => l.createdAt >= thirtyDaysAgo);
    }

    if (logs.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        promptTokens: 0,
        cachedTokens: 0,
        completionTokens: 0,
        avgTtftMs: 0,
        avgDurationMs: 0,
        avgSpeed: 0,
        successRate: 100,
        activityBuckets: [],
      };
    }

    let totalTokens = 0;
    let promptTokens = 0;
    let cachedTokens = 0;
    let completionTokens = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    let durationSum = 0;
    let speedSum = 0;
    let speedCount = 0;
    let successCount = 0;

    logs.forEach((l) => {
      totalTokens += l.totalTokens;
      promptTokens += l.promptTokens;
      cachedTokens += l.cachedTokens || 0;
      completionTokens += l.completionTokens;
      durationSum += l.durationMs;
      if (l.ttftMs) {
        ttftSum += l.ttftMs;
        ttftCount++;
      }
      if (l.tokensPerSecond) {
        speedSum += l.tokensPerSecond;
        speedCount++;
      }
      if (l.status >= 200 && l.status < 300) {
        successCount++;
      }
    });

    // 24 mini-buckets for activity visualization (past 24h or relative timeline)
    const numBuckets = 24;
    const bucketInterval = (now - (logs[logs.length - 1]?.createdAt || oneDayAgo)) / numBuckets || 3600000;
    const bucketCounts = new Array(numBuckets).fill(0);

    logs.forEach((l) => {
      const diff = now - l.createdAt;
      const bucketIdx = Math.min(numBuckets - 1, Math.max(0, Math.floor(diff / bucketInterval)));
      bucketCounts[numBuckets - 1 - bucketIdx]++;
    });

    const maxBucket = Math.max(1, ...bucketCounts);
    const activityBuckets = bucketCounts.map((count) => ({
      count,
      heightPercent: Math.round((count / maxBucket) * 100),
    }));

    return {
      totalRequests: logs.length,
      totalTokens,
      promptTokens,
      cachedTokens,
      completionTokens,
      avgTtftMs: ttftCount > 0 ? Math.round(ttftSum / ttftCount) : 0,
      avgDurationMs: Math.round(durationSum / logs.length),
      avgSpeed: speedCount > 0 ? parseFloat((speedSum / speedCount).toFixed(1)) : 0,
      successRate: Math.round((successCount / logs.length) * 100),
      activityBuckets,
    };
  },
});

// 4. Comprehensive Dashboard Analytics
export const getDashboardAnalytics = query({
  args: {
    timeRange: v.optional(v.string()), // "today", "7d", "30d", "90d", "all"
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const now = Date.now();
    let startTime = 0;
    if (args.timeRange === "today") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      startTime = startOfDay.getTime();
    } else if (args.timeRange === "7d") {
      startTime = now - 7 * 24 * 60 * 60 * 1000;
    } else if (args.timeRange === "30d") {
      startTime = now - 30 * 24 * 60 * 60 * 1000;
    } else if (args.timeRange === "90d") {
      startTime = now - 90 * 24 * 60 * 60 * 1000;
    }

    // 1. Fetch filtered logs for the selected timeRange
    const logsQuery = ctx.db
      .query("routerLogs")
      .withIndex("by_user_created", (q) =>
        startTime > 0 ? q.eq("userId", userId).gte("createdAt", startTime) : q.eq("userId", userId)
      )
      .order("desc");

    const logs = await logsQuery.take(1000);

    // 2. Fetch active infrastructure counts
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const activeKeysCount = apiKeys.filter((k) => k.status === "active").length;

    const userProviders = await ctx.db
      .query("userProviders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const activeProvidersCount = userProviders.filter((p) => p.status === "active").length + 1; // +1 for default Google AI

    // 3. Compute KPI metrics
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let cachedTokens = 0;
    let successCount = 0;
    let durationSum = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    let speedSum = 0;
    let speedCount = 0;

    const modelMap = new Map<string, { requests: number; inputTokens: number; outputTokens: number; totalTokens: number }>();
    const providerMap = new Map<string, { requests: number; totalTokens: number }>();
    const keyMap = new Map<string, { keyPrefix?: string; requests: number; totalTokens: number }>();

    logs.forEach((l) => {
      totalTokens += l.totalTokens;
      promptTokens += l.promptTokens;
      completionTokens += l.completionTokens;
      cachedTokens += l.cachedTokens || 0;
      durationSum += l.durationMs;

      if (l.status >= 200 && l.status < 300) {
        successCount++;
      }
      if (l.ttftMs) {
        ttftSum += l.ttftMs;
        ttftCount++;
      }
      if (l.tokensPerSecond) {
        speedSum += l.tokensPerSecond;
        speedCount++;
      }

      // Group by model
      const m = modelMap.get(l.model) || { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      m.requests++;
      m.inputTokens += l.promptTokens;
      m.outputTokens += l.completionTokens;
      m.totalTokens += l.totalTokens;
      modelMap.set(l.model, m);

      // Group by provider
      const p = providerMap.get(l.provider) || { requests: 0, totalTokens: 0 };
      p.requests++;
      p.totalTokens += l.totalTokens;
      providerMap.set(l.provider, p);

      // Group by API key
      const keyLabel = l.keyName || (l.keyPrefix ? `Key ${l.keyPrefix}` : "Playground / Session");
      const k = keyMap.get(keyLabel) || { keyPrefix: l.keyPrefix, requests: 0, totalTokens: 0 };
      k.requests++;
      k.totalTokens += l.totalTokens;
      keyMap.set(keyLabel, k);
    });

    const totalRequests = logs.length;
    const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 100) : 100;
    const avgDurationMs = totalRequests > 0 ? Math.round(durationSum / totalRequests) : 0;
    const avgTtftMs = ttftCount > 0 ? Math.round(ttftSum / ttftCount) : 0;
    const avgSpeed = speedCount > 0 ? parseFloat((speedSum / speedCount).toFixed(1)) : 0;
    const ioRatio = completionTokens > 0 ? `${(promptTokens / completionTokens).toFixed(1)}x` : "—";

    // Format Model Breakdown
    const modelBreakdown = Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        requests: data.requests,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        sharePercent: totalTokens > 0 ? parseFloat(((data.totalTokens / totalTokens) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // Format Provider Breakdown
    const providerBreakdown = Array.from(providerMap.entries())
      .map(([provider, data]) => ({
        provider,
        requests: data.requests,
        totalTokens: data.totalTokens,
        sharePercent: totalTokens > 0 ? parseFloat(((data.totalTokens / totalTokens) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // Format Key Breakdown
    const apiKeyBreakdown = Array.from(keyMap.entries())
      .map(([keyName, data]) => ({
        keyName,
        keyPrefix: data.keyPrefix,
        requests: data.requests,
        totalTokens: data.totalTokens,
        sharePercent: totalTokens > 0 ? parseFloat(((data.totalTokens / totalTokens) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // 4. Build Timeline Buckets for Usage Trend
    const timeline: Array<{ label: string; totalTokens: number; promptTokens: number; completionTokens: number; requests: number }> = [];
    if (args.timeRange === "today") {
      for (let h = 0; h < 24; h++) {
        const hourLabel = `${String(h).padStart(2, "0")}:00`;
        timeline.push({ label: hourLabel, totalTokens: 0, promptTokens: 0, completionTokens: 0, requests: 0 });
      }
      logs.forEach((l) => {
        const hour = new Date(l.createdAt).getHours();
        if (timeline[hour]) {
          timeline[hour].totalTokens += l.totalTokens;
          timeline[hour].promptTokens += l.promptTokens;
          timeline[hour].completionTokens += l.completionTokens;
          timeline[hour].requests++;
        }
      });
    } else {
      const daysCount = args.timeRange === "7d" ? 7 : args.timeRange === "90d" ? 90 : 30;
      const dayMap = new Map<string, { label: string; totalTokens: number; promptTokens: number; completionTokens: number; requests: number }>();
      
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const label = `${mm}/${dd}`;
        dayMap.set(key, { label, totalTokens: 0, promptTokens: 0, completionTokens: 0, requests: 0 });
      }

      logs.forEach((l) => {
        const d = new Date(l.createdAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const item = dayMap.get(key);
        if (item) {
          item.totalTokens += l.totalTokens;
          item.promptTokens += l.promptTokens;
          item.completionTokens += l.completionTokens;
          item.requests++;
        }
      });

      dayMap.forEach((v) => timeline.push(v));
    }

    // 5. Activity Heatmap: Past 365 Days
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const yearLogs = await ctx.db
      .query("routerLogs")
      .withIndex("by_user_created", (q) => q.eq("userId", userId).gte("createdAt", oneYearAgo))
      .order("desc")
      .take(2000);

    const heatmapMap = new Map<string, { count: number; tokens: number }>();
    let maxDayTokens = 0;
    let mostActiveDay = { date: "—", tokens: 0, requests: 0 };

    yearLogs.forEach((l) => {
      const d = new Date(l.createdAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const entry = heatmapMap.get(dateKey) || { count: 0, tokens: 0 };
      entry.count++;
      entry.tokens += l.totalTokens;
      heatmapMap.set(dateKey, entry);

      if (entry.tokens > maxDayTokens) {
        maxDayTokens = entry.tokens;
        mostActiveDay = { date: dateKey, tokens: entry.tokens, requests: entry.count };
      }
    });

    const dailyHeatmap: Array<{ date: string; count: number; tokens: number; level: 0 | 1 | 2 | 3 | 4 }> = [];
    for (let i = 363; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const data = heatmapMap.get(dateKey) || { count: 0, tokens: 0 };

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (data.tokens > 0) {
        if (maxDayTokens > 0) {
          const ratio = data.tokens / maxDayTokens;
          if (ratio > 0.75) level = 4;
          else if (ratio > 0.5) level = 3;
          else if (ratio > 0.25) level = 2;
          else level = 1;
        } else {
          level = 1;
        }
      }

      dailyHeatmap.push({
        date: dateKey,
        count: data.count,
        tokens: data.tokens,
        level,
      });
    }

    return {
      kpi: {
        totalTokens,
        promptTokens,
        completionTokens,
        cachedTokens,
        totalRequests,
        successRate,
        avgDurationMs,
        avgTtftMs,
        avgSpeed,
        ioRatio,
      },
      infrastructure: {
        activeProvidersCount,
        activeKeysCount,
        activeModelsCount: modelMap.size,
      },
      modelBreakdown,
      providerBreakdown,
      apiKeyBreakdown,
      timeline,
      dailyHeatmap,
      mostActiveDay,
    };
  },
});

