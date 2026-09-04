import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
      status: key.status,
      dailyLimitTokens: key.dailyLimitTokens,
      usedTodayTokens: key.usedTodayTokens,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));
  },
});

// 2. Create a new API key (returns rawKey ONCE for one-time reveal)
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

    const { rawKey, keyPrefix } = generateSecureKey();
    const keyHash = await hashKey(rawKey);

    const now = Date.now();
    const keyId = await ctx.db.insert("apiKeys", {
      userId,
      name: trimmedName,
      keyPrefix,
      keyHash,
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
