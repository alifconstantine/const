import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fetch all user learns to count items per collection accurately
    const learns = await ctx.db
      .query("learns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeLearns = learns.filter((l) => !l.isArchived);

    // Map each collection with its real count
    const collectionsWithCount = collections.map((col) => {
      const count = activeLearns.filter((l) =>
        l.collectionIds ? l.collectionIds.includes(col._id) : false
      ).length;
      return {
        ...col,
        itemCount: count,
      };
    });

    // Sort by updatedAt desc
    collectionsWithCount.sort((a, b) => b.updatedAt - a.updatedAt);
    return collectionsWithCount;
  },
});

export const get = query({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const collection = await ctx.db.get(args.id);
    if (!collection || collection.userId !== userId) {
      return null;
    }
    return collection;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in to create a collection.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("collections", {
      userId,
      name: args.name.trim() || "Koleksi Baru",
      description: args.description?.trim(),
      emoji: args.emoji || "📁",
      color: args.color || "#0066ff",
      updatedAt: now,
      createdAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Collection not found or access denied");
    }

    const updates: Partial<typeof existing> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim() || "Koleksi Baru";
    if (args.description !== undefined) updates.description = args.description?.trim();
    if (args.emoji !== undefined) updates.emoji = args.emoji;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("collections"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Collection not found or access denied");
    }

    // Clean up collectionIds from any learns that reference this collection
    const learns = await ctx.db
      .query("learns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const learn of learns) {
      if (learn.collectionIds && learn.collectionIds.includes(args.id)) {
        const nextCollections = learn.collectionIds.filter((cid) => cid !== args.id);
        await ctx.db.patch(learn._id, {
          collectionIds: nextCollections,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
