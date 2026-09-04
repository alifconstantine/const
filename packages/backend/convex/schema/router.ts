import { defineTable } from "convex/server";
import { v } from "convex/values";

export const routerTables = {
  // 1. User API Keys to access Const Router AI Gateway (sk-const-live-xxxx)
  apiKeys: defineTable({
    userId: v.id("users"),
    name: v.string(),
    keyPrefix: v.string(), // e.g. "sk-const-live-...d2e4"
    keyHash: v.string(),   // SHA-256 hash for safe, high-speed lookup
    dailyLimitTokens: v.optional(v.number()),
    usedTodayTokens: v.number(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_key_hash", ["keyHash"]),

  // 2. User-configured external AI providers (BYOK & Custom Endpoints)
  userProviders: defineTable({
    userId: v.id("users"),
    providerId: v.string(), // e.g. "openai", "anthropic", "deepseek", "google", "groq", or "custom-xxx"
    name: v.string(),
    protocol: v.union(
      v.literal("openai-compatible"),
      v.literal("anthropic"),
      v.literal("google-ai"),
      v.literal("custom")
    ),
    baseUrl: v.optional(v.string()),
    keyCipher: v.string(), // AES-256-GCM ciphertext in hex
    keyIv: v.string(),     // 12-byte IV in hex
    keyPrefix: v.string(), // Masked key for display e.g. "sk-proj-...8a1f"
    status: v.union(v.literal("active"), v.literal("disabled"), v.literal("error")),
    importedModels: v.array(
      v.object({
        modelId: v.string(),
        name: v.string(),
        contextWindow: v.optional(v.string()),
        maxOutputTokens: v.optional(v.string()),
        inputTypes: v.optional(v.array(v.string())),
        outputTypes: v.optional(v.array(v.string())),
        capabilities: v.optional(v.array(v.string())),
        enabled: v.boolean(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "providerId"]),

  // 3. Playground Generation Chat Sessions & History
  routerChats: defineTable({
    userId: v.id("users"),
    title: v.string(),
    modelId: v.string(),
    providerId: v.string(),
    systemInstruction: v.optional(v.string()),
    temperature: v.number(),
    thinkingLevel: v.optional(v.string()),
    messages: v.array(
      v.object({
        id: v.string(),
        role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
        content: v.string(),
        thinkingContent: v.optional(v.string()),
        attachments: v.optional(
          v.array(
            v.object({
              name: v.string(),
              type: v.string(),
              size: v.number(),
              url: v.optional(v.string()),
              dataUrl: v.optional(v.string()),
            })
          )
        ),
        createdAt: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),
};
