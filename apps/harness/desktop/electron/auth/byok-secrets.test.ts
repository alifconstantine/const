import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ByokSecretStore, formatApiKeyHint } from "./byok-secrets.js";

test("formatApiKeyHint preserves prefix and masks middle characters", () => {
  assert.equal(formatApiKeyHint("sk-proj-abcdefgh1234"), "sk-••••1234");
  assert.equal(formatApiKeyHint("123456"), "••••56");
  assert.equal(formatApiKeyHint("   "), "");
});

test("ByokSecretStore encrypts keys on disk and scrubs plaintext from provider configs", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "const-byok-test-"));
  const storePath = path.join(tmpDir, "byok-secrets.enc");
  const cipher = {
    encrypt: (plain: string) => Buffer.from(`SAFE:${Buffer.from(plain, "utf8").toString("base64")}`, "utf8"),
    decrypt: (buf: Buffer) => {
      const s = buf.toString("utf8");
      assert.ok(s.startsWith("SAFE:"));
      return Buffer.from(s.slice(5), "base64").toString("utf8");
    },
  };

  try {
    const store = new ByokSecretStore({ storePath, cipher, requireCipher: true });
    const scrubbed = store.scrubProviderList(
      [
        { id: "custom-1", name: "My Groq", apiKey: "gsk_super_secret_key_9988" },
        { id: "const-router", name: "Const Router", apiKey: "" },
      ],
      "llm:",
    )!;

    assert.equal(scrubbed[0]!.apiKey, "");
    assert.equal(scrubbed[0]!.hasApiKey, true);
    assert.equal(scrubbed[0]!.apiKeyHint, "••••9988");
    assert.equal(scrubbed[1]!.hasApiKey, false);

    // Raw file on disk must be encrypted and not contain plaintext key
    const diskRaw = fs.readFileSync(storePath, "utf8");
    assert.ok(diskRaw.startsWith("SAFE:"));
    assert.equal(diskRaw.includes("gsk_super_secret_key_9988"), false);

    // Reload from disk recovers the original secret
    const store2 = new ByokSecretStore({ storePath, cipher, requireCipher: true });
    assert.equal(store2.getKey("llm:custom-1"), "gsk_super_secret_key_9988");

    // Re-scrubbing with empty apiKey preserves existing encrypted secret unless hasApiKey === false
    const kept = store2.scrubProviderList(
      [{ id: "custom-1", name: "My Groq", apiKey: "", hasApiKey: true }],
      "llm:",
    )!;
    assert.equal(kept[0]!.hasApiKey, true);
    assert.equal(store2.getKey("llm:custom-1"), "gsk_super_secret_key_9988");

    // Clearing explicitly via hasApiKey: false deletes the secret
    store2.scrubProviderList([{ id: "custom-1", name: "My Groq", apiKey: "", hasApiKey: false }], "llm:");
    assert.equal(store2.getKey("llm:custom-1"), "");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
