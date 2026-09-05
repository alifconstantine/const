import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id, Doc } from "../_generated/dataModel";

export const WEEKLY_QUOTA_TOKENS = 7_000_000; // 7 Million tokens
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Format remaining milliseconds to "Xd Yh" or "Xh Ym"
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Cryptographic hash for secure API key verification
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Helper to compute active quota metrics with virtual rolling rollover.
 */
export function calculateQuotaState(
  quotaDoc: Doc<"userQuotas"> | null,
  now = Date.now()
) {
  if (!quotaDoc) {
    return {
      weeklyLimitTokens: WEEKLY_QUOTA_TOKENS,
      usedTokens: 0,
      remainingTokens: WEEKLY_QUOTA_TOKENS,
      percentUsed: 0,
      percentRemaining: 100,
      periodStartAt: now,
      periodEndAt: now + WEEK_MS,
      resetsInMs: WEEK_MS,
      resetsInText: formatCountdown(WEEK_MS),
      isCapped: false,
    };
  }

  let usedTokens = quotaDoc.usedTokens;
  let periodStartAt = quotaDoc.periodStartAt;
  let periodEndAt = quotaDoc.periodEndAt;

  // Check if cycle has expired (auto-reset rollover)
  if (now >= periodEndAt) {
    const cyclesElapsed = Math.floor((now - periodStartAt) / WEEK_MS);
    periodStartAt = periodStartAt + cyclesElapsed * WEEK_MS;
    periodEndAt = periodStartAt + WEEK_MS;
    usedTokens = 0;
  }

  const weeklyLimit = quotaDoc.weeklyLimitTokens || WEEKLY_QUOTA_TOKENS;
  const remainingTokens = Math.max(0, weeklyLimit - usedTokens);
  const percentUsed = Math.min(
    100,
    parseFloat(((usedTokens / weeklyLimit) * 100).toFixed(1))
  );
  const percentRemaining = Math.max(
    0,
    parseFloat(((remainingTokens / weeklyLimit) * 100).toFixed(1))
  );
  const resetsInMs = Math.max(0, periodEndAt - now);

  return {
    weeklyLimitTokens: weeklyLimit,
    usedTokens,
    remainingTokens,
    percentUsed,
    percentRemaining,
    periodStartAt,
    periodEndAt,
    resetsInMs,
    resetsInText: formatCountdown(resetsInMs),
    isCapped: usedTokens >= weeklyLimit,
  };
}

// 1. Get current authenticated user's weekly quota metrics (Reactive Query)
export const getUserQuota = query({
  args: {
    rawApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let targetUserId: Id<"users"> | null = null;

    const sessionUserId = await getAuthUserId(ctx);
    if (sessionUserId) {
      targetUserId = sessionUserId;
    } else if (args.rawApiKey) {
      const keyHash = await hashKey(args.rawApiKey.trim());
      const apiKeyDoc = await ctx.db
        .query("apiKeys")
        .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
        .first();
      if (apiKeyDoc && apiKeyDoc.status === "active") {
        targetUserId = apiKeyDoc.userId;
      }
    }

    if (!targetUserId) {
      return null;
    }

    const quotaDoc = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .first();

    return calculateQuotaState(quotaDoc);
  },
});

// 2. Ensure / Reset / Deduct tokens mutation
export const deductConstQuota = mutation({
  args: {
    userId: v.id("users"),
    tokensToDeduct: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const quotaDoc = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!quotaDoc) {
      const newId = await ctx.db.insert("userQuotas", {
        userId: args.userId,
        weeklyLimitTokens: WEEKLY_QUOTA_TOKENS,
        usedTokens: Math.min(WEEKLY_QUOTA_TOKENS, Math.max(0, args.tokensToDeduct)),
        periodStartAt: now,
        periodEndAt: now + WEEK_MS,
        lastDeductedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, quotaId: newId };
    }

    let currentUsed = quotaDoc.usedTokens;
    let periodStartAt = quotaDoc.periodStartAt;
    let periodEndAt = quotaDoc.periodEndAt;

    // Cycle rollover check
    if (now >= periodEndAt) {
      const cyclesElapsed = Math.floor((now - periodStartAt) / WEEK_MS);
      periodStartAt = periodStartAt + cyclesElapsed * WEEK_MS;
      periodEndAt = periodStartAt + WEEK_MS;
      currentUsed = 0;
    }

    const newUsed = Math.min(
      quotaDoc.weeklyLimitTokens,
      currentUsed + Math.max(0, args.tokensToDeduct)
    );

    await ctx.db.patch(quotaDoc._id, {
      usedTokens: newUsed,
      periodStartAt,
      periodEndAt,
      lastDeductedAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      usedTokens: newUsed,
      isCapped: newUsed >= quotaDoc.weeklyLimitTokens,
    };
  },
});

// 3. Fast pre-flight check before executing gateway request
export const checkGatewayQuota = query({
  args: {
    rawApiKey: v.optional(v.string()),
    provider: v.string(), // "const", "openai", "anthropic", etc.
  },
  handler: async (ctx, args) => {
    // Only Const-managed models are subjected to the 7M weekly limit
    const isConstManaged =
      args.provider === "const" ||
      args.provider === "Google AI" ||
      args.provider.toLowerCase().includes("const");

    if (!isConstManaged) {
      return {
        allowed: true,
        reason: "unmetered_byok",
        remainingTokens: Infinity,
      };
    }

    let targetUserId: Id<"users"> | null = null;
    const sessionUserId = await getAuthUserId(ctx);
    if (sessionUserId) {
      targetUserId = sessionUserId;
    } else if (args.rawApiKey) {
      const keyHash = await hashKey(args.rawApiKey.trim());
      const apiKeyDoc = await ctx.db
        .query("apiKeys")
        .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
        .first();
      if (apiKeyDoc && apiKeyDoc.status === "active") {
        targetUserId = apiKeyDoc.userId;
      }
    }

    if (!targetUserId) {
      return {
        allowed: false,
        reason: "unauthorized",
        remainingTokens: 0,
      };
    }

    const quotaDoc = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .first();

    const state = calculateQuotaState(quotaDoc);

    return {
      allowed: !state.isCapped,
      reason: state.isCapped ? "weekly_quota_exceeded" : "within_quota",
      remainingTokens: state.remainingTokens,
      resetsInText: state.resetsInText,
      weeklyLimitTokens: state.weeklyLimitTokens,
      usedTokens: state.usedTokens,
    };
  },
});
