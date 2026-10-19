import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Reserved System Built-in Slugs
export const SYSTEM_DEFAULT_SLUGS = ["auto", "fast", "coding"] as const;

// Fallback base model definition
export const SYSTEM_DEFAULT_COMBOS = [
  {
    _id: "builtin_auto",
    name: "combo/auto",
    slug: "auto",
    description: "Intelligently balances accuracy, reasoning depth, and latency with multi-model failover.",
    systemMessage: undefined,
    contextLength: 272000,
    strategy: "priority" as const,
    isBuiltin: true,
    status: "active" as const,
    models: [
      {
        modelId: "gpt-6-luna",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 1,
      },
      {
        modelId: "deepseek-v4.1-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 2,
      },
      {
        modelId: "gemini-3.8-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 3,
      },
      {
        modelId: "qwen-3.8-omni-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 4,
      },
      {
        modelId: "glm-5.3-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 5,
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    _id: "builtin_fast",
    name: "combo/fast",
    slug: "fast",
    description: "Sub-second time-to-first-token and ultra-high throughput for instant conversational feedback.",
    systemMessage: undefined,
    contextLength: 272000,
    strategy: "priority" as const,
    isBuiltin: true,
    status: "active" as const,
    models: [
      {
        modelId: "gpt-6-luna",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 1,
      },
      {
        modelId: "gemini-3.8-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 2,
      },
      {
        modelId: "deepseek-v4.1-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 3,
      },
      {
        modelId: "glm-5.3-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 4,
      },
      {
        modelId: "qwen-3.8-omni-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 5,
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    _id: "builtin_coding",
    name: "combo/coding",
    slug: "coding",
    description: "Specialized models tuned for software architecture, code generation, refactoring, and logical reasoning.",
    systemMessage: undefined,
    contextLength: 1000000,
    strategy: "priority" as const,
    isBuiltin: true,
    status: "active" as const,
    models: [
      {
        modelId: "glm-5.3-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 1,
      },
      {
        modelId: "gemini-3.8-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 2,
      },
      {
        modelId: "deepseek-v4.1-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 3,
      },
      {
        modelId: "qwen-3.8-omni-flash",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 4,
      },
      {
        modelId: "gpt-6-luna",
        providerId: "const",
        providerName: "Const Gateway",
        priority: 5,
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

// Dynamically generate default combos based ONLY on real models available to the user
export async function getDynamicDefaultCombos(ctx: any, userId?: string | null) {
  // 1. Const Gateway managed models are ALWAYS available (Gemini 3.8 Flash is priority 1)
  const availablePool: Array<{
    modelId: string;
    providerId: string;
    providerName: string;
  }> = [
    {
      modelId: "gemini-3.8-flash",
      providerId: "const",
      providerName: "Const Gateway",
    },
    {
      modelId: "gemini-3.7-flash",
      providerId: "const",
      providerName: "Const Gateway",
    },
    {
      modelId: "qwen-3.8-27b",
      providerId: "const",
      providerName: "Const Gateway",
    },
  ];

  // 2. Fetch active BYOK models configured by this user
  if (userId) {
    const userProviders = await ctx.db
      .query("userProviders")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();

    for (const p of userProviders) {
      if (p.status !== "active") continue;
      const enabled = (p.importedModels || []).filter((m: any) => m.enabled);
      for (const m of enabled) {
        if (!availablePool.some((x) => x.modelId === m.modelId && x.providerId === p.providerId)) {
          availablePool.push({
            modelId: m.modelId,
            providerId: p.providerId,
            providerName: p.name || p.providerId,
          });
        }
      }
    }
  }

  const assignPriorities = (models: Array<{ modelId: string; providerId: string; providerName: string }>) =>
    models.map((m, idx) => ({ ...m, priority: idx + 1 }));

  // AUTO: All available models with Gemini 3.8 Flash first, then 3.7, 3.6, and connected BYOKs
  const autoModels = assignPriorities(availablePool);

  // FAST: Prioritize fast / flash / low-latency models, with Gemini 3.8 Flash as top tier
  const fastSorted = [...availablePool].sort((a, b) => {
    const is38A = a.modelId === "gemini-3.8-flash";
    const is38B = b.modelId === "gemini-3.8-flash";
    if (is38A && !is38B) return -1;
    if (!is38A && is38B) return 1;

    const isFastA = /(?:flash|mini|instant|8b|groq|turbo|haiku|speed|small)/i.test(a.modelId);
    const isFastB = /(?:flash|mini|instant|8b|groq|turbo|haiku|speed|small)/i.test(b.modelId);
    if (isFastA && !isFastB) return -1;
    if (!isFastA && isFastB) return 1;
    return 0;
  });
  const fastModels = assignPriorities(fastSorted);

  // CODING: Prioritize coding / high-reasoning models (gemini-3.8-flash, deepseek, sonnet, etc.)
  const codingSorted = [...availablePool].sort((a, b) => {
    const is38A = a.modelId === "gemini-3.8-flash";
    const is38B = b.modelId === "gemini-3.8-flash";
    if (is38A && !is38B) return -1;
    if (!is38A && is38B) return 1;

    const isCodeA = /(?:3\.8|code|coder|deepseek|reasoner|sonnet|opus|claude|gpt-4|pro|qwen)/i.test(a.modelId);
    const isCodeB = /(?:3\.8|code|coder|deepseek|reasoner|sonnet|opus|claude|gpt-4|pro|qwen)/i.test(b.modelId);
    if (isCodeA && !isCodeB) return -1;
    if (!isCodeA && isCodeB) return 1;
    return 0;
  });
  const codingModels = assignPriorities(codingSorted);

  return [
    {
      _id: "builtin_auto",
      name: "combo/auto",
      slug: "auto",
      description: "Intelligently balances accuracy, reasoning depth, and latency with multi-model failover.",
      systemMessage: undefined,
      contextLength: 1000000, // 1M
      strategy: "priority" as const,
      isBuiltin: true,
      status: "active" as const,
      models: autoModels,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    {
      _id: "builtin_fast",
      name: "combo/fast",
      slug: "fast",
      description: "Sub-second time-to-first-token and ultra-high throughput for instant conversational feedback.",
      systemMessage: undefined,
      contextLength: 1000000, // 1M
      strategy: "priority" as const,
      isBuiltin: true,
      status: "active" as const,
      models: fastModels,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    {
      _id: "builtin_coding",
      name: "combo/coding",
      slug: "coding",
      description: "Specialized models tuned for software architecture, code generation, refactoring, and logical reasoning.",
      systemMessage: undefined,
      contextLength: 1000000, // 1M
      strategy: "priority" as const,
      isBuiltin: true,
      status: "active" as const,
      models: codingModels,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^combo\//, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 1. List All Combos (Dynamic Defaults with real available models only + User Custom Combos)
export const listCombos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const defaultCombos = await getDynamicDefaultCombos(ctx, userId);

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

    // Dynamic system defaults first, then user custom combos
    return [...defaultCombos, ...formattedUserCombos];
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

    // Check system defaults dynamically (includes user's connected BYOKs if userId resolved)
    const defaultCombos = await getDynamicDefaultCombos(ctx, userId);
    const builtin = defaultCombos.find(
      (b) => b.slug === cleanSlug || b._id === args.id
    );
    if (builtin) return builtin;

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

    // 1. Check dynamic system defaults
    if (SYSTEM_DEFAULT_SLUGS.includes(cleanSlug as any)) {
      const defaultCombos = await getDynamicDefaultCombos(ctx, userId);
      const builtin = defaultCombos.find((b) => b.slug === cleanSlug);
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
