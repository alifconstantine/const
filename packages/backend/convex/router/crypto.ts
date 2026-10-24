// Cryptographic utilities for AES-256-GCM encryption at rest for provider API keys

const MASTER_SALT = "const-platform-provider-master-v1";

async function getEncryptionKey(): Promise<CryptoKey> {
  const secretSource =
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET || process.env.JWT_PRIVATE_KEY;
  if (!secretSource)
    throw new Error("Provider encryption secret is not configured");

  const encoder = new TextEncoder();
  const rawData = encoder.encode(`${secretSource}:${MASTER_SALT}`);
  const keyDigest = await crypto.subtle.digest("SHA-256", rawData);

  return await crypto.subtle.importKey(
    "raw",
    keyDigest,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const byteArray =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): Uint8Array {
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Encrypts a sensitive API key using AES-256-GCM with a unique 12-byte IV.
 */
export async function encryptApiKey(
  plainKey: string,
): Promise<{ cipher: string; iv: string }> {
  const key = await getEncryptionKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const encoder = new TextEncoder();
  const data = encoder.encode(plainKey);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return {
    cipher: bufferToHex(encryptedBuffer),
    iv: bufferToHex(iv),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted API key ciphertext.
 */
export async function decryptApiKey(
  cipherHex: string,
  ivHex: string,
): Promise<string> {
  const key = await getEncryptionKey();
  const iv = hexToBuffer(ivHex);
  const cipherBuffer = hexToBuffer(cipherHex);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    cipherBuffer as unknown as BufferSource,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Generates a safe masked version of an API key for UI display (e.g. "sk-proj-...8a1f").
 */
export function maskApiKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return "No key set";
  if (trimmed.length <= 10) return "••••••••";

  if (trimmed.startsWith("sk-proj-")) {
    return `${trimmed.slice(0, 11)}...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith("sk-")) {
    return `${trimmed.slice(0, 7)}...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith("AIzaSy")) {
    // Google AI key
    return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
  }

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}
