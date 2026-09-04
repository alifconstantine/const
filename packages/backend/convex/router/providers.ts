import { query, mutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { encryptApiKey, decryptApiKey, maskApiKey } from "./crypto";

const modelValidator = v.object({
  modelId: v.string(),
  name: v.string(),
  contextWindow: v.optional(v.string()),
  maxOutputTokens: v.optional(v.string()),
  inputTypes: v.optional(v.array(v.string())),
  outputTypes: v.optional(v.array(v.string())),
  capabilities: v.optional(v.array(v.string())),
  enabled: v.boolean(),
});

// 1. List all configured providers for current authenticated user
export const listUserProviders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const providers = await ctx.db
      .query("userProviders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Never leak keyCipher or keyIv to the frontend
    return providers.map((p) => ({
      _id: p._id,
      providerId: p.providerId,
      name: p.name,
      protocol: p.protocol,
      baseUrl: p.baseUrl,
      keyPrefix: p.keyPrefix,
      status: p.status,
      importedModels: p.importedModels,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },
});

// 2. Save or update a provider configuration (BYOK)
export const saveUserProvider = mutation({
  args: {
    providerId: v.string(),
    name: v.string(),
    protocol: v.union(
      v.literal("openai-compatible"),
      v.literal("anthropic"),
      v.literal("google-ai"),
      v.literal("custom")
    ),
    apiKey: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    importedModels: v.array(modelValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in to configure providers.");
    }

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Provider name cannot be empty.");
    }

    const now = Date.now();

    // Check if this provider already exists for the user
    const existing = await ctx.db
      .query("userProviders")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("providerId", args.providerId)
      )
      .unique();

    if (existing) {
      // If a new API key is provided, encrypt it; otherwise retain existing encrypted key
      let keyCipher = existing.keyCipher;
      let keyIv = existing.keyIv;
      let keyPrefix = existing.keyPrefix;

      if (args.apiKey && args.apiKey.trim()) {
        const trimmedKey = args.apiKey.trim();
        const encrypted = await encryptApiKey(trimmedKey);
        keyCipher = encrypted.cipher;
        keyIv = encrypted.iv;
        keyPrefix = maskApiKey(trimmedKey);
      }

      await ctx.db.patch(existing._id, {
        name: trimmedName,
        protocol: args.protocol,
        baseUrl: args.baseUrl?.trim() || undefined,
        keyCipher,
        keyIv,
        keyPrefix,
        status: "active",
        importedModels: args.importedModels,
        updatedAt: now,
      });

      return {
        providerDocId: existing._id,
        providerId: args.providerId,
        name: trimmedName,
        status: "active",
      };
    }

    // New provider configuration
    const rawKey = args.apiKey?.trim() || "";
    if (!rawKey && args.protocol !== "custom") {
      throw new Error("API Key is required to connect this provider.");
    }

    const encrypted = await encryptApiKey(rawKey || "no-key-required");
    const keyPrefix = rawKey ? maskApiKey(rawKey) : "No key required";

    const docId = await ctx.db.insert("userProviders", {
      userId,
      providerId: args.providerId,
      name: trimmedName,
      protocol: args.protocol,
      baseUrl: args.baseUrl?.trim() || undefined,
      keyCipher: encrypted.cipher,
      keyIv: encrypted.iv,
      keyPrefix,
      status: "active",
      importedModels: args.importedModels,
      createdAt: now,
      updatedAt: now,
    });

    return {
      providerDocId: docId,
      providerId: args.providerId,
      name: trimmedName,
      status: "active",
    };
  },
});

// 3. Toggle provider active / disabled status
export const toggleProviderStatus = mutation({
  args: {
    providerDocId: v.id("userProviders"),
    status: v.union(v.literal("active"), v.literal("disabled")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized.");
    }

    const provider = await ctx.db.get(args.providerDocId);
    if (!provider || provider.userId !== userId) {
      throw new Error("Provider not found or access denied.");
    }

    await ctx.db.patch(args.providerDocId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true, status: args.status };
  },
});

// 4. Delete a provider configuration
export const deleteUserProvider = mutation({
  args: {
    providerDocId: v.id("userProviders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized.");
    }

    const provider = await ctx.db.get(args.providerDocId);
    if (!provider || provider.userId !== userId) {
      throw new Error("Provider not found or access denied.");
    }

    await ctx.db.delete(args.providerDocId);
    return { success: true };
  },
});

// 5. Update active/disabled state for imported models
export const updateImportedModels = mutation({
  args: {
    providerDocId: v.id("userProviders"),
    importedModels: v.array(modelValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized.");
    }

    const provider = await ctx.db.get(args.providerDocId);
    if (!provider || provider.userId !== userId) {
      throw new Error("Provider not found or access denied.");
    }

    await ctx.db.patch(args.providerDocId, {
      importedModels: args.importedModels,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// 6. Internal query for the AI Gateway engine to fetch decrypted credentials safely
export const getDecryptedProviderKey = internalQuery({
  args: {
    providerDocId: v.id("userProviders"),
  },
  handler: async (ctx, args) => {
    const provider = await ctx.db.get(args.providerDocId);
    if (!provider || provider.status !== "active") {
      return null;
    }

    const decryptedKey = await decryptApiKey(provider.keyCipher, provider.keyIv);
    return {
      providerId: provider.providerId,
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      apiKey: decryptedKey,
      importedModels: provider.importedModels,
    };
  },
});

// 7. Safe authenticated query for server-side testing & proxy routing
export const getProviderCredentials = query({
  args: {
    providerDocId: v.optional(v.id("userProviders")),
    modelId: v.optional(v.string()),
    rawApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId = await getAuthUserId(ctx);

    // If no direct user session, allow authentication via valid Const API key (sk-const-live-xxxx)
    if (!userId && args.rawApiKey && args.rawApiKey.startsWith("sk-const-live-")) {
      const encoder = new TextEncoder();
      const data = encoder.encode(args.rawApiKey.trim());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const keyDoc = await ctx.db
        .query("apiKeys")
        .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
        .unique();

      if (keyDoc && keyDoc.status === "active") {
        userId = keyDoc.userId;
      }
    }

    if (!userId) {
      throw new Error("Unauthorized: Please sign in or provide a valid API key.");
    }

    let provider = null;
    if (args.providerDocId) {
      provider = await ctx.db.get(args.providerDocId);
    } else if (args.modelId) {
      // Find active provider that offers this model
      const userProviders = await ctx.db
        .query("userProviders")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      for (const p of userProviders) {
        if (p.status !== "active") continue;
        const found = p.importedModels?.find(
          (m) =>
            m.enabled &&
            (m.modelId === args.modelId ||
              `${p.providerId}/${m.modelId}` === args.modelId ||
              m.name === args.modelId)
        );
        if (found) {
          provider = p;
          break;
        }
      }
    }

    if (!provider || provider.userId !== userId) {
      throw new Error(
        args.modelId
          ? `No active provider found for model '${args.modelId}'. Please connect a provider in /providers.`
          : "Provider not found or unauthorized access."
      );
    }

    if (provider.status !== "active") {
      throw new Error(`Provider '${provider.name}' is currently disabled.`);
    }

    const decryptedKey = await decryptApiKey(provider.keyCipher, provider.keyIv);
    return {
      providerDocId: provider._id,
      providerId: provider.providerId,
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      apiKey: decryptedKey,
      importedModels: provider.importedModels,
    };
  },
});

// 8. Update configuration for a single model (contextWindow, maxOutputTokens, inputTypes, outputTypes)
export const updateSingleModel = mutation({
  args: {
    providerDocId: v.id("userProviders"),
    modelId: v.string(),
    contextWindow: v.optional(v.string()),
    maxOutputTokens: v.optional(v.string()),
    inputTypes: v.optional(v.array(v.string())),
    outputTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in.");
    }

    const provider = await ctx.db.get(args.providerDocId);
    if (!provider || provider.userId !== userId) {
      throw new Error("Provider not found or access denied.");
    }

    const updatedModels = provider.importedModels.map((m) => {
      if (m.modelId === args.modelId) {
        return {
          ...m,
          contextWindow: args.contextWindow ?? m.contextWindow,
          maxOutputTokens: args.maxOutputTokens ?? m.maxOutputTokens,
          inputTypes: args.inputTypes ?? m.inputTypes,
          outputTypes: args.outputTypes ?? m.outputTypes,
        };
      }
      return m;
    });

    await ctx.db.patch(args.providerDocId, {
      importedModels: updatedModels,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
