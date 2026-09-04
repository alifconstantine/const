import { defineTable } from "convex/server";
import { v } from "convex/values";

export const routerTables = {
  // 1. User API Keys to access Const Router AI Gateway (sk-const-live-xxxx)
  apiKeys: defineTable({
    userId: v.id("users"),
    name: v.string(),
    keyPrefix: v.string(), // e.g. "sk-const-live-...d2e4"
    keyHash: v.string(),   // SHA-256 hash for safe, high-speed lookup
    dailyLimitTokens: v.optional(v.number()),
    usedTodayTokens: v.number(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_key_hash", ["keyHash"]),
};
