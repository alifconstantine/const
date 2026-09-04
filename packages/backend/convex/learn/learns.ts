import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    collectionId: v.optional(v.id("collections")),
    search: v.optional(v.string()),
    sort: v.optional(v.string()), // "recent" | "oldest" | "title_asc" | "title_desc"
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    let learns = await ctx.db
      .query("learns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter out archived if any
    learns = learns.filter((l) => !l.isArchived);

    // Filter by collection
    if (args.collectionId) {
      learns = learns.filter((l) =>
        l.collectionIds ? l.collectionIds.includes(args.collectionId!) : false
      );
    }

    // Filter by search query
    if (args.search && args.search.trim().length > 0) {
      const q = args.search.trim().toLowerCase();
      learns = learns.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }

    // Sort
    const sort = args.sort ?? "recent";
    if (sort === "recent") {
      learns.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sort === "oldest") {
      learns.sort((a, b) => a.updatedAt - b.updatedAt);
    } else if (sort === "title_asc") {
      learns.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "title_desc") {
      learns.sort((a, b) => b.title.localeCompare(a.title));
    }

    return learns;
  },
});

export const get = query({
  args: { id: v.id("learns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const learn = await ctx.db.get(args.id);
    if (!learn || learn.userId !== userId) {
      return null;
    }
    return learn;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in to create a learn.");
    }

    const now = Date.now();
    const collectionIds = args.collectionId ? [args.collectionId] : [];

    const id = await ctx.db.insert("learns", {
      userId,
      title: args.title.trim() || "Untitled learn",
      description: args.description?.trim(),
      emoji: args.emoji || "🚀",
      collectionIds,
      sourcesCount: 0,
      updatedAt: now,
      createdAt: now,
      isArchived: false,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("learns"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    emoji: v.optional(v.string()),
    collectionIds: v.optional(v.array(v.id("collections"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Learn not found or access denied");
    }

    const updates: Partial<typeof existing> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title.trim() || "Untitled learn";
    if (args.description !== undefined) updates.description = args.description?.trim();
    if (args.emoji !== undefined) updates.emoji = args.emoji;
    if (args.collectionIds !== undefined) updates.collectionIds = args.collectionIds;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("learns"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Learn not found or access denied");
    }

    // Remove any artifacts associated with this learn
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_learn", (q) => q.eq("learnId", args.id))
      .collect();

    for (const art of artifacts) {
      await ctx.db.delete(art._id);
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const batchDelete = mutation({
  args: {
    ids: v.array(v.id("learns")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    for (const id of args.ids) {
      const existing = await ctx.db.get(id);
      if (existing && existing.userId === userId) {
        // Delete artifacts
        const artifacts = await ctx.db
          .query("artifacts")
          .withIndex("by_learn", (q) => q.eq("learnId", id))
          .collect();

        for (const art of artifacts) {
          await ctx.db.delete(art._id);
        }

        await ctx.db.delete(id);
      }
    }

    return { count: args.ids.length };
  },
});

export const toggleCollection = mutation({
  args: {
    learnId: v.id("learns"),
    collectionId: v.id("collections"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const learn = await ctx.db.get(args.learnId);
    if (!learn || learn.userId !== userId) {
      throw new Error("Learn not found or access denied");
    }

    const currentCollections = learn.collectionIds ?? [];
    let nextCollections: typeof currentCollections;

    if (currentCollections.includes(args.collectionId)) {
      nextCollections = currentCollections.filter((id) => id !== args.collectionId);
    } else {
      nextCollections = [...currentCollections, args.collectionId];
    }

    await ctx.db.patch(args.learnId, {
      collectionIds: nextCollections,
      updatedAt: Date.now(),
    });

    return { inCollection: nextCollections.includes(args.collectionId) };
  },
});
