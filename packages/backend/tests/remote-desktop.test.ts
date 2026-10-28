import { expect, test } from "vitest";
import { gzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import {
  desktopChannels,
  isDesktopChannel,
} from "../../remote/src/desktop-contract";
import {
  assertSafeRemoteValue,
  redactRemoteConfig,
  restoreRemoteConfig,
  REDACTED,
} from "../../remote/src/desktop-security";
import {
  packTransfer,
  unpackTransfer,
  MAX_TRANSFER_BYTES,
} from "../../remote/src/transfer";
import { randomSecret, seal } from "../../remote/src/crypto";

test("web capabilities exclude native authentication, pairing and window access", () => {
  expect(new Set(desktopChannels).size).toBe(desktopChannels.length);
  for (const channel of [
    "auth:start-login",
    "remote:start-session",
    "window:close",
    "browser:register-tab",
    "arbitrary:invoke",
  ])
    expect(isDesktopChannel(channel)).toBe(false);
  for (const channel of [
    "scheduled-tasks:create",
    "mcp:save",
    "marketplace:install-plugin",
    "workspace:read-file",
    "terminal:write",
  ])
    expect(isDesktopChannel(channel)).toBe(true);
});
test("configuration credentials are masked and preserved through settings saves", () => {
  const config = {
    providers: {
      one: { apiKey: "private", baseUrl: "https://example.invalid" },
    },
    token: "session",
    nested: { headers: { Authorization: "Bearer private" } },
  };
  const masked = redactRemoteConfig(config);
  expect(JSON.stringify(masked)).not.toContain("private");
  expect(masked.providers.one.apiKey).toBe(REDACTED);
  expect(restoreRemoteConfig(masked, config)).toEqual(config);
  masked.providers.one.apiKey = "replacement";
  expect(restoreRemoteConfig(masked, config).providers.one.apiKey).toBe(
    "replacement",
  );
  expect(() =>
    assertSafeRemoteValue(JSON.parse('{"__proto__":{"polluted":true}}')),
  ).toThrow();
  expect(() =>
    restoreRemoteConfig({ constructor: { prototype: {} } }, {}),
  ).toThrow();
});
test("chunked encrypted transfers support large Unicode and incompressible data", async () => {
  const key = randomSecret();
  const value = {
    text: "日本語の履歴".repeat(30000),
    binary: randomBytes(200000).toString("base64"),
  };
  const packed = await packTransfer(
    key,
    "session:response:request",
    value,
    "command",
  );
  expect(packed.parts.length).toBeGreaterThan(1);
  expect(
    await unpackTransfer(
      key,
      "session:response:request",
      packed.packet,
      async (i, id) => {
        expect(id).toBe("command");
        return packed.parts[i]!;
      },
    ),
  ).toEqual(value);
  await expect(
    unpackTransfer(
      key,
      "session:response:other",
      packed.packet,
      async (i) => packed.parts[i]!,
    ),
  ).rejects.toThrow();
  await expect(
    unpackTransfer(
      key,
      "session:response:request",
      packed.packet,
      async (i) => packed.parts[(i + 1) % packed.parts.length]!,
    ),
  ).rejects.toThrow();
});
test("decompression is bounded before a compressed payload can exhaust memory", async () => {
  const key = randomSecret();
  const context = "bomb";
  const compressed = gzipSync(
    Buffer.alloc(MAX_TRANSFER_BYTES + 1, 32),
  ).toString("base64");
  const packet = await seal(key, context, { __remoteTransfer: { count: 1 } });
  const part = await seal(key, `${context}:part:0`, compressed);
  await expect(
    unpackTransfer(key, context, packet, async () => part),
  ).rejects.toThrow("REMOTE_TRANSFER_LIMIT");
});
