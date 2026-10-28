import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";

const sessionId = v.id("remoteSessions");
const deviceId = v.id("remoteDevices");
const hostArgs = { sessionId, hostHash: v.string() };
const deviceArgs = { sessionId, deviceId, secretHash: v.string() };
type Ctx = MutationCtx | QueryCtx;
async function session(ctx: Ctx, id: Id<"remoteSessions">) {
  const owner = await getAuthUserId(ctx);
  const row = await ctx.db.get(id);
  if (!owner || !row || row.ownerId !== owner)
    throw new ConvexError({ code: "REMOTE_UNAUTHORIZED" });
  if (row.revoked || row.expiresAt <= Date.now())
    throw new ConvexError({ code: "REMOTE_SESSION_EXPIRED" });
  return row;
}
async function host(
  ctx: Ctx,
  args: { sessionId: Id<"remoteSessions">; hostHash: string },
) {
  const row = await session(ctx, args.sessionId);
  if (row.hostHash !== args.hostHash)
    throw new ConvexError({ code: "REMOTE_UNAUTHORIZED" });
  return row;
}
async function device(
  ctx: Ctx,
  args: {
    sessionId: Id<"remoteSessions">;
    deviceId: Id<"remoteDevices">;
    secretHash: string;
  },
) {
  const row = await session(ctx, args.sessionId);
  const client = await ctx.db.get(args.deviceId);
  if (
    !client ||
    client.sessionId !== args.sessionId ||
    client.secretHash !== args.secretHash
  )
    throw new ConvexError({ code: "REMOTE_UNAUTHORIZED" });
  if (client.revoked) throw new ConvexError({ code: "REMOTE_DEVICE_REVOKED" });
  return row;
}
function packet(value: string) {
  if (!value || value.length > 700_000)
    throw new ConvexError({ code: "REMOTE_PACKET_LIMIT" });
}

export const create = mutation({
  args: { deviceName: v.string(), hostHash: v.string(), pairHash: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (
      !ownerId ||
      args.deviceName.length > 100 ||
      args.hostHash.length !== 43 ||
      args.pairHash.length !== 43
    )
      throw new ConvexError({ code: "REMOTE_UNAUTHORIZED" });
    const previous = await ctx.db
      .query("remoteSessions")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    for (const stale of previous.filter(
      (row) => !row.revoked && Date.now() - row.heartbeatAt > 90_000,
    )) {
      await ctx.db.patch(stale._id, { revoked: true });
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation", { sessionId: Id<"remoteSessions"> }>(
          "remote:cleanup",
        ),
        { sessionId: stale._id },
      );
    }
    if (
      previous.filter(
        (row) =>
          !row.revoked &&
          row.expiresAt > Date.now() &&
          Date.now() - row.heartbeatAt <= 90_000,
      ).length >= 4
    )
      throw new ConvexError({ code: "REMOTE_SESSION_LIMIT" });
    const id = await ctx.db.insert("remoteSessions", {
      ...args,
      ownerId,
      pairExpiresAt: Date.now() + 15 * 60_000,
      expiresAt: Date.now() + 8 * 60 * 60_000,
      heartbeatAt: Date.now(),
      revoked: false,
      revision: 0,
    });
    await ctx.scheduler.runAfter(
      8 * 60 * 60_000,
      makeFunctionReference<"mutation", { sessionId: Id<"remoteSessions"> }>(
        "remote:cleanup",
      ),
      { sessionId: id },
    );
    return id;
  },
});
export const join = mutation({
  args: {
    sessionId,
    pairHash: v.string(),
    secretHash: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await session(ctx, args.sessionId);
    if (
      row.pairHash !== args.pairHash ||
      row.pairExpiresAt <= Date.now() ||
      args.secretHash.length !== 43 ||
      args.name.length > 100
    )
      throw new ConvexError({ code: "REMOTE_PAIRING_EXPIRED" });
    const clients = await ctx.db
      .query("remoteDevices")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existing = clients.find(
      (client) => client.secretHash === args.secretHash && !client.revoked,
    );
    if (existing) return existing._id;
    if (clients.filter((client) => !client.revoked).length >= 4)
      throw new ConvexError({ code: "REMOTE_DEVICE_LIMIT" });
    return ctx.db.insert("remoteDevices", {
      sessionId: args.sessionId,
      name: args.name,
      secretHash: args.secretHash,
      revoked: false,
      seenAt: Date.now(),
    });
  },
});
export const hostInbox = query({
  args: hostArgs,
  handler: async (ctx, args) => {
    await host(ctx, args);
    const commands = await ctx.db
      .query("remoteCommands")
      .withIndex("by_session_state", (q) =>
        q
          .eq("sessionId", args.sessionId)
          .eq("state", "queued")
          .gt("_creationTime", Date.now() - 60_000),
      )
      .order("asc")
      .take(20);
    const devices = await ctx.db
      .query("remoteDevices")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return {
      commands: commands
        .filter(
          (command) =>
            command.state === "queued" &&
            command.createdAt > Date.now() - 60_000 &&
            devices.some((d) => d._id === command.deviceId && !d.revoked),
        )
        .slice(0, 20),
      devices: devices
        .filter((d) => !d.revoked && Date.now() - d.seenAt < 45_000)
        .map((d) => ({
          id: d._id,
          name: d.name,
          connectedAt: d._creationTime,
        })),
    };
  },
});
export const deviceFeed = query({
  args: deviceArgs,
  handler: async (ctx, args) => {
    const row = await device(ctx, args);
    const events = await ctx.db
      .query("remoteEvents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(40);
    const responses = await ctx.db
      .query("remoteCommands")
      .withIndex("by_device_completed", (q) =>
        q.eq("deviceId", args.deviceId).eq("state", "done"),
      )
      .order("desc")
      .take(16);
    return {
      deviceName: row.deviceName,
      heartbeatAt: row.heartbeatAt,
      revision: row.revision,
      events: events.reverse(),
      responses: responses
        .filter(
          (command) => command.deviceId === args.deviceId && command.response,
        )
        .map((command) => ({
          requestId: command.requestId,
          response: command.response,
        })),
    };
  },
});
export const submit = mutation({
  args: {
    ...deviceArgs,
    requestId: v.string(),
    packet: v.string(),
    chunkCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const row = await device(ctx, args);
    packet(args.packet);
    if (
      args.chunkCount !== undefined &&
      (!Number.isInteger(args.chunkCount) ||
        args.chunkCount < 1 ||
        args.chunkCount > 192)
    )
      throw new ConvexError({ code: "REMOTE_PACKET_LIMIT" });
    if (args.packet.length > 150_000)
      throw new ConvexError({ code: "REMOTE_PACKET_LIMIT" });
    if (
      Date.now() - row.heartbeatAt > 45_000 ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(args.requestId)
    )
      throw new ConvexError({ code: "REMOTE_OFFLINE" });
    const prior = await ctx.db
      .query("remoteCommands")
      .withIndex("by_request", (q) =>
        q.eq("deviceId", args.deviceId).eq("requestId", args.requestId),
      )
      .unique();
    if (prior) return prior._id;
    const sameWindow = Date.now() - (row.rateWindow || 0) < 60_000;
    const count = sameWindow ? (row.rateCount || 0) + 1 : 1;
    if (count > 600) throw new ConvexError({ code: "REMOTE_RATE_LIMIT" });
    await ctx.db.patch(row._id, {
      rateWindow: sameWindow ? row.rateWindow : Date.now(),
      rateCount: count,
    });
    await ctx.db.patch(args.deviceId, { seenAt: Date.now() });
    const commandId = await ctx.db.insert("remoteCommands", {
      sessionId: args.sessionId,
      deviceId: args.deviceId,
      requestId: args.requestId,
      packet: args.packet,
      state: args.chunkCount ? "uploading" : "queued",
      chunkCount: args.chunkCount,
      uploadedChunks: args.chunkCount ? 0 : undefined,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      5 * 60_000,
      makeFunctionReference<"mutation", { commandId: Id<"remoteCommands"> }>(
        "remote:expirePacket",
      ),
      { commandId },
    );
    return commandId;
  },
});
export const claim = mutation({
  args: { ...hostArgs, commandId: v.id("remoteCommands") },
  handler: async (ctx, args) => {
    await host(ctx, args);
    const command = await ctx.db.get(args.commandId);
    if (
      !command ||
      command.sessionId !== args.sessionId ||
      command.state !== "queued" ||
      command.createdAt < Date.now() - 60_000
    )
      return false;
    const client = await ctx.db.get(command.deviceId);
    if (!client || client.revoked) return false;
    await ctx.db.patch(command._id, { state: "claimed" });
    return true;
  },
});
export const complete = mutation({
  args: {
    ...hostArgs,
    commandId: v.id("remoteCommands"),
    response: v.string(),
  },
  handler: async (ctx, args) => {
    await host(ctx, args);
    packet(args.response);
    const command = await ctx.db.get(args.commandId);
    if (
      !command ||
      command.sessionId !== args.sessionId ||
      command.state !== "claimed"
    )
      throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    await ctx.db.patch(command._id, {
      state: "done",
      response: args.response,
      completedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      5 * 60_000,
      makeFunctionReference<"mutation", { commandId: Id<"remoteCommands"> }>(
        "remote:expirePacket",
      ),
      { commandId: command._id },
    );
  },
});
export const publish = mutation({
  args: { ...hostArgs, packet: v.string() },
  handler: async (ctx, args) => {
    const row = await host(ctx, args);
    packet(args.packet);
    if (args.packet.length > 96_000)
      throw new ConvexError({ code: "REMOTE_PACKET_LIMIT" });
    await ctx.db.patch(row._id, {
      revision: row.revision + 1,
      heartbeatAt: Date.now(),
    });
    await ctx.db.insert("remoteEvents", {
      sessionId: row._id,
      revision: row.revision + 1,
      packet: args.packet,
    });
    const old = await ctx.db
      .query("remoteEvents")
      .withIndex("by_session", (q) =>
        q.eq("sessionId", row._id).lt("revision", row.revision - 40),
      )
      .take(10);
    for (const event of old) await ctx.db.delete(event._id);
  },
});
export const heartbeat = mutation({
  args: hostArgs,
  handler: async (ctx, args) => {
    await host(ctx, args);
    await ctx.db.patch(args.sessionId, { heartbeatAt: Date.now() });
  },
});
export const revoke = mutation({
  args: hostArgs,
  handler: async (ctx, args) => {
    await host(ctx, args);
    await ctx.db.patch(args.sessionId, { revoked: true });
    await ctx.scheduler.runAfter(
      60_000,
      makeFunctionReference<"mutation", { sessionId: Id<"remoteSessions"> }>(
        "remote:cleanup",
      ),
      { sessionId: args.sessionId },
    );
  },
});
export const leave = mutation({
  args: deviceArgs,
  handler: async (ctx, args) => {
    await device(ctx, args);
    await ctx.db.patch(args.deviceId, { revoked: true });
  },
});
export const pingDevice = mutation({
  args: deviceArgs,
  handler: async (ctx, args) => {
    await device(ctx, args);
    await ctx.db.patch(args.deviceId, { seenAt: Date.now() });
  },
});
export const cleanup = internalMutation({
  args: { sessionId },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.sessionId);
    if (!row || (!row.revoked && row.expiresAt > Date.now())) return;
    let more = false;
    for (const table of [
      "remoteCommands",
      "remoteEvents",
      "remoteDevices",
      "remoteChunks",
    ] as const) {
      const records = await ctx.db
        .query(table)
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .take(8);
      if (records.length === 8) more = true;
      for (const record of records) await ctx.db.delete(record._id);
    }
    if (more)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation", { sessionId: Id<"remoteSessions"> }>(
          "remote:cleanup",
        ),
        args,
      );
    else await ctx.db.delete(args.sessionId);
  },
});
export const expirePacket = internalMutation({
  args: { commandId: v.id("remoteCommands") },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.commandId);
    // Keep a small receipt until session cleanup, so reconnects cannot replay a command.
    if (command?.state === "claimed") {
      await ctx.db.patch(command._id, { packet: "" });
      return;
    }
    if (command) {
      await ctx.db.patch(command._id, {
        packet: "",
        response: undefined,
        state: "done",
      });
      const chunks = await ctx.db
        .query("remoteChunks")
        .withIndex("by_part", (q) => q.eq("commandId", command._id))
        .take(8);
      for (const chunk of chunks) await ctx.db.delete(chunk._id);
      if (chunks.length === 8)
        await ctx.scheduler.runAfter(
          0,
          makeFunctionReference<
            "mutation",
            { commandId: Id<"remoteCommands"> }
          >("remote:expirePacket"),
          args,
        );
    }
  },
});

const chunkArgs = { commandId: v.id("remoteCommands"), index: v.number() };
function validChunk(index: number, value?: string) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 192 ||
    (value !== undefined && (!value || value.length > 100_000))
  )
    throw new ConvexError({ code: "REMOTE_PACKET_LIMIT" });
}
export const uploadChunk = mutation({
  args: { ...deviceArgs, ...chunkArgs, packet: v.string() },
  handler: async (ctx, args) => {
    await device(ctx, args);
    validChunk(args.index, args.packet);
    const command = await ctx.db.get(args.commandId);
    if (
      !command ||
      command.sessionId !== args.sessionId ||
      command.deviceId !== args.deviceId ||
      args.index >= (command.chunkCount || 0)
    )
      throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    const existing = await ctx.db
      .query("remoteChunks")
      .withIndex("by_part", (q) =>
        q
          .eq("commandId", command._id)
          .eq("direction", "command")
          .eq("index", args.index),
      )
      .unique();
    if (existing) {
      if (existing.packet !== args.packet)
        throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
      return;
    }
    if (
      command.state !== "uploading" ||
      Date.now() - command.createdAt > 60_000
    )
      throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    await ctx.db.insert("remoteChunks", {
      sessionId: args.sessionId,
      commandId: command._id,
      direction: "command",
      index: args.index,
      packet: args.packet,
    });
    const uploadedChunks = (command.uploadedChunks || 0) + 1;
    await ctx.db.patch(command._id, {
      uploadedChunks,
      state: uploadedChunks === command.chunkCount ? "queued" : "uploading",
    });
  },
});
export const commandChunk = query({
  args: { ...hostArgs, ...chunkArgs },
  handler: async (ctx, args) => {
    await host(ctx, args);
    validChunk(args.index);
    const command = await ctx.db.get(args.commandId);
    if (
      !command ||
      command.sessionId !== args.sessionId ||
      command.state !== "claimed" ||
      args.index >= (command.chunkCount || 0)
    )
      throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    const chunk = await ctx.db
      .query("remoteChunks")
      .withIndex("by_part", (q) =>
        q
          .eq("commandId", command._id)
          .eq("direction", "command")
          .eq("index", args.index),
      )
      .unique();
    if (!chunk) throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    return chunk.packet;
  },
});
export const writeResponseChunk = mutation({
  args: { ...hostArgs, ...chunkArgs, packet: v.string() },
  handler: async (ctx, args) => {
    await host(ctx, args);
    validChunk(args.index, args.packet);
    const command = await ctx.db.get(args.commandId);
    if (
      !command ||
      command.sessionId !== args.sessionId ||
      command.state !== "claimed"
    )
      throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    const existing = await ctx.db
      .query("remoteChunks")
      .withIndex("by_part", (q) =>
        q
          .eq("commandId", command._id)
          .eq("direction", "response")
          .eq("index", args.index),
      )
      .unique();
    if (existing) {
      if (existing.packet !== args.packet)
        throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
      return;
    }
    await ctx.db.insert("remoteChunks", {
      sessionId: args.sessionId,
      commandId: command._id,
      direction: "response",
      index: args.index,
      packet: args.packet,
    });
  },
});
export const responseChunk = query({
  args: { ...deviceArgs, ...chunkArgs },
  handler: async (ctx, args) => {
    await device(ctx, args);
    validChunk(args.index);
    const command = await ctx.db.get(args.commandId);
    if (
      !command ||
      command.sessionId !== args.sessionId ||
      command.deviceId !== args.deviceId ||
      command.state !== "done" ||
      !command.response
    )
      throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    const chunk = await ctx.db
      .query("remoteChunks")
      .withIndex("by_part", (q) =>
        q
          .eq("commandId", command._id)
          .eq("direction", "response")
          .eq("index", args.index),
      )
      .unique();
    if (!chunk) throw new ConvexError({ code: "REMOTE_INVALID_COMMAND" });
    return chunk.packet;
  },
});
