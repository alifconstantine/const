import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id, Doc } from "../_generated/dataModel";

export const DEFAULT_INITIAL_BALANCE = 1.0938; // Default demo balance matching UI

// Cryptographic hash for secure API key verification
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper to extract user ID from SSO token payload or API key
async function resolveUserId(
  ctx: any,
  rawApiKey?: string,
  ssoToken?: string
): Promise<Id<"users"> | null> {
  const sessionUserId = await getAuthUserId(ctx);
  if (sessionUserId) return sessionUserId;

  if (ssoToken) {
    try {
      const parts = ssoToken.split(".");
      const b64Part = parts[1];
      if (parts.length >= 2 && b64Part) {
        const base64 = b64Part.replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr =
          typeof atob === "function"
            ? atob(base64)
            : typeof Buffer !== "undefined"
            ? Buffer.from(base64, "base64").toString("utf-8")
            : null;
        if (jsonStr) {
          const payload = JSON.parse(jsonStr);
          const sub = payload.sub || payload.userId;
          if (typeof sub === "string" && sub) {
            const [subUserId] = sub.split("|");
            if (subUserId) {
              const userDoc = await ctx.db.get(subUserId as Id<"users">);
              if (userDoc) return userDoc._id;
            }
          }
        }
      }
    } catch {}
  }

  if (rawApiKey) {
    const keyHash = await hashKey(rawApiKey.trim());
    const apiKeyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q: any) => q.eq("keyHash", keyHash))
      .first();
    if (apiKeyDoc && apiKeyDoc.status === "active") {
      return apiKeyDoc.userId;
    }
  }

  return null;
}

/**
 * 1. Get current authenticated user's credit balance.
 * Returns existing credit record or creates initial state with default balance.
 */
export const getUserCredits = query({
  args: {
    rawApiKey: v.optional(v.string()),
    ssoToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await resolveUserId(ctx, args.rawApiKey, args.ssoToken);
    if (!userId) {
      return {
        balanceUsd: DEFAULT_INITIAL_BALANCE,
        totalDepositedUsd: DEFAULT_INITIAL_BALANCE,
        totalSpentUsd: 0,
        formattedBalance: `$${DEFAULT_INITIAL_BALANCE.toFixed(4)}`,
        isAuthenticated: false,
      };
    }

    const creditDoc = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!creditDoc) {
      return {
        balanceUsd: DEFAULT_INITIAL_BALANCE,
        totalDepositedUsd: DEFAULT_INITIAL_BALANCE,
        totalSpentUsd: 0,
        formattedBalance: `$${DEFAULT_INITIAL_BALANCE.toFixed(4)}`,
        isAuthenticated: true,
      };
    }

    return {
      balanceUsd: creditDoc.balanceUsd,
      totalDepositedUsd: creditDoc.totalDepositedUsd,
      totalSpentUsd: creditDoc.totalSpentUsd,
      formattedBalance: `$${creditDoc.balanceUsd.toFixed(4)}`,
      isAuthenticated: true,
    };
  },
});

/**
 * 2. Get list of credit transactions (deposits & deductions).
 */
export const getCreditTransactions = query({
  args: {
    rawApiKey: v.optional(v.string()),
    ssoToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await resolveUserId(ctx, args.rawApiKey, args.ssoToken);
    if (!userId) {
      // Return a sample transaction for unauthenticated demo
      return [
        {
          _id: "demo_init" as unknown as Id<"creditTransactions">,
          userId: "demo" as unknown as Id<"users">,
          type: "bonus" as const,
          amountUsd: DEFAULT_INITIAL_BALANCE,
          balanceAfterUsd: DEFAULT_INITIAL_BALANCE,
          paymentMethod: "Welcome Bonus",
          token: "USD",
          network: "System",
          status: "completed" as const,
          txHash: undefined as string | undefined,
          description: "Welcome sign-up credit grant",
          createdAt: Date.now() - 86400000,
        },
      ];
    }

    const limit = args.limit || 50;
    const txs = await ctx.db
      .query("creditTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    if (txs.length === 0) {
      return [
        {
          _id: "demo_init" as unknown as Id<"creditTransactions">,
          userId,
          type: "bonus" as const,
          amountUsd: DEFAULT_INITIAL_BALANCE,
          balanceAfterUsd: DEFAULT_INITIAL_BALANCE,
          paymentMethod: "Welcome Bonus",
          token: "USD",
          network: "System",
          status: "completed" as const,
          txHash: undefined as string | undefined,
          description: "Welcome sign-up credit grant",
          createdAt: Date.now() - 86400000,
        },
      ];
    }

    return txs;
  },
});

/**
 * 3. Create or simulate a deposit (USDT/USDC crypto or QRIS).
 */
export const createDeposit = mutation({
  args: {
    amountUsd: v.number(),
    paymentMethod: v.string(), // e.g. "USDT (Solana)", "QRIS (IDR)"
    token: v.optional(v.string()), // "USDT", "USDC", "IDR"
    network: v.optional(v.string()), // "Solana", "BNB Chain", "Polygon", "QRIS"
    txHash: v.optional(v.string()),
    description: v.optional(v.string()),
    ssoToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await resolveUserId(ctx, undefined, args.ssoToken);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in to make a deposit.");
    }

    if (args.amountUsd <= 0) {
      throw new Error("Invalid deposit amount.");
    }

    const now = Date.now();
    let creditDoc = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    let newBalance = args.amountUsd;
    let totalDeposited = args.amountUsd;

    if (!creditDoc) {
      newBalance = DEFAULT_INITIAL_BALANCE + args.amountUsd;
      totalDeposited = DEFAULT_INITIAL_BALANCE + args.amountUsd;
      await ctx.db.insert("userCredits", {
        userId,
        balanceUsd: newBalance,
        totalDepositedUsd: totalDeposited,
        totalSpentUsd: 0,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      newBalance = creditDoc.balanceUsd + args.amountUsd;
      totalDeposited = creditDoc.totalDepositedUsd + args.amountUsd;
      await ctx.db.patch(creditDoc._id, {
        balanceUsd: newBalance,
        totalDepositedUsd: totalDeposited,
        updatedAt: now,
      });
    }

    const txId = await ctx.db.insert("creditTransactions", {
      userId,
      type: "deposit",
      amountUsd: args.amountUsd,
      balanceAfterUsd: newBalance,
      paymentMethod: args.paymentMethod,
      token: args.token,
      network: args.network,
      status: "completed",
      txHash: args.txHash || `tx_${Math.random().toString(36).substring(2, 10)}`,
      description: args.description || `Deposit via ${args.paymentMethod}`,
      createdAt: now,
    });

    return {
      success: true,
      transactionId: txId,
      newBalanceUsd: newBalance,
      formattedBalance: `$${newBalance.toFixed(4)}`,
    };
  },
});

/**
 * 4. Deduct credit for an API request execution.
 */
export const deductCredits = mutation({
  args: {
    userId: v.id("users"),
    costUsd: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.costUsd <= 0) return { success: true };

    const creditDoc = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    let currentBalance = creditDoc ? creditDoc.balanceUsd : DEFAULT_INITIAL_BALANCE;

    if (currentBalance < args.costUsd) {
      return {
        success: false,
        error: "Insufficient credit balance. Please deposit funds.",
        currentBalance,
      };
    }

    const newBalance = Math.max(0, currentBalance - args.costUsd);
    const newSpent = (creditDoc?.totalSpentUsd || 0) + args.costUsd;

    if (!creditDoc) {
      await ctx.db.insert("userCredits", {
        userId: args.userId,
        balanceUsd: newBalance,
        totalDepositedUsd: DEFAULT_INITIAL_BALANCE,
        totalSpentUsd: newSpent,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(creditDoc._id, {
        balanceUsd: newBalance,
        totalSpentUsd: newSpent,
        updatedAt: now,
      });
    }

    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      type: "deduction",
      amountUsd: args.costUsd,
      balanceAfterUsd: newBalance,
      paymentMethod: "API Gateway",
      status: "completed",
      description: args.description,
      createdAt: now,
    });

    return {
      success: true,
      newBalance,
    };
  },
});
