import { open, seal } from "./crypto";

export const MAX_TRANSFER_BYTES = 8 * 1024 * 1024;
export const MAX_TRANSFER_PARTS = 192;
const PART_BYTES = 48_000;
function base64(bytes: Uint8Array) {
  let value = "";
  for (let i = 0; i < bytes.length; i += 16384)
    value += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(value);
}
function bytes(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
async function transform(input: Uint8Array, decompress: boolean) {
  const stream = new Blob([input as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(
      decompress
        ? new DecompressionStream("gzip")
        : new CompressionStream("gzip"),
    );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_TRANSFER_BYTES) throw new Error("REMOTE_TRANSFER_LIMIT");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
export async function packTransfer(
  secret: string,
  context: string,
  value: unknown,
  commandId?: string,
) {
  const plain = new TextEncoder().encode(JSON.stringify(value));
  if (plain.length > MAX_TRANSFER_BYTES)
    throw new Error("REMOTE_TRANSFER_LIMIT");
  if (plain.length <= PART_BYTES)
    return {
      packet: await seal(secret, context, value),
      parts: [] as string[],
    };
  const compressed = await transform(plain, false);
  const parts: string[] = [];
  for (let i = 0; i < compressed.length; i += PART_BYTES)
    parts.push(
      await seal(
        secret,
        `${context}:part:${parts.length}`,
        base64(compressed.subarray(i, i + PART_BYTES)),
      ),
    );
  if (parts.length > MAX_TRANSFER_PARTS)
    throw new Error("REMOTE_TRANSFER_LIMIT");
  return {
    packet: await seal(secret, context, {
      __remoteTransfer: { count: parts.length, commandId },
    }),
    parts,
  };
}
export async function unpackTransfer<T>(
  secret: string,
  context: string,
  packet: string,
  readPart: (index: number, commandId?: string) => Promise<string>,
): Promise<T> {
  const value = await open<any>(secret, context, packet);
  if (!value?.__remoteTransfer) return value;
  const { count, commandId } = value.__remoteTransfer;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_TRANSFER_PARTS ||
    (commandId !== undefined && typeof commandId !== "string")
  )
    throw new Error("REMOTE_TRANSFER_LIMIT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let index = 0; index < count; index++) {
    const part = bytes(
      await open<string>(
        secret,
        `${context}:part:${index}`,
        await readPart(index, commandId),
      ),
    );
    size += part.length;
    if (size > MAX_TRANSFER_BYTES) throw new Error("REMOTE_TRANSFER_LIMIT");
    chunks.push(part);
  }
  const compressed = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(
    new TextDecoder().decode(await transform(compressed, true)),
  ) as T;
}
