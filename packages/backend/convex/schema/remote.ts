import { defineTable } from "convex/server";
import { v } from "convex/values";

export const remoteTables = {
  remoteSessions: defineTable({
    ownerId: v.id("users"),
    deviceName: v.string(),
    hostHash: v.string(),
    pairHash: v.string(),
    pairExpiresAt: v.number(),
    expiresAt: v.number(),
    heartbeatAt: v.number(),
    revoked: v.boolean(),
    revision: v.number(),
    rateWindow: v.optional(v.number()),
    rateCount: v.optional(v.number()),
    pairingCode: v.optional(v.string()),
    encryptedSecret: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_pairing_code", ["pairingCode"]),
  remoteDevices: defineTable({
    sessionId: v.id("remoteSessions"),
    secretHash: v.string(),
    name: v.string(),
    revoked: v.boolean(),
    seenAt: v.number(),
  }).index("by_session", ["sessionId"]),
  remoteCommands: defineTable({
    sessionId: v.id("remoteSessions"),
    deviceId: v.id("remoteDevices"),
    requestId: v.string(),
    packet: v.string(),
    state: v.union(
      v.literal("queued"),
      v.literal("claimed"),
      v.literal("done"),
      v.literal("uploading"),
    ),
    chunkCount: v.optional(v.number()),
    uploadedChunks: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    response: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_state", ["sessionId", "state"])
    .index("by_device", ["deviceId", "createdAt"])
    .index("by_device_completed", ["deviceId", "state", "completedAt"])
    .index("by_request", ["deviceId", "requestId"]),
  remoteEvents: defineTable({
    sessionId: v.id("remoteSessions"),
    revision: v.number(),
    packet: v.string(),
  }).index("by_session", ["sessionId", "revision"]),
  remoteChunks: defineTable({
    sessionId: v.id("remoteSessions"),
    commandId: v.id("remoteCommands"),
    direction: v.union(v.literal("command"), v.literal("response")),
    index: v.number(),
    packet: v.string(),
  })
    .index("by_session", ["sessionId"])
    .index("by_part", ["commandId", "direction", "index"]),
};
