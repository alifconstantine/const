import { query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { resolveIdentity } from "./access";
export const WEEKLY_QUOTA_TOKENS = 7_000_000;
export const WEEKLY_QUOTA_IMAGES = 20;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export function formatCountdown(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60);
  return days
    ? days + "d " + hours + "h"
    : hours
      ? hours + "h " + (minutes % 60) + "m"
      : minutes + "m";
}
export function calculateQuotaState(
  doc: Doc<"userQuotas"> | null,
  now = Date.now(),
) {
  const expired = !doc || now >= doc.periodEndAt;
  const start = !doc
    ? now
    : expired
      ? doc.periodStartAt +
        Math.floor((now - doc.periodStartAt) / WEEK_MS) * WEEK_MS
      : doc.periodStartAt;
  const used = expired ? 0 : doc.usedTokens;
  const limit = doc?.weeklyLimitTokens ?? WEEKLY_QUOTA_TOKENS;
  const reserved = expired ? 0 : (doc?.reservedTokens ?? 0);
  const usedImages = expired ? 0 : (doc?.usedImages ?? 0);
  const imageLimit = doc?.weeklyLimitImages ?? WEEKLY_QUOTA_IMAGES;
  const remaining = Math.max(0, limit - used - reserved);
  return {
    weeklyLimitTokens: limit,
    usedTokens: used,
    reservedTokens: reserved,
    remainingTokens: remaining,
    percentUsed: Math.min(100, (used / limit) * 100),
    percentRemaining: (remaining / limit) * 100,
    weeklyLimitImages: imageLimit,
    usedImages,
    remainingImages: Math.max(0, imageLimit - usedImages),
    percentImagesRemaining: Math.max(
      0,
      ((imageLimit - usedImages) / imageLimit) * 100,
    ),
    periodStartAt: start,
    periodEndAt: start + WEEK_MS,
    resetsInMs: Math.max(0, start + WEEK_MS - now),
    resetsInText: formatCountdown(start + WEEK_MS - now),
    isCapped: remaining <= 0,
    isImageCapped: usedImages >= imageLimit,
  };
}
export const getUserQuota = query({
  args: { rawApiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx, args.rawApiKey);
    const doc = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return calculateQuotaState(doc);
  },
});
export const resetUserQuota = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const quota = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (quota)
      await ctx.db.patch(quota._id, {
        usedTokens: 0,
        usedImages: 0,
        reservedTokens: 0,
        periodStartAt: Date.now(),
        periodEndAt: Date.now() + WEEK_MS,
        updatedAt: Date.now(),
      });
  },
});
