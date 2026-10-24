import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { keyUsageToday, dayStart } from "./access";

// Cryptographic hash for secure API key verification
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate high-entropy 256-bit random API key with sk-const-live- prefix
function generateSecureKey(): { rawKey: string; keyPrefix: string } {
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `sk-const-live-${randomHex}`;
  const keyPrefix = `sk-const-live-...${rawKey.slice(-4)}`;
  return { rawKey, keyPrefix };
}

// 1. List API keys for the current authenticated user (never leaks hash)
export const listKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      rawKey: undefined,
      status: key.status,
      dailyLimitTokens: key.dailyLimitTokens,
      usedTodayTokens: keyUsageToday(key),
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));
  },
});

// 2. Create a new API key (returns rawKey ONCE for one-time reveal, and stores for user management)
export const createKey = mutation({
  args: {
    name: v.string(),
    dailyLimitTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in to create an API key.");
    }

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Key name cannot be empty.");
    }

    if (args.dailyLimitTokens !== undefined) {
      if (
        !Number.isInteger(args.dailyLimitTokens) ||
        args.dailyLimitTokens <= 0
      ) {
        throw new Error("Daily token limit must be a positive integer.");
      }
    }

    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (existingKeys.length >= 25) {
      throw new Error(
        "Quota exceeded: You can only have up to 25 API keys. Please delete an unused key first.",
      );
    }

    const { rawKey, keyPrefix } = generateSecureKey();
    const keyHash = await hashKey(rawKey);

    const now = Date.now();
    const keyId = await ctx.db.insert("apiKeys", {
      userId,
      name: trimmedName,
      keyPrefix,
      keyHash,
      dailyPeriodStartAt: dayStart(),
      dailyLimitTokens: args.dailyLimitTokens,
      usedTodayTokens: 0,
      status: "active",
      createdAt: now,
    });

    return {
      keyId,
      rawKey,
      name: trimmedName,
      keyPrefix,
    };
  },
});

// 3. Revoke an API key (immediately blocks further gateway requests)
export const revokeKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized.");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) {
      throw new Error("API Key not found or access denied.");
    }

    await ctx.db.patch(args.keyId, {
      status: "revoked",
    });

    return { success: true };
  },
});

// 4. Delete an API key permanently
export const deleteKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized.");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) {
      throw new Error("API Key not found or access denied.");
    }

    await ctx.db.delete(args.keyId);

    return { success: true };
  },
});

// 5. Verify an API key for gateway routing (fast SHA-256 hash lookup)
export const verifyApiKey = query({
  args: {
    rawKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rawKey = args.rawKey.trim();
    if (!rawKey.startsWith("sk-const-live-")) {
      return { valid: false, reason: "Invalid key format" as const };
    }

    const keyHash = await hashKey(rawKey);
    const keyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .unique();

    if (!keyDoc) {
      return { valid: false, reason: "Key not found" as const };
    }

    if (keyDoc.status !== "active") {
      return { valid: false, reason: "Key revoked" as const };
    }

    if (
      keyDoc.dailyLimitTokens &&
      keyUsageToday(keyDoc) >= keyDoc.dailyLimitTokens
    ) {
      return {
        valid: false,
        reason: "Daily token limit exceeded" as const,
        dailyLimitTokens: keyDoc.dailyLimitTokens,
        usedTodayTokens: keyUsageToday(keyDoc),
      };
    }

    return {
      valid: true,
      keyId: keyDoc._id,
      userId: keyDoc.userId,
      name: keyDoc.name,
      keyPrefix: keyDoc.keyPrefix,
      dailyLimitTokens: keyDoc.dailyLimitTokens,
      usedTodayTokens: keyUsageToday(keyDoc),
    };
  },
});

export const removeStoredSecrets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const page = await ctx.db
      .query("apiKeys")
      .filter((q) => q.neq(q.field("rawKey"), undefined))
      .take(100);
    for (const key of page) await ctx.db.patch(key._id, { rawKey: undefined });
    return { updated: page.length };
  },
});
