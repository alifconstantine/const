import { expect, test, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { digest, open, openWithCode, randomSecret, seal, sealWithCode } from "../../remote/src/crypto";
import { emptyLive, reduceLive } from "../../remote/src/live";

const modules = import.meta.glob("../convex/**/*.ts");
afterEach(() => vi.restoreAllMocks());
async function setup() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Owner" }),
  );
  const otherId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Other" }),
  );
  const owner = t.withIdentity({ subject: `${ownerId}|session` });
  const other = t.withIdentity({ subject: `${otherId}|session` });
  const hostHash = await digest(randomSecret()),
    secret = randomSecret(),
    pairHash = await digest(secret);
  const sessionId = await owner.mutation(api.remote.create, {
    deviceName: "Test desktop",
    hostHash,
    pairHash,
  });
  const secretHash = await digest(randomSecret());
  const deviceId = await owner.mutation(api.remote.join, {
    sessionId,
    pairHash,
    secretHash,
    name: "Test phone",
  });
  return {
    t,
    owner,
    other,
    sessionId,
    hostHash,
    secret,
    pairHash,
    deviceId,
    secretHash,
  };
}
test("requires an authenticated owner and rejects cross-account pairing and reads", async () => {
  const s = await setup();
  await expect(
    s.t.mutation(api.remote.create, {
      deviceName: "x",
      hostHash: s.hostHash,
      pairHash: s.pairHash,
    }),
  ).rejects.toThrow();
  await expect(
    s.other.mutation(api.remote.join, {
      sessionId: s.sessionId,
      pairHash: s.pairHash,
      secretHash: s.secretHash,
      name: "x",
    }),
  ).rejects.toThrow();
  await expect(
    s.other.query(api.remote.deviceFeed, {
      sessionId: s.sessionId,
      deviceId: s.deviceId,
      secretHash: s.secretHash,
    }),
  ).rejects.toThrow();
});

test("only the account owner can remove a session without the desktop host secret", async () => {
  const s = await setup();
  await expect(s.other.mutation(api.remote.removeMySession, { sessionId: s.sessionId })).rejects.toThrow();
  await expect(s.t.mutation(api.remote.removeMySession, { sessionId: s.sessionId })).rejects.toThrow();
  expect(await s.owner.query(api.remote.listMySessions, {})).toHaveLength(1);
  await s.owner.mutation(api.remote.removeMySession, { sessionId: s.sessionId });
  expect(await s.owner.query(api.remote.listMySessions, {})).toHaveLength(0);
  await expect(s.owner.query(api.remote.deviceFeed, {
    sessionId: s.sessionId, deviceId: s.deviceId, secretHash: s.secretHash,
  })).rejects.toThrow();
  // Repeated removal remains safe, including expired sessions visible in a stale UI.
  await s.owner.mutation(api.remote.removeMySession, { sessionId: s.sessionId });
});

test("a short code resolves, decrypts and pairs using the same proof as a direct link", async () => {
  const s = await setup();
  const code = "ABC-234";
  const sessionId = await s.owner.mutation(api.remote.create, {
    deviceName: "Pairing desktop", hostHash: s.hostHash, pairHash: s.pairHash,
    pairingCode: code, encryptedSecret: await sealWithCode(code, s.secret),
  });
  const resolved = await s.owner.query(api.remote.resolvePairingCode, { code: " abc 234 " });
  expect(resolved.sessionId).toBe(sessionId);
  const secret = await openWithCode("abc234", resolved.encryptedSecret!);
  expect(secret).toBe(s.secret);
  await expect(s.owner.mutation(api.remote.join, {
    sessionId, pairHash: await digest(secret), secretHash: await digest(randomSecret()), name: "Phone via code",
  })).resolves.toBeDefined();
  await expect(s.other.query(api.remote.resolvePairingCode, { code })).rejects.toThrow();
  await expect(s.t.query(api.remote.resolvePairingCode, { code })).rejects.toThrow();
  await expect(openWithCode("XYZ789", resolved.encryptedSecret!)).rejects.toThrow();
  await s.t.run(ctx => ctx.db.patch(sessionId, { pairExpiresAt: Date.now() - 1 }));
  await expect(s.owner.query(api.remote.resolvePairingCode, { code })).rejects.toThrow();
});

test.each(["other owner", "revoked", "expired invitation", "expired session"])(
  "a code shared with an older %s session still resolves the owner's valid invitation",
  async (kind) => {
    const s = await setup();
    const code = "ABC-234";
    const args = {
      deviceName: "Desktop", hostHash: s.hostHash, pairHash: s.pairHash,
      pairingCode: code, encryptedSecret: await sealWithCode(code, s.secret),
    };
    const first = await (kind === "other owner" ? s.other : s.owner).mutation(api.remote.create, args);
    if (kind !== "other owner") await s.t.run(ctx => ctx.db.patch(first,
      kind === "revoked" ? { revoked: true } : kind === "expired invitation"
        ? { pairExpiresAt: Date.now() - 1 } : { expiresAt: Date.now() - 1 },
    ));
    const current = await s.owner.mutation(api.remote.create, args);
    const resolved = await s.owner.query(api.remote.resolvePairingCode, { code });
    expect(resolved.sessionId).toBe(current);
  },
);
test("a paired device cannot impersonate the desktop or another grant", async () => {
  const s = await setup();
  await expect(
    s.owner.query(api.remote.hostInbox, {
      sessionId: s.sessionId,
      hostHash: s.pairHash,
    }),
  ).rejects.toThrow();
  await expect(
    s.owner.query(api.remote.deviceFeed, {
      sessionId: s.sessionId,
      deviceId: s.deviceId,
      secretHash: s.pairHash,
    }),
  ).rejects.toThrow();
});
test("commands are correlated, atomically claimed once, and carry encrypted responses", async () => {
  const s = await setup();
  const args = {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
    requestId: "request_1",
    packet: await seal(s.secret, `${s.sessionId}:command:request_1`, {
      type: "state:get",
    }),
  };
  const commandId = await s.owner.mutation(api.remote.submit, args);
  expect(await s.owner.mutation(api.remote.submit, args)).toBe(commandId);
  const hostArgs = { sessionId: s.sessionId, hostHash: s.hostHash };
  expect(
    (await s.owner.query(api.remote.hostInbox, hostArgs)).commands,
  ).toHaveLength(1);
  expect(
    await s.owner.mutation(api.remote.claim, { ...hostArgs, commandId }),
  ).toBe(true);
  expect(
    await s.owner.mutation(api.remote.claim, { ...hostArgs, commandId }),
  ).toBe(false);
  const response = await seal(s.secret, `${s.sessionId}:response:request_1`, {
    privateText: "hello",
  });
  await s.owner.mutation(api.remote.complete, {
    ...hostArgs,
    commandId,
    response,
  });
  const feed = await s.owner.query(api.remote.deviceFeed, {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
  });
  expect(
    await open(
      s.secret,
      `${s.sessionId}:response:request_1`,
      feed.responses[0]!.response!,
    ),
  ).toEqual({ privateText: "hello" });
  expect(
    JSON.stringify(
      await s.t.run((ctx) => ctx.db.query("remoteCommands").collect()),
    ),
  ).not.toContain("privateText");
});
test("leaving revokes queued commands and session revocation blocks all access", async () => {
  const s = await setup();
  const grant = {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
  };
  const commandId = await s.owner.mutation(api.remote.submit, {
    ...grant,
    requestId: "pending",
    packet: "encrypted",
  });
  await s.owner.mutation(api.remote.leave, grant);
  expect(
    await s.owner.mutation(api.remote.claim, {
      sessionId: s.sessionId,
      hostHash: s.hostHash,
      commandId,
    }),
  ).toBe(false);
  await expect(s.owner.query(api.remote.deviceFeed, grant)).rejects.toThrow();
  await s.owner.mutation(api.remote.revoke, {
    sessionId: s.sessionId,
    hostHash: s.hostHash,
  });
  await expect(
    s.owner.query(api.remote.hostInbox, {
      sessionId: s.sessionId,
      hostHash: s.hostHash,
    }),
  ).rejects.toThrow();
});
test("expired QR cannot pair, established grants survive QR expiry, stale commands cannot execute", async () => {
  const s = await setup();
  await s.t.run((ctx) =>
    ctx.db.patch(s.sessionId, { pairExpiresAt: Date.now() - 1 }),
  );
  await expect(
    s.owner.mutation(api.remote.join, {
      sessionId: s.sessionId,
      pairHash: s.pairHash,
      secretHash: await digest(randomSecret()),
      name: "new",
    }),
  ).rejects.toThrow();
  const grant = {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
  };
  await expect(
    s.owner.query(api.remote.deviceFeed, grant),
  ).resolves.toBeDefined();
  const commandId = await s.owner.mutation(api.remote.submit, {
    ...grant,
    requestId: "stale",
    packet: "encrypted",
  });
  await s.t.run((ctx) =>
    ctx.db.patch(commandId, { createdAt: Date.now() - 61_000 }),
  );
  expect(
    await s.owner.mutation(api.remote.claim, {
      sessionId: s.sessionId,
      hostHash: s.hostHash,
      commandId,
    }),
  ).toBe(false);
});
test("offline hosts and excessive packets are rejected", async () => {
  const s = await setup();
  const grant = {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
  };
  await expect(
    s.owner.mutation(api.remote.submit, {
      ...grant,
      requestId: "large",
      packet: "x".repeat(700_001),
    }),
  ).rejects.toThrow();
  await s.t.run((ctx) =>
    ctx.db.patch(s.sessionId, { heartbeatAt: Date.now() - 46_000 }),
  );
  await expect(
    s.owner.mutation(api.remote.submit, {
      ...grant,
      requestId: "offline",
      packet: "encrypted",
    }),
  ).rejects.toThrow();
});
test("encrypted packets reject changed keys, direction, request IDs and tampering", async () => {
  const key = randomSecret();
  const encrypted = await seal(key, "session:command:one", { text: "private" });
  expect(await open(key, "session:command:one", encrypted)).toEqual({
    text: "private",
  });
  await expect(
    open(randomSecret(), "session:command:one", encrypted),
  ).rejects.toThrow();
  await expect(open(key, "session:response:one", encrypted)).rejects.toThrow();
  await expect(open(key, "session:command:two", encrypted)).rejects.toThrow();
  const [iv, data] = encrypted.split(".");
  await expect(
    open(
      key,
      "session:command:one",
      `${iv}.${data![0] === "a" ? "b" : "a"}${data!.slice(1)}`,
    ),
  ).rejects.toThrow();
});
test("large Unicode conversation snapshots encrypt without argument-stack overflow", async () => {
  const secret = randomSecret();
  const value = { text: "こんにちは世界".repeat(12_000) };
  const packet = await seal(secret, "snapshot", value);
  expect(await open(secret, "snapshot", packet)).toEqual(value);
});
test("replayed tokens cannot duplicate snapshot text and reset events start a fresh turn", () => {
  const snapshot = { ...emptyLive(), revision: 8, text: "hello" };
  expect(reduceLive(snapshot, { type: "token", token: "hello" }, 8)).toBe(
    snapshot,
  );
  const streamed = reduceLive(snapshot, { type: "token", token: " world" }, 9);
  expect(streamed.text).toBe("hello world");
  expect(reduceLive(streamed, { type: "token_reset" }, 10).text).toBe("");
});
test("packet expiration preserves the request receipt until the session is revoked", async () => {
  const s = await setup();
  const grant = {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
  };
  const args = { ...grant, requestId: "receipt", packet: "encrypted" };
  const commandId = await s.owner.mutation(api.remote.submit, args);
  await s.t.mutation(internal.remote.expirePacket, { commandId });
  expect(await s.owner.mutation(api.remote.submit, args)).toBe(commandId);
  expect(
    await s.owner.mutation(api.remote.claim, {
      sessionId: s.sessionId,
      hostHash: s.hostHash,
      commandId,
    }),
  ).toBe(false);
  const receipt = await s.t.run((ctx) => ctx.db.get(commandId));
  expect(receipt?.packet).toBe("");
});

test("multipart requests remain unclaimable until complete and chunks are device scoped", async () => {
  const s = await setup();
  const grant = {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
  };
  const commandId = await s.owner.mutation(api.remote.submit, {
    ...grant,
    requestId: "multipart",
    packet: "encrypted descriptor",
    chunkCount: 2,
  });
  const host = { sessionId: s.sessionId, hostHash: s.hostHash };
  expect(await s.owner.mutation(api.remote.claim, { ...host, commandId })).toBe(
    false,
  );
  const secondSecret = await digest(randomSecret());
  const secondId = await s.owner.mutation(api.remote.join, {
    sessionId: s.sessionId,
    pairHash: s.pairHash,
    secretHash: secondSecret,
    name: "Second phone",
  });
  await expect(
    s.owner.mutation(api.remote.uploadChunk, {
      sessionId: s.sessionId,
      deviceId: secondId,
      secretHash: secondSecret,
      commandId,
      index: 0,
      packet: "chunk",
    }),
  ).rejects.toThrow();
  for (const index of [0, 1])
    await s.owner.mutation(api.remote.uploadChunk, {
      ...grant,
      commandId,
      index,
      packet: `part-${index}`,
    });
  await s.owner.mutation(api.remote.uploadChunk, {
    ...grant,
    commandId,
    index: 1,
    packet: "part-1",
  });
  expect(await s.owner.mutation(api.remote.claim, { ...host, commandId })).toBe(
    true,
  );
  expect(
    await s.owner.query(api.remote.commandChunk, {
      ...host,
      commandId,
      index: 0,
    }),
  ).toBe("part-0");
  await s.owner.mutation(api.remote.writeResponseChunk, {
    ...host,
    commandId,
    index: 0,
    packet: "reply part",
  });
  await s.owner.mutation(api.remote.complete, {
    ...host,
    commandId,
    response: "reply descriptor",
  });
  await expect(
    s.owner.query(api.remote.responseChunk, {
      sessionId: s.sessionId,
      deviceId: secondId,
      secretHash: secondSecret,
      commandId,
      index: 0,
    }),
  ).rejects.toThrow();
  expect(
    await s.owner.query(api.remote.responseChunk, {
      ...grant,
      commandId,
      index: 0,
    }),
  ).toBe("reply part");
  await s.t.mutation(internal.remote.expirePacket, { commandId });
  expect(
    await s.t.run((ctx) => ctx.db.query("remoteChunks").collect()),
  ).toEqual([]);
});

test("a claimed long run can finish after command ciphertext expires", async () => {
  const s = await setup();
  const host = { sessionId: s.sessionId, hostHash: s.hostHash };
  const commandId = await s.owner.mutation(api.remote.submit, {
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    secretHash: s.secretHash,
    requestId: "long-run",
    packet: "private command",
  });
  await s.owner.mutation(api.remote.claim, { ...host, commandId });
  await s.t.mutation(internal.remote.expirePacket, { commandId });
  expect((await s.t.run((ctx) => ctx.db.get(commandId)))?.state).toBe(
    "claimed",
  );
  await expect(
    s.owner.mutation(api.remote.complete, {
      ...host,
      commandId,
      response: "late encrypted result",
    }),
  ).resolves.toBeNull();
});

test("offline crashed hosts do not lock the account out for eight hours", async () => {
  const s = await setup();
  await s.t.run((ctx) =>
    ctx.db.patch(s.sessionId, { heartbeatAt: Date.now() - 91_000 }),
  );
  const replacement = await s.owner.mutation(api.remote.create, {
    deviceName: "Replacement",
    hostHash: s.hostHash,
    pairHash: s.pairHash,
  });
  expect(replacement).not.toBe(s.sessionId);
  await expect(
    s.owner.query(api.remote.hostInbox, {
      sessionId: s.sessionId,
      hostHash: s.hostHash,
    }),
  ).rejects.toThrow();
});
