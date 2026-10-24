import { query, mutation } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { resolveIdentity } from "./access";
import { chatMessageValidator as messageValidator } from "./validators";
const config = {
  title: v.optional(v.string()),
  modelId: v.string(),
  providerId: v.string(),
  systemInstruction: v.optional(v.string()),
  temperature: v.number(),
  thinkingLevel: v.optional(v.string()),
};
function validateMessages(messages: any[]) {
  if (
    messages.length > 500 ||
    new TextEncoder().encode(JSON.stringify(messages)).length > 3_000_000
  )
    throw new Error("Chat is full. Start a new chat.");
  for (const m of messages) {
    if (m.content.length + (m.thinkingContent?.length ?? 0) > 180000)
      throw new Error("Message is too large to save.");
    if (m.attachments?.some((a: any) => !a.fileId || a.dataUrl))
      throw new Error("Upload attachments to file storage before saving.");
  }
}
export const listChats = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx);
    const result = await ctx.db
      .query("routerChats")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(30, args.paginationOpts.numItems),
      });
    return {
      ...result,
      page: result.page.map(({ messages, ...chat }) => ({
        ...chat,
        messageCount: chat.messageCount ?? messages.length,
        lastMessageSnippet:
          chat.lastMessageSnippet ??
          messages.at(-1)?.content.slice(0, 100) ??
          "",
      })),
    };
  },
});
export const getChat = query({
  args: { chatId: v.id("routerChats") },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx),
      chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) return null;
    const rows = await ctx.db
      .query("routerMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .take(501);
    const messages = rows.length ? rows.map((r) => r.message) : chat.messages;
    const resolved = await Promise.all(
      messages.map(async (m: any) => ({
        ...m,
        attachments: m.attachments
          ? await Promise.all(
              m.attachments.map(async (a: any) => {
                if (!a.fileId) return a;
                const file = await ctx.db.get(a.fileId);
                return file && "storageId" in file && file.userId === userId
                  ? { ...a, url: await ctx.storage.getUrl(file.storageId) }
                  : { ...a, url: undefined };
              }),
            )
          : undefined,
      })),
    );
    return { ...chat, messages: resolved, revision: chat.revision ?? 0 };
  },
});
export const createChat = mutation({
  args: { ...config, messages: v.optional(v.array(messageValidator)) },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx),
      messages = args.messages ?? [];
    validateMessages(messages);
    for (const m of messages)
      for (const a of m.attachments ?? []) {
        const file = a.fileId ? await ctx.db.get(a.fileId) : null;
        if (!file || file.userId !== userId)
          throw new Error("Attachment access denied");
      }
    const now = Date.now();
    const id = await ctx.db.insert("routerChats", {
      ...args,
      userId,
      title: args.title?.trim().slice(0, 100) || "New chat",
      messages: [],
      messageCount: messages.length,
      lastMessageSnippet: messages.at(-1)?.content.slice(0, 100) ?? "",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    for (let position = 0; position < messages.length; position++)
      await ctx.db.insert("routerMessages", {
        chatId: id,
        userId,
        position,
        message: messages[position]!,
      });
    return { chatId: id, revision: 1 };
  },
});
export const updateChat = mutation({
  args: {
    chatId: v.id("routerChats"),
    expectedRevision: v.optional(v.number()),
    title: v.optional(v.string()),
    modelId: v.optional(v.string()),
    providerId: v.optional(v.string()),
    systemInstruction: v.optional(v.string()),
    temperature: v.optional(v.number()),
    thinkingLevel: v.optional(v.string()),
    messages: v.optional(v.array(messageValidator)),
  },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx),
      chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) throw new Error("Chat not found");
    const { chatId, messages, expectedRevision, ...changes } = args;
    const revision = chat.revision ?? 0;
    if (messages) {
      if (expectedRevision !== revision)
        throw new Error(
          "This chat changed in another tab. Reload before saving.",
        );
      validateMessages(messages);
      const rows = await ctx.db
        .query("routerMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chatId))
        .collect();
      const byId = new Map(rows.map((r) => [(r.message as any).id, r]));
      for (let position = 0; position < messages.length; position++) {
        const m = messages[position]!;
        for (const a of m.attachments ?? []) {
          const file = a.fileId ? await ctx.db.get(a.fileId) : null;
          if (!file || file.userId !== userId)
            throw new Error("Attachment access denied");
        }
        const old = byId.get(m.id);
        if (old) {
          byId.delete(m.id);
          if (
            JSON.stringify(old.message) !== JSON.stringify(m) ||
            old.position !== position
          )
            await ctx.db.patch(old._id, { message: m, position });
        } else
          await ctx.db.insert("routerMessages", {
            chatId,
            userId,
            position,
            message: m,
          });
      }
      for (const row of byId.values()) await ctx.db.delete(row._id);
      await ctx.db.patch(chatId, {
        messages: [],
        messageCount: messages.length,
        lastMessageSnippet: messages.at(-1)?.content.slice(0, 100) ?? "",
        revision: revision + 1,
      });
    }
    const safeChanges = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(chatId, { ...safeChanges, updatedAt: Date.now() });
    return { success: true, revision: messages ? revision + 1 : revision };
  },
});
export const deleteChat = mutation({
  args: { chatId: v.id("routerChats") },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx),
      chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) throw new Error("Chat not found");
    const rows = await ctx.db
      .query("routerMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.delete(chat._id);
  },
});
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await resolveIdentity(ctx);
    return ctx.storage.generateUploadUrl();
  },
});
export const registerFile = mutation({
  args: { storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx),
      metadata = await ctx.db.system.get(args.storageId);
    const existing = await ctx.db
      .query("routerFiles")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      if (existing.userId !== userId)
        throw new Error("Attachment access denied");
      return {
        fileId: existing._id,
        url: await ctx.storage.getUrl(existing.storageId),
        type: existing.type,
        size: existing.size,
      };
    }
    const image = ["image/png", "image/jpeg", "image/webp"].includes(
      metadata?.contentType ?? "",
    );
    const text = [
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
    ].includes(metadata?.contentType ?? "");
    if (
      !metadata ||
      (!image && !text) ||
      metadata.size > (image ? 5 * 1024 * 1024 : 512 * 1024)
    ) {
      throw new Error("Use images up to 5 MB or text files up to 512 KB.");
    }
    const id = await ctx.db.insert("routerFiles", {
      userId,
      storageId: args.storageId,
      name: args.name.slice(0, 200),
      type: metadata.contentType!,
      size: metadata.size,
      createdAt: Date.now(),
    });
    return {
      fileId: id,
      url: await ctx.storage.getUrl(args.storageId),
      type: metadata.contentType!,
      size: metadata.size,
    };
  },
});
export const resolveFiles = query({
  args: {
    ids: v.array(v.id("routerFiles")),
    rawApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx, args.rawApiKey);
    if (args.ids.length > 100) throw new Error("Too many attachments");
    return Promise.all(
      args.ids.map(async (id) => {
        const file = await ctx.db.get(id);
        if (!file || file.userId !== userId)
          throw new Error("Attachment access denied");
        return {
          id,
          url: await ctx.storage.getUrl(file.storageId),
          type: file.type,
          name: file.name,
        };
      }),
    );
  },
});
