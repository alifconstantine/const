const encoder = new TextEncoder();
function encode(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16_384)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("INVALID_KEY");
  return Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (character) => character.charCodeAt(0),
  );
}
export function randomSecret(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
export async function digest(value: string): Promise<string> {
  return encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
async function key(secret: string) {
  const bytes = decode(secret);
  if (bytes.length !== 32) throw new Error("INVALID_KEY");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(
  secret: string,
  context: string,
  value: unknown,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(JSON.stringify(value));
  if (data.length > 500_000) throw new Error("PACKET_TOO_LARGE");
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    await key(secret),
    data,
  );
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
export async function open<T>(
  secret: string,
  context: string,
  packet: string,
): Promise<T> {
  if (packet.length > 700_000) throw new Error("PACKET_TOO_LARGE");
  const [iv, data, extra] = packet.split(".");
  if (!iv || !data || extra) throw new Error("INVALID_PACKET");
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(iv),
      additionalData: encoder.encode(context),
    },
    await key(secret),
    decode(data),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
