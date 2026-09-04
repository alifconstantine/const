import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    learnId: v.optional(v.id("learns")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    let artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (args.learnId) {
      artifacts = artifacts.filter((a) => a.learnId === args.learnId);
    }

    artifacts.sort((a, b) => b.updatedAt - a.updatedAt);
    return artifacts;
  },
});

export const create = mutation({
  args: {
    learnId: v.optional(v.id("learns")),
    title: v.string(),
    type: v.string(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in to create an artifact.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("artifacts", {
      userId,
      learnId: args.learnId,
      title: args.title.trim() || "Untitled Artifact",
      type: args.type,
      content: args.content,
      updatedAt: now,
      createdAt: now,
    });

    return id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("artifacts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Artifact not found or access denied");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
