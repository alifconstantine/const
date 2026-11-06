import { nativeImage } from "electron";
import type { ModelImageNormalizer } from "@const/agent";

/** Keep source files untouched. PNG preserves small UI text when it fits;
 * JPEG and bounded resizing handle photographic/contact-sheet input. */
export const normalizeModelImage: ModelImageNormalizer = async (dataUrl, options, signal) => {
  signal.throwIfAborted();
  const original = nativeImage.createFromDataURL(dataUrl);
  if (original.isEmpty()) throw new Error("Invalid image data");
  const size = original.getSize();
  const ratio = Math.min(1, options.maxDimension / Math.max(size.width, size.height));
  let width = Math.max(1, Math.round(size.width * ratio));
  let height = Math.max(1, Math.round(size.height * ratio));
  const minEdge = Math.min(768, Math.max(width, height));
  while (true) {
    signal.throwIfAborted();
    const resized = width === size.width && height === size.height ? original : original.resize({ width, height, quality: "best" });
    const png = resized.toPNG();
    let bytes = png;
    let mime = "image/png";
    if (bytes.length > options.maxBytes) {
      for (const quality of [85, 75, 65]) {
        signal.throwIfAborted();
        const jpeg = resized.toJPEG(quality);
        if (jpeg.length < bytes.length) { bytes = jpeg; mime = "image/jpeg"; }
        if (bytes.length <= options.maxBytes) break;
      }
    }
    if (bytes.length <= options.maxBytes) {
      return { dataUrl: `data:${mime};base64,${bytes.toString("base64")}`, originalWidth: size.width, originalHeight: size.height, width, height };
    }
    if (Math.max(width, height) <= minEdge) throw new Error("Image needs a crop to fit without excessive loss of detail");
    const factor = Math.max(minEdge / Math.max(width, height), 0.8);
    width = Math.max(1, Math.floor(width * factor));
    height = Math.max(1, Math.floor(height * factor));
    // Yield between encodes so Stop can be processed by Electron's event loop.
    await new Promise<void>(resolve => setImmediate(resolve));
  }
};
