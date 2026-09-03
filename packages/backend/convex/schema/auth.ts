import { defineTable } from "convex/server";
import { authTables as baseAuthTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const authTables = {
  ...baseAuthTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
};
