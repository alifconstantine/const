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
    ssoToken: v.optional(v.string()),  // SSO JWT token from Accounts / Harness / Web
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
    requestType: v.optional(
      v.union(
        v.literal("chat"),
        v.literal("image_generation"),
        v.literal("image_edit")
      )
    ),
    imageCount: v.optional(v.number()),
    imageUrls: v.optional(v.array(v.string())),
    prompt: v.optional(v.string()),
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

    // B. Or resolve via SSO JWT token (from Harness Desktop / Web Accounts)
    if (!resolvedUserId && args.ssoToken) {
      try {
        const parts = args.ssoToken.split(".");
        const b64Part = parts[1];
        if (parts.length >= 2 && b64Part) {
          const base64 = b64Part.replace(/-/g, "+").replace(/_/g, "/");
          const jsonStr =
            typeof atob === "function"
              ? atob(base64)
              : typeof Buffer !== "undefined"
              ? Buffer.from(base64, "base64").toString("utf-8")
              : null;
          if (jsonStr) {
            const payload = JSON.parse(jsonStr);
            const sub = payload.sub || payload.userId;
            if (typeof sub === "string" && sub) {
              const [subUserId] = sub.split("|");
              if (subUserId) {
                const userDoc = await ctx.db.get(subUserId as Id<"users">);
                if (userDoc) {
                  resolvedUserId = userDoc._id;
                  if (!resolvedKeyName) resolvedKeyName = "Const SSO Session";
                }
              }
            }
          }
        }
      } catch {}
    }

    const cachedTokens = args.cachedTokens || 0;
    let promptTokens = args.promptTokens;
    const completionTokens = args.completionTokens;

    // Backend guard: Ensure promptTokens strictly excludes cached tokens
    if (cachedTokens > 0) {
      if (args.totalTokens >= promptTokens + completionTokens + cachedTokens) {
        promptTokens = Math.max(0, promptTokens - cachedTokens);
      }
    }

    // Total tokens is strictly the sum of pure input tokens and output tokens
    const totalTokens = promptTokens + completionTokens;

    // C. Or resolve via raw API key
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

        // Increment token usage for the API key (excluding cache)
        await ctx.db.patch(apiKeyDoc._id, {
          usedTodayTokens: apiKeyDoc.usedTodayTokens + totalTokens,
          lastUsedAt: Date.now(),
        });
      }
    }

    // If neither session, SSO token, nor valid API key found, abort write
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
      promptTokens,
      cachedTokens: 0,
      completionTokens,
      totalTokens,
      ttftMs: args.ttftMs,
      durationMs: args.durationMs,
      tokensPerSecond: args.tokensPerSecond,
      ip: args.ip,
      userAgent: args.userAgent,
      requestType: args.requestType || "chat",
      imageCount: args.imageCount,
      imageUrls: args.imageUrls,
      prompt: args.prompt,
      createdAt: Date.now(),
    });

    // Deduct tokens from user's weekly quota for Const-managed models (excluding cache)
    const isConstModel =
      args.provider === "const" ||
      args.provider === "Google AI" ||
      args.provider.toLowerCase().includes("const");

    if (isConstModel && args.status === 200 && totalTokens > 0) {
      const now = Date.now();
      const WEEKLY_LIMIT = 7_000_000;
      const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

      const quotaDoc = await ctx.db
        .query("userQuotas")
        .withIndex("by_user", (q) => q.eq("userId", resolvedUserId!))
        .first();

      if (!quotaDoc) {
        await ctx.db.insert("userQuotas", {
          userId: resolvedUserId,
          weeklyLimitTokens: WEEKLY_LIMIT,
          usedTokens: Math.min(WEEKLY_LIMIT, totalTokens),
          periodStartAt: now,
          periodEndAt: now + WEEK_MS,
          lastDeductedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        let currentUsed = quotaDoc.usedTokens;
        let periodStartAt = quotaDoc.periodStartAt;
        let periodEndAt = quotaDoc.periodEndAt;

        if (now >= periodEndAt) {
          const cyclesElapsed = Math.floor((now - periodStartAt) / WEEK_MS);
          periodStartAt = periodStartAt + cyclesElapsed * WEEK_MS;
          periodEndAt = periodStartAt + WEEK_MS;
          currentUsed = 0;
        }

        const newUsed = Math.min(
          quotaDoc.weeklyLimitTokens || WEEKLY_LIMIT,
          currentUsed + totalTokens
        );

        await ctx.db.patch(quotaDoc._id, {
          usedTokens: newUsed,
          periodStartAt,
          periodEndAt,
          lastDeductedAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true, logId };
  },
});

// 2. List request logs with filters and pagination
export const listLogs = query({
  args: {
    statusFilter: v.optional(v.string()), // "all", "200", "errors"
    modelFilter: v.optional(v.string()),
    providerFilter: v.optional(v.string()),
    typeFilter: v.optional(v.string()), // "all", "chat", "image"
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

    // Apply Type Filter
    if (args.typeFilter && args.typeFilter !== "all") {
      if (args.typeFilter === "image") {
        logs = logs.filter((l) => l.requestType === "image_generation" || l.requestType === "image_edit");
      } else if (args.typeFilter === "chat") {
        logs = logs.filter((l) => !l.requestType || l.requestType === "chat");
      }
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

    // Apply Search Query (matches requestId, model, provider, keyName, prompt, requestType)
    if (args.searchQuery && args.searchQuery.trim()) {
      const q = args.searchQuery.toLowerCase().trim();
      logs = logs.filter(
        (l) =>
          l.requestId.toLowerCase().includes(q) ||
          l.model.toLowerCase().includes(q) ||
          l.provider.toLowerCase().includes(q) ||
          (l.keyName && l.keyName.toLowerCase().includes(q)) ||
          (l.prompt && l.prompt.toLowerCase().includes(q)) ||
          (l.requestType && l.requestType.toLowerCase().includes(q))
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

// Helper to extract user ID from auth context or SSO token payload
async function resolveLogUserId(
  ctx: any,
  rawApiKey?: string,
  ssoToken?: string
): Promise<Id<"users"> | null> {
  const sessionUserId = await getAuthUserId(ctx);
  if (sessionUserId) return sessionUserId;

  if (ssoToken) {
    try {
      const parts = ssoToken.split(".");
      const b64Part = parts[1];
      if (parts.length >= 2 && b64Part) {
        const base64 = b64Part.replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr =
          typeof atob === "function"
            ? atob(base64)
            : typeof Buffer !== "undefined"
            ? Buffer.from(base64, "base64").toString("utf-8")
            : null;
        if (jsonStr) {
          const payload = JSON.parse(jsonStr);
          const sub = payload.sub || payload.userId;
          if (typeof sub === "string" && sub) {
            const [subUserId] = sub.split("|");
            if (subUserId) {
              const userDoc = await ctx.db.get(subUserId as Id<"users">);
              if (userDoc) return userDoc._id;
            }
          }
        }
      }
    } catch {}
  }

  if (rawApiKey) {
    const keyHash = await hashKey(rawApiKey.trim());
    const apiKeyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q: any) => q.eq("keyHash", keyHash))
      .first();
    if (apiKeyDoc && apiKeyDoc.status === "active") {
      return apiKeyDoc.userId;
    }
  }

  return null;
}

// 4. Comprehensive Dashboard Analytics
export const getDashboardAnalytics = query({
  args: {
    rawApiKey: v.optional(v.string()),
    ssoToken: v.optional(v.string()),
    timeRange: v.optional(v.string()), // "today", "7d", "30d", "90d", "all"
    tzOffset: v.optional(v.number()),  // Client timezone offset in minutes (e.g. from -new Date().getTimezoneOffset())
  },
  handler: async (ctx, args) => {
    const userId = await resolveLogUserId(ctx, args.rawApiKey, args.ssoToken);
    if (!userId) {
      return null;
    }

    const now = Date.now();
    const tzOffsetMinutes = typeof args.tzOffset === "number" ? args.tzOffset : 0;
    const tzOffsetMs = tzOffsetMinutes * 60 * 1000;

    let startTime = 0;
    if (args.timeRange === "today") {
      // Rolling 24 hours for "today" to guarantee 24 accurate hourly buckets up to "now"
      startTime = now - 24 * 60 * 60 * 1000;
    } else if (args.timeRange === "7d") {
      startTime = now - 7 * 24 * 60 * 60 * 1000;
    } else if (args.timeRange === "30d") {
      startTime = now - 30 * 24 * 60 * 60 * 1000;
    } else if (args.timeRange === "90d") {
      startTime = now - 90 * 24 * 60 * 60 * 1000;
    }
    // "all" leaves startTime = 0 (all time)

    // 1. Fetch filtered logs for the selected timeRange
    const logsQuery = ctx.db
      .query("routerLogs")
      .withIndex("by_user_created", (q) =>
        startTime > 0 ? q.eq("userId", userId).gte("createdAt", startTime) : q.eq("userId", userId)
      )
      .order("desc");

    const logs = await logsQuery.take(1500);

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
    const activeProvidersCount = userProviders.filter((p) => p.status === "active").length + 1; // +1 for default Const Gateway

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
    const providerMap = new Map<string, { requests: number; inputTokens: number; outputTokens: number; totalTokens: number; durationSum: number; successCount: number }>();
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
      const p = providerMap.get(l.provider) || { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, durationSum: 0, successCount: 0 };
      p.requests++;
      p.inputTokens += l.promptTokens;
      p.outputTokens += l.completionTokens;
      p.totalTokens += l.totalTokens;
      p.durationSum += l.durationMs;
      if (l.status >= 200 && l.status < 300) {
        p.successCount++;
      }
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
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        avgDurationMs: data.requests > 0 ? Math.round(data.durationSum / data.requests) : 0,
        successRate: data.requests > 0 ? Math.round((data.successCount / data.requests) * 100) : 100,
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
    const timeline: Array<{
      label: string;
      date: string;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      requests: number;
      models: Record<string, number>;
    }> = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (args.timeRange === "today") {
      // 24 hourly buckets from 23 hours ago up to the current hour ("Now")
      for (let i = 23; i >= 0; i--) {
        const bucketTime = now - i * 60 * 60 * 1000;
        const localD = new Date(bucketTime + tzOffsetMs);
        const hourLabel = `${String(localD.getUTCHours()).padStart(2, "0")}:00`;
        const yyyy = localD.getUTCFullYear();
        const mm = String(localD.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(localD.getUTCDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}T${hourLabel}`;
        timeline.push({
          label: hourLabel,
          date: dateKey,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          requests: 0,
          models: {},
        });
      }

      logs.forEach((l) => {
        const diffMs = now - l.createdAt;
        if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
          const hoursAgo = Math.floor(diffMs / (60 * 60 * 1000));
          const bucketIndex = 23 - hoursAgo;
          if (timeline[bucketIndex]) {
            timeline[bucketIndex].totalTokens += l.totalTokens;
            timeline[bucketIndex].promptTokens += l.promptTokens;
            timeline[bucketIndex].completionTokens += l.completionTokens;
            timeline[bucketIndex].requests++;
            const m = l.model || "unknown";
            timeline[bucketIndex].models[m] = (timeline[bucketIndex].models[m] || 0) + l.totalTokens;
          }
        }
      });
    } else {
      let daysCount = 30;
      if (args.timeRange === "7d") {
        daysCount = 8; // 7 days ago through today (e.g. Oct 12 through Oct 19, matching 8 tick points)
      } else if (args.timeRange === "90d") {
        daysCount = 90;
      } else if (args.timeRange === "all") {
        if (logs.length > 0) {
          const oldestLog = logs[logs.length - 1];
          const daysSpan = Math.ceil((now - (oldestLog?.createdAt || now)) / (24 * 60 * 60 * 1000));
          daysCount = Math.max(8, Math.min(180, daysSpan + 1));
        } else {
          daysCount = 30;
        }
      }

      const dayMap = new Map<
        string,
        {
          label: string;
          date: string;
          totalTokens: number;
          promptTokens: number;
          completionTokens: number;
          requests: number;
          models: Record<string, number>;
        }
      >();

      const localNow = new Date(now + tzOffsetMs);
      const nowY = localNow.getUTCFullYear();
      const nowM = localNow.getUTCMonth();
      const nowD = localNow.getUTCDate();

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(nowY, nowM, nowD - i, 12, 0, 0));
        const yyyy = d.getUTCFullYear();
        const mIdx = d.getUTCMonth();
        const mm = String(mIdx + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const label = `${monthNames[mIdx] || ""} ${d.getUTCDate()}`;
        dayMap.set(key, {
          label,
          date: key,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          requests: 0,
          models: {},
        });
      }

      logs.forEach((l) => {
        const d = new Date(l.createdAt + tzOffsetMs);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const item = dayMap.get(key);
        if (item) {
          item.totalTokens += l.totalTokens;
          item.promptTokens += l.promptTokens;
          item.completionTokens += l.completionTokens;
          item.requests++;
          const m = l.model || "unknown";
          item.models[m] = (item.models[m] || 0) + l.totalTokens;
        }
      });

      dayMap.forEach((v) => timeline.push(v));
    }

    // 5. Activity Heatmap: 53 weeks aligned to Sunday-Saturday calendar
    // Fetch logs from the past 380 days
    const heatmapStartTime = now - 380 * 24 * 60 * 60 * 1000;
    const yearLogs = await ctx.db
      .query("routerLogs")
      .withIndex("by_user_created", (q) => q.eq("userId", userId).gte("createdAt", heatmapStartTime))
      .order("desc")
      .take(5000);

    const heatmapMap = new Map<string, { count: number; tokens: number }>();
    let maxDayTokens = 0;
    let mostActiveDay = { date: "—", tokens: 0, requests: 0 };

    yearLogs.forEach((l) => {
      const d = new Date(l.createdAt + tzOffsetMs);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
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

    const localNow = new Date(now + tzOffsetMs);
    const todayY = localNow.getUTCFullYear();
    const todayM = localNow.getUTCMonth();
    const todayD = localNow.getUTCDate();
    const todayDayOfWeek = localNow.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const todayKey = `${todayY}-${String(todayM + 1).padStart(2, "0")}-${String(todayD).padStart(2, "0")}`;

    // 53 weeks * 7 days = 371 days ending on this week's Saturday
    const dailyHeatmap: Array<{
      date: string;
      count: number;
      tokens: number;
      level: 0 | 1 | 2 | 3 | 4;
      dayOfWeek: number;
      weekIndex: number;
      isToday: boolean;
      isFuture: boolean;
      weekTokens: number;
      cumulativeTokens: number;
    }> = [];

    const weekTotals = new Array(53).fill(0);
    let runningCumulative = 0;
    const seenMonths = new Set<string>();
    const monthLabels: Array<{ label: string; weekIndex: number }> = [];

    // First pass: aggregate week totals
    for (let i = 0; i < 371; i++) {
      const d = new Date(Date.UTC(todayY, todayM, todayD - todayDayOfWeek - 52 * 7 + i, 12, 0, 0));
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const weekIndex = Math.floor(i / 7);
      const isFuture = dateKey > todayKey;
      if (!isFuture) {
        const data = heatmapMap.get(dateKey);
        if (data) {
          weekTotals[weekIndex] = (weekTotals[weekIndex] || 0) + data.tokens;
        }
      }
    }

    let maxWeekTokens = 0;
    for (const w of weekTotals) {
      if (w > maxWeekTokens) maxWeekTokens = w;
    }

    // Second pass: construct cells
    for (let i = 0; i < 371; i++) {
      const d = new Date(Date.UTC(todayY, todayM, todayD - todayDayOfWeek - 52 * 7 + i, 12, 0, 0));
      const yyyy = d.getUTCFullYear();
      const mIdx = d.getUTCMonth();
      const mm = String(mIdx + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = d.getUTCDay();
      const weekIndex = Math.floor(i / 7);
      const isFuture = dateKey > todayKey;
      const isToday = dateKey === todayKey;

      // Track month labels: record first week where the month appears (when day <= 14)
      const monthKey = `${yyyy}-${mm}`;
      if (!seenMonths.has(monthKey) && d.getUTCDate() <= 14 && weekIndex > 0 && weekIndex < 52) {
        seenMonths.add(monthKey);
        monthLabels.push({ label: monthNames[mIdx] || "", weekIndex });
      }

      const data = isFuture ? { count: 0, tokens: 0 } : (heatmapMap.get(dateKey) || { count: 0, tokens: 0 });
      if (!isFuture) {
        runningCumulative += data.tokens;
      }

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (!isFuture && data.tokens > 0) {
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
        dayOfWeek,
        weekIndex,
        isToday,
        isFuture,
        weekTokens: weekTotals[weekIndex] || 0,
        cumulativeTokens: runningCumulative,
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
      monthLabels,
      mostActiveDay,
      maxDayTokens,
      maxWeekTokens,
      totalYearTokens: runningCumulative,
    };
  },
});

