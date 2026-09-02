import { defineTable } from "convex/server";
import { v } from "convex/values";

export const authTables = {
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    emailVerified: v.optional(v.boolean()),
    image: v.optional(v.string()),
    role: v.optional(v.string()), // "user" | "admin" | etc.
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  identities: defineTable({
    userId: v.id("users"),
    provider: v.string(), // "google" | "github" | "credentials"
    providerAccountId: v.string(),
    createdAt: v.optional(v.number()),
  })
    .index("by_provider_account", ["provider", "providerAccountId"])
    .index("by_userId", ["userId"]),
};
