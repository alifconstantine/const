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
