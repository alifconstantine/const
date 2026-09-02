import { defineTable } from "convex/server";
import { v } from "convex/values";

export const routerTables = {
  apiKeys: defineTable({
    userId: v.id("users"),
    keyHash: v.string(),
    prefix: v.string(), // sk-const-xxxx
    name: v.string(),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_keyHash", ["keyHash"]),

  tokenQuotas: defineTable({
    userId: v.id("users"),
    tier: v.string(), // "free" | "pro" | "enterprise"
    maxDailyTokens: v.number(),
    usedDailyTokens: v.number(),
    resetDailyAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  usageLogs: defineTable({
    userId: v.id("users"),
    apiKeyId: v.optional(v.id("apiKeys")),
    provider: v.string(), // "gemini" | "openai" | "groq" | etc.
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    durationMs: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_timestamp", ["timestamp"]),
};
