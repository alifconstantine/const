import { createHash } from "node:crypto";
import type { AgentErrorCategory, ModelImageNormalizer, NormalizedModelImage, RequestDiagnostics } from "./types.js";

export const CONST_REQUEST_BODY_BUDGET = 4_000_000;
const IMAGE_TARGET_BYTES = 500 * 1024;
const IMAGE_MAX_DIMENSION = 1568;
const MIN_IMAGE_BYTES = 32 * 1024;

export class AgentRequestError extends Error {
  constructor(message: string, readonly category: AgentErrorCategory, readonly httpStatus?: number, readonly diagnostics?: RequestDiagnostics) {
    super(message);
    this.name = "AgentRequestError";
  }
}

export function requestBodyBudget(endpoint: string, override?: number): number | undefined {
  if (override !== undefined) {
    if (!Number.isSafeInteger(override) || override < 1024) throw new Error("Invalid request body byte limit");
    return override;
  }
  return new URL(endpoint).hostname === "router.const.web.id" ? CONST_REQUEST_BODY_BUDGET : undefined;
}

interface ImagePart {
  type: "image_url";
  image_url: { url: string; detail?: string };
  constImage?: { width?: number; height?: number; scale?: number };
}

interface WireMessage {
  role: string;
  content?: string | Array<Record<string, unknown>> | null;
  [key: string]: unknown;
}

export interface ChatRequestPayload {
  messages: WireMessage[];
  [key: string]: unknown;
}

export const PAYLOAD_ERROR_MESSAGE = "The request exceeds the gateway's size limit. Resize or crop the supplied images, inspect fewer images at once, or shorten the input, then continue. Original files and chat history are unchanged.";

/** Request-only projection: never mutate uploads, tool results or persisted history.
 * Like omp's provider image budget, measure encoded media and the final JSON
 * separately from token pressure. Remote references are never downloaded here. */
export function createRequestPreparer(normalizeImage?: ModelImageNormalizer) {
  const cache = new Map<string, NormalizedModelImage>();
  let cacheBytes = 0;
  return async (payload: ChatRequestPayload, options: {
    endpoint: string; runId: string; signal: AbortSignal; limitBytes?: number;
    recovery?: "payload" | "context";
  }): Promise<{ body: string; diagnostics: RequestDiagnostics }> => {
    options.signal.throwIfAborted();
    const inline: Array<{ part: ImagePart; replace: (parts: Array<Record<string, unknown>>) => void }> = [];
    const wire: ChatRequestPayload = { ...payload, messages: payload.messages.map(message => {
      if (!Array.isArray(message.content)) return { ...message };
      const groups = message.content.map(part => {
        if (part.type !== "image_url") return [{ ...part }];
        const image = part as unknown as ImagePart;
        let projected: Array<Record<string, unknown>> = [{ type: "image_url", image_url: { ...image.image_url } }];
        if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(image.image_url.url)) {
          inline.push({ part: image, replace: parts => { projected = parts; } });
        }
        return { get parts() { return projected; } };
      });
      // The accessor allows normalization to finish before serialization, while
      // all original message/content objects remain untouched.
      return { ...message, get content() { return groups.flatMap(group => Array.isArray(group) ? group : group.parts); } };
    }) };

    const originalBody = JSON.stringify(wire);
    const originalDiagnostics: RequestDiagnostics = { runId: options.runId, endpointHost: new URL(options.endpoint).hostname,
      requestBytes: Buffer.byteLength(originalBody), messageCount: wire.messages.length, imageBytes: 0, imageCount: 0, recovery: options.recovery };
    for (const message of wire.messages) {
      if (!Array.isArray(message.content)) continue;
      for (const part of message.content) {
        if (part.type !== "image_url") continue;
        originalDiagnostics.imageCount++;
        const url = (part.image_url as { url: string }).url;
        if (url.startsWith("data:")) originalDiagnostics.imageBytes += Buffer.byteLength(url);
      }
    }
    const originalImageBytes = inline.reduce((sum, { part }) => sum + Buffer.byteLength(part.image_url.url), 0);
    const nonImageBytes = Buffer.byteLength(originalBody) - originalImageBytes;
    const available = options.limitBytes === undefined ? Infinity : options.limitBytes - nonImageBytes - inline.length * 1024;
    const targetBytes = Math.floor(Math.min(IMAGE_TARGET_BYTES, available / Math.max(1, inline.length) * 0.72));
    if (inline.length && targetBytes < MIN_IMAGE_BYTES) throw new AgentRequestError(PAYLOAD_ERROR_MESSAGE, "payload", undefined, originalDiagnostics);

    for (const { part, replace } of inline) {
      options.signal.throwIfAborted();
      if (!normalizeImage) {
        const scale = part.constImage?.scale;
        if (scale && scale > 0) replace([{ type: "text", text: `Divide image pixel coordinates by ${scale} for window-local action coordinates.` }, { type: "image_url", image_url: { ...part.image_url } }]);
        continue;
      }
      const maxDimension = options.recovery === "payload" ? 1280 : IMAGE_MAX_DIMENSION;
      const maxBytes = options.recovery === "payload" ? Math.min(targetBytes, IMAGE_TARGET_BYTES / 2) : targetBytes;
      const key = createHash("sha256").update(part.image_url.url).update(`:${maxBytes}:${maxDimension}`).digest("hex");
      let image = cache.get(key);
      if (!image) {
        try { image = await normalizeImage(part.image_url.url, { maxBytes, maxDimension }, options.signal); }
        catch (error) {
          options.signal.throwIfAborted();
          throw error instanceof AgentRequestError ? error : new AgentRequestError("The image could not be prepared for the model. Convert it to PNG or JPEG, or crop it, then try again.", "image", undefined, originalDiagnostics);
        }
        options.signal.throwIfAborted();
        if (cacheBytes + image.dataUrl.length > 8 * 1024 * 1024) { cache.clear(); cacheBytes = 0; }
        cache.set(key, image);
        cacheBytes += image.dataUrl.length;
      }
      const changed = image.width !== image.originalWidth || image.height !== image.originalHeight;
      const scale = part.constImage?.scale;
      const originalWidth = part.constImage?.width ?? image.originalWidth;
      const originalHeight = part.constImage?.height ?? image.originalHeight;
      const xFactor = originalWidth / image.width / (scale && scale > 0 ? scale : 1);
      const yFactor = originalHeight / image.height / (scale && scale > 0 ? scale : 1);
      const note = changed || scale !== undefined
        ? `Image displayed at ${image.width}x${image.height}; original ${originalWidth}x${originalHeight}. Multiply displayed x by ${xFactor.toFixed(6)} and y by ${yFactor.toFixed(6)} for ${scale !== undefined ? "window-local action coordinates" : "original image coordinates"}.`
        : undefined;
      replace([...(note ? [{ type: "text", text: note }] : []), { type: "image_url", image_url: { ...part.image_url, url: image.dataUrl } }]);
    }
    options.signal.throwIfAborted();
    const body = JSON.stringify(wire);
    const requestBytes = Buffer.byteLength(body, "utf8");
    let imageBytes = 0;
    let imageCount = 0;
    for (const message of wire.messages) {
      if (!Array.isArray(message.content)) continue;
      for (const part of message.content) {
        if (part.type !== "image_url") continue;
        imageCount++;
        const url = (part.image_url as { url: string }).url;
        if (url.startsWith("data:")) imageBytes += Buffer.byteLength(url);
      }
    }
    const diagnostics: RequestDiagnostics = { runId: options.runId, endpointHost: new URL(options.endpoint).hostname,
      requestBytes, imageBytes, imageCount, messageCount: wire.messages.length, recovery: options.recovery };
    if (wire.messages.length > 500 || (options.limitBytes !== undefined && requestBytes > options.limitBytes)) {
      throw new AgentRequestError(PAYLOAD_ERROR_MESSAGE, "payload", undefined, diagnostics);
    }
    return { body, diagnostics };
  };
}
