import { defineTable } from "convex/server";
import { v } from "convex/values";

export const sharedTables = {
  rateLimits: defineTable({
    key: v.string(), // e.g. "magic_link:name@example.com"
    attempts: v.number(),
    resetAt: v.number(), // timestamp in ms when rate window resets
  }).index("by_key", ["key"]),
};
