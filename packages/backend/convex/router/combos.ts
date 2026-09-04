import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 3 Standard System Built-in Combos
export const SYSTEM_DEFAULT_COMBOS = [
  {
    _id: "builtin_auto",
    name: "Auto (Best Available)",
    slug: "auto",
    description: "Intelligently balances accuracy, reasoning depth, and latency with multi-provider failover.",
    systemMessage: undefined,
    contextLength: 262144, // 256K
    strategy: "priority" as const,
    isBuiltin: true,
    status: "active" as const,
    models: [
      {
        modelId: "gemini-3.6-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 1,
      },
      {
        modelId: "gemini-2.5-flash",
        providerId: "google",
        providerName: "Google AI",
        priority: 2,
      },
      {
        modelId: "deepseek-chat",
        providerId: "deepseek",
        providerName: "DeepSeek",
        priority: 3,
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    _id: "builtin_fast",
    name: "Fast (Low Latency)",
    slug: "fast",
    description: "Sub-second time-to-first-token and ultra-high throughput for instant conversational feedback.",
    systemMessage: undefined,
    contextLength: 262144, // 256K
    strategy: "priority" as const,
    isBuiltin: true,
    status: "active" as const,
    models: [
      {
        modelId: "gemini-3.6-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 1,
      },
      {
        modelId: "glm-5.3-flash",
        providerId: "openrouter",
        providerName: "OpenRouter",
        priority: 2,
      },
      {
        modelId: "llama-3.3-70b-versatile",
        providerId: "groq",
        providerName: "Groq",
        priority: 3,
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    _id: "builtin_coding",
    name: "Coding & Reasoning",
    slug: "coding",
    description: "Specialized models tuned for software architecture, code generation, refactoring, and logical reasoning.",
    systemMessage: undefined,
    contextLength: 262144, // 256K
    strategy: "priority" as const,
    isBuiltin: true,
    status: "active" as const,
    models: [
      {
        modelId: "gemini-3.6-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 1,
      },
      {
        modelId: "deepseek-reasoner",
        providerId: "deepseek",
        providerName: "DeepSeek",
        priority: 2,
      },
      {
        modelId: "claude-3-7-sonnet",
        providerId: "anthropic",
        providerName: "Anthropic",
        priority: 3,
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^combo\//, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 1. List All Combos (System Defaults + User Custom Combos)
export const listCombos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const userCombos = userId
      ? await ctx.db
          .query("routerCombos")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .collect()
      : [];

    const formattedUserCombos = userCombos.map((c) => ({
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

    // System defaults first, then user combos
    return [...SYSTEM_DEFAULT_COMBOS, ...formattedUserCombos];
  },
});

// 2. Get a Specific Combo by ID or Slug
export const getCombo = query({
  args: {
    slug: v.optional(v.string()),
    id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanSlug = args.slug ? slugify(args.slug) : "";

    // Check system defaults
    const builtin = SYSTEM_DEFAULT_COMBOS.find(
      (b) => b.slug === cleanSlug || b._id === args.id
    );
    if (builtin) return builtin;

    const userId = await getAuthUserId(ctx);
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
    if (SYSTEM_DEFAULT_COMBOS.some((b) => b.slug === cleanSlug)) {
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

    // 1. Check system defaults
    const builtin = SYSTEM_DEFAULT_COMBOS.find((b) => b.slug === cleanSlug);
    if (builtin) {
      return {
        name: builtin.name,
        slug: builtin.slug,
        systemMessage: builtin.systemMessage,
        contextLength: builtin.contextLength,
        strategy: builtin.strategy,
        models: builtin.models,
        isBuiltin: true,
      };
    }

    // 2. Check user's custom combos
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
