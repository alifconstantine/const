import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const messageValidator = v.object({
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
  searchQuery: v.optional(v.string()),
  searchResults: v.optional(
    v.array(
      v.object({
        title: v.string(),
        url: v.string(),
        snippet: v.optional(v.string()),
      })
    )
  ),
  createdAt: v.number(),
});

// 1. List user's playground chat sessions
export const listChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const chats = await ctx.db
      .query("routerChats")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return chats.map((chat) => ({
      _id: chat._id,
      title: chat.title,
      modelId: chat.modelId,
      providerId: chat.providerId,
      systemInstruction: chat.systemInstruction,
      temperature: chat.temperature,
      thinkingLevel: chat.thinkingLevel,
      messageCount: chat.messages.length,
      lastMessageSnippet: chat.messages.length > 0 ? (chat.messages[chat.messages.length - 1]?.content.slice(0, 100) || "") : "",
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));
  },
});

// 2. Get full details of a specific chat session
export const getChat = query({
  args: {
    chatId: v.id("routerChats"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) {
      return null;
    }

    return chat;
  },
});

// 3. Create a new chat session
export const createChat = mutation({
  args: {
    title: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.string(),
    systemInstruction: v.optional(v.string()),
    temperature: v.number(),
    thinkingLevel: v.optional(v.string()),
    messages: v.optional(v.array(messageValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in.");
    }

    const now = Date.now();
    const defaultTitle = args.title?.trim() || "New Chat";

    const chatId = await ctx.db.insert("routerChats", {
      userId,
      title: defaultTitle,
      modelId: args.modelId,
      providerId: args.providerId,
      systemInstruction: args.systemInstruction,
      temperature: args.temperature,
      thinkingLevel: args.thinkingLevel,
      messages: args.messages || [],
      createdAt: now,
      updatedAt: now,
    });

    return { chatId };
  },
});

// 4. Update an existing chat session (messages, title, settings)
export const updateChat = mutation({
  args: {
    chatId: v.id("routerChats"),
    title: v.optional(v.string()),
    modelId: v.optional(v.string()),
    providerId: v.optional(v.string()),
    systemInstruction: v.optional(v.string()),
    temperature: v.optional(v.number()),
    thinkingLevel: v.optional(v.string()),
    messages: v.optional(v.array(messageValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in.");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found or access denied.");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title.trim();
    if (args.modelId !== undefined) updates.modelId = args.modelId;
    if (args.providerId !== undefined) updates.providerId = args.providerId;
    if (args.systemInstruction !== undefined) updates.systemInstruction = args.systemInstruction;
    if (args.temperature !== undefined) updates.temperature = args.temperature;
    if (args.thinkingLevel !== undefined) updates.thinkingLevel = args.thinkingLevel;
    if (args.messages !== undefined) updates.messages = args.messages;

    await ctx.db.patch(args.chatId, updates);
    return { success: true };
  },
});

// 5. Delete a chat session
export const deleteChat = mutation({
  args: {
    chatId: v.id("routerChats"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in.");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found or access denied.");
    }

    await ctx.db.delete(args.chatId);
    return { success: true };
  },
});
