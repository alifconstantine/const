import { defineTable } from "convex/server";
import { v } from "convex/values";

export const learnTables = {
  learns: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    collectionIds: v.optional(v.array(v.id("collections"))),
    sourcesCount: v.optional(v.number()),
    updatedAt: v.number(),
    createdAt: v.number(),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  collections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    emoji: v.optional(v.string()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  artifacts: defineTable({
    userId: v.id("users"),
    learnId: v.optional(v.id("learns")),
    title: v.string(),
    type: v.string(), // "slide" | "diagram" | "simulator" | "document" | "code"
    content: v.optional(v.string()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_learn", ["learnId"]),
};
