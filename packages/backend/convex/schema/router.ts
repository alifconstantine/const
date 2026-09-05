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

  // 4. Request Logs & Real-Time Telemetry Audit Trails
  routerLogs: defineTable({
    userId: v.id("users"),
    requestId: v.string(), // "req_" + unique id
    apiKeyId: v.optional(v.id("apiKeys")),
    keyName: v.optional(v.string()), // e.g. "Production Key", "Default Key", or "Playground"
    keyPrefix: v.optional(v.string()), // "sk-const-live-...3b63"
    model: v.string(),
    provider: v.string(),
    comboId: v.optional(v.string()), // for future combo engine
    comboName: v.optional(v.string()),
    status: v.number(), // HTTP status: 200, 400, 429, 500, etc.
    errorMessage: v.optional(v.string()),
    promptTokens: v.number(),
    cachedTokens: v.optional(v.number()),
    completionTokens: v.number(),
    totalTokens: v.number(),
    ttftMs: v.optional(v.number()), // Time to first token in ms
    durationMs: v.number(),          // Total execution duration in ms
    tokensPerSecond: v.optional(v.number()), // Speed in tok/s
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_model", ["userId", "model"])
    .index("by_request_id", ["requestId"]),

  // 5. Virtual Combos (Model Chains, Dynamic Fallbacks & Load Balancing)
  routerCombos: defineTable({
    userId: v.id("users"),
    name: v.string(), // e.g. "My Coding Combo", callers use "combo/my-coding-combo" or "my-coding-combo"
    slug: v.string(), // slugified e.g. "my-coding-combo"
    description: v.optional(v.string()),
    systemMessage: v.optional(v.string()),
    contextLength: v.number(), // default 262144 (256K)
    strategy: v.union(
      v.literal("priority"),
      v.literal("round-robin"),
      v.literal("random")
    ),
    models: v.array(
      v.object({
        modelId: v.string(),
        providerId: v.string(),
        providerName: v.string(),
        priority: v.number(), // 1 for primary, 2 for fallback, etc.
        weight: v.optional(v.number()),
      })
    ),
    status: v.union(v.literal("active"), v.literal("disabled")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"]),

  // 6. User Weekly Free Token Quotas (7M tokens/week for Const-managed models)
  userQuotas: defineTable({
    userId: v.id("users"),
    weeklyLimitTokens: v.number(),  // Default 7_000_000 (7M)
    usedTokens: v.number(),         // Accumulated input + output tokens this cycle
    periodStartAt: v.number(),      // Cycle start timestamp (ms)
    periodEndAt: v.number(),        // Cycle reset timestamp (ms) (periodStartAt + 7 * 24 * 60 * 60 * 1000)
    lastDeductedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
};


