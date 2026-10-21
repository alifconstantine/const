import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// System default slugs (none reserved, users create their own)
export const SYSTEM_DEFAULT_SLUGS: readonly string[] = [];

// Base system default combos: empty by default so users configure their own combos
export const SYSTEM_DEFAULT_COMBOS: any[] = [];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^combo\//, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 1. List All Combos (User-created Custom Combos only)
export const listCombos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const userCombos = await ctx.db
      .query("routerCombos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return userCombos.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      systemMessage: c.systemMessage,
      contextLength: c.contextLength,
      strategy: c.strategy,
      models: c.models,
      isBuiltin: false,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },
});

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 2. Get a Specific Combo by ID or Slug (Supports Web Session Auth & API Key Auth)
export const getCombo = query({
  args: {
    slug: v.optional(v.string()),
    id: v.optional(v.string()),
    rawApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanSlug = args.slug ? slugify(args.slug) : "";
    let userId = await getAuthUserId(ctx);

    // If no direct session, check rawApiKey for sk-const-live-
    if (!userId && args.rawApiKey && args.rawApiKey.startsWith("sk-const-live-")) {
      const keyHash = await hashApiKey(args.rawApiKey);
      const keyDoc = await ctx.db
        .query("apiKeys")
        .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
        .unique();

      if (keyDoc && keyDoc.status === "active") {
        userId = keyDoc.userId;
      }
    }

    if (!userId) return null;

    if (cleanSlug) {
      const combo = await ctx.db
        .query("routerCombos")
        .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", cleanSlug))
        .first();
      if (combo) return { ...combo, isBuiltin: false };
    }

    if (args.id) {
      try {
        const combo = await ctx.db.get(args.id as any);
        if (combo && (combo as any).userId === userId) {
          return { ...(combo as any), isBuiltin: false };
        }
      } catch {
        return null;
      }
    }

    return null;
  },
});

// 3. Create a New Custom Combo
export const createCombo = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    systemMessage: v.optional(v.string()),
    contextLength: v.optional(v.number()),
    strategy: v.optional(
      v.union(v.literal("priority"), v.literal("round-robin"), v.literal("random"))
    ),
    models: v.array(
      v.object({
        modelId: v.string(),
        providerId: v.string(),
        providerName: v.string(),
        priority: v.number(),
        weight: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized. Please sign in.");
    }

    const cleanName = args.name.trim();
    if (!cleanName) {
      throw new Error("Combo name is required.");
    }

    const cleanSlug = slugify(args.slug || cleanName);
    if (!cleanSlug) {
      throw new Error("Invalid combo slug.");
    }

    // Check collision with built-in slugs
    if (SYSTEM_DEFAULT_SLUGS.includes(cleanSlug as any)) {
      throw new Error(`The slug "${cleanSlug}" is reserved by a system default combo.`);
    }

    // Check collision with user's existing combos
    const existing = await ctx.db
      .query("routerCombos")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", cleanSlug))
      .first();

    if (existing) {
      throw new Error(`A combo with slug "${cleanSlug}" already exists in your account.`);
    }

    if (!args.models || args.models.length === 0) {
      throw new Error("At least one model must be added to the combo.");
    }

    // Normalize priority 1..N
    const sortedModels = [...args.models]
      .sort((a, b) => a.priority - b.priority)
      .map((m, idx) => ({
        ...m,
        priority: idx + 1,
      }));

    const now = Date.now();
    const comboId = await ctx.db.insert("routerCombos", {
      userId,
      name: cleanName,
      slug: cleanSlug,
      description: args.description?.trim() || undefined,
      systemMessage: args.systemMessage?.trim() || undefined,
      contextLength: args.contextLength || 262144, // Default 256K
      strategy: args.strategy || "priority",
      models: sortedModels,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return { comboId, slug: cleanSlug };
  },
});

// 4. Update an Existing Custom Combo
export const updateCombo = mutation({
  args: {
    id: v.id("routerCombos"),
    name: v.string(),
    description: v.optional(v.string()),
    systemMessage: v.optional(v.string()),
    contextLength: v.optional(v.number()),
    strategy: v.optional(
      v.union(v.literal("priority"), v.literal("round-robin"), v.literal("random"))
    ),
    models: v.array(
      v.object({
        modelId: v.string(),
        providerId: v.string(),
        providerName: v.string(),
        priority: v.number(),
        weight: v.optional(v.number()),
      })
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Combo not found or unauthorized.");
    }

    if (!args.models || args.models.length === 0) {
      throw new Error("A combo must have at least one model.");
    }

    const sortedModels = [...args.models]
      .sort((a, b) => a.priority - b.priority)
      .map((m, idx) => ({
        ...m,
        priority: idx + 1,
      }));

    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      systemMessage: args.systemMessage?.trim() || undefined,
      contextLength: args.contextLength || existing.contextLength,
      strategy: args.strategy || existing.strategy,
      models: sortedModels,
      status: args.status || existing.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// 5. Delete a Custom Combo
export const deleteCombo = mutation({
  args: {
    id: v.id("routerCombos"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Combo not found or unauthorized.");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// 6. Resolve Combo for Gateway Execution
export const resolveComboForExecution = query({
  args: {
    slug: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const cleanSlug = slugify(args.slug);
    let userId = args.userId;
    if (!userId) {
      userId = (await getAuthUserId(ctx)) ?? undefined;
    }

    if (!userId) return null;

    const combo = await ctx.db
      .query("routerCombos")
      .withIndex("by_user_slug", (q) => q.eq("userId", userId!).eq("slug", cleanSlug))
      .first();

    if (!combo || combo.status === "disabled") {
      return null;
    }

    return {
      name: combo.name,
      slug: combo.slug,
      systemMessage: combo.systemMessage,
      contextLength: combo.contextLength,
      strategy: combo.strategy,
      models: combo.models,
      isBuiltin: false,
    };
  },
});
