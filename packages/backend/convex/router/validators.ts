import { v } from "convex/values";
export const chatAttachmentValidator = v.object({
  name: v.string(),
  type: v.string(),
  size: v.number(),
  url: v.optional(v.string()),
  dataUrl: v.optional(v.string()),
  fileId: v.optional(v.id("routerFiles")),
});
export const chatMessageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  content: v.string(),
  thinkingContent: v.optional(v.string()),
  attachments: v.optional(v.array(chatAttachmentValidator)),
  searchQuery: v.optional(v.string()),
  searchResults: v.optional(
    v.array(
      v.object({
        title: v.string(),
        url: v.string(),
        snippet: v.optional(v.string()),
      }),
    ),
  ),
  createdAt: v.number(),
});
