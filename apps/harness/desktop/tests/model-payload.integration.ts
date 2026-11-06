import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, nativeImage } from "electron";
import { normalizeModelImage } from "../electron/model-image";
import { createRequestPreparer, CONST_REQUEST_BODY_BUDGET } from "../../../../packages/agent/src/const/request-payload";
import { ConstAgent } from "../../../../packages/agent/src/const/const-agent";
import type { AgentEvent, AgentMessage } from "../../../../packages/agent/src/const/types";

const directory = process.argv[2]!;
app.setPath("userData", path.join(directory, "profile"));
app.on("window-all-closed", () => {});

async function run() {
  await app.whenReady();
  // Render real small text and a coordinate grid, then pass its PNG through
  // Electron's real decoder/encoder. No desktop input or remote traffic.
  const window = new BrowserWindow({ show: false, width: 2000, height: 1200, webPreferences: { offscreen: true, backgroundThrottling: false } });
  await window.loadURL("data:text/html," + encodeURIComponent(`<style>body{margin:0;background:white;color:black;font:24px monospace}div{padding:40px;line-height:1.6}small{font-size:16px}</style><div>MODEL IMAGE TEST / 0123456789<br><small>Small text: the original file stays intact. Check x=1000, y=600.</small><hr><svg width="1920" height="1000"><rect x="920" y="400" width="80" height="80" fill="red"/><path d="M0 440H1920M960 0V1000" stroke="black"/></svg></div>`));
  await new Promise(resolve => setTimeout(resolve, 300));
  const captured = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  const original = captured.toPNG();
  const source = path.join(directory, "text-grid.png");
  await writeFile(source, original);
  const dataUrl = `data:image/png;base64,${original.toString("base64")}`;
  const normalized = await normalizeModelImage(dataUrl, { maxBytes: 500 * 1024, maxDimension: 1568 }, new AbortController().signal);
  const decoded = nativeImage.createFromDataURL(normalized.dataUrl);
  assert(!decoded.isEmpty());
  assert(Math.max(normalized.width, normalized.height) <= 1568);
  assert.deepEqual(decoded.getSize(), { width: normalized.width, height: normalized.height });
  assert(Buffer.from(normalized.dataUrl.split(",")[1]!, "base64").length <= 500 * 1024);
  assert.deepEqual(await readFile(source), original);
  await writeFile(path.join(directory, "text-grid-model.png"), decoded.toPNG());
  console.log("PASS: real Electron normalization preserves the source, decodable text/grid image and dimension limits");

  // Synthetic, deterministic pixel noise exercises compression even when
  // a screenshot's PNG is already small. The two original images remain valid.
  const width = 1400, height = 1000;
  const pixels = Buffer.alloc(width * height * 4);
  let value = 1;
  for (let index = 0; index < pixels.length; index += 4) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    pixels[index] = value & 255; pixels[index + 1] = (value >>> 8) & 255; pixels[index + 2] = (value >>> 16) & 255; pixels[index + 3] = 255;
  }
  const large = nativeImage.createFromBitmap(pixels, { width, height }).toDataURL();
  assert(Buffer.from(large.split(",")[1]!, "base64").length > 3 * 1024 * 1024);
  const messages: AgentMessage[] = [{ role: "user", content: [
    { type: "text", text: "Compare both images" },
    { type: "image_url", image_url: { url: large }, constImage: { width, height, scale: 0.5 } },
    { type: "image_url", image_url: { url: large } },
  ] }];
  const originalHistory = JSON.stringify(messages);
  assert(Buffer.byteLength(originalHistory) > 4_500_000);
  const prepared = await createRequestPreparer(normalizeModelImage)({ messages }, {
    endpoint: "https://router.const.web.id/v1/chat/completions", runId: "native-media", signal: new AbortController().signal, limitBytes: CONST_REQUEST_BODY_BUDGET,
  });
  assert(prepared.diagnostics.requestBytes < CONST_REQUEST_BODY_BUDGET);
  assert.equal(prepared.diagnostics.imageCount, 2);
  const contents = JSON.parse(prepared.body).messages[0].content;
  assert.equal(contents.filter((part: any) => part.type === "image_url").length, 2);
  for (const part of contents.filter((part: any) => part.type === "image_url")) assert(!nativeImage.createFromDataURL(part.image_url.url).isEmpty());
  const firstImage = nativeImage.createFromDataURL(contents.find((part: any) => part.type === "image_url").image_url.url).getSize();
  assert(prepared.body.includes(`x by ${(width / firstImage.width / 0.5).toFixed(6)} and y by ${(height / firstImage.height / 0.5).toFixed(6)}`));
  assert.equal(JSON.stringify(messages), originalHistory);
  console.log(`PASS: two real PNGs (${Buffer.byteLength(originalHistory)} input bytes) fit in ${prepared.diagnostics.requestBytes} request bytes, with both images and coordinate mapping`);

  const originalFetch = globalThis.fetch;
  const bodies: string[] = [];
  const events: AgentEvent[] = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(String(init?.body));
    if (bodies.length === 1) return new Response("FUNCTION_PAYLOAD_TOO_LARGE", { status: 413 });
    return new Response('data: {"choices":[{"delta":{"content":"Visual check complete"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  };
  try {
    await new ConstAgent({ model: "fixture", baseUrl: "https://fixture.invalid/v1", apiKey: "", tools: [], inputTypes: ["text", "image"], normalizeImage: normalizeModelImage })
      .run(messages, event => events.push(event));
    assert.equal(bodies.length, 2);
    assert(Buffer.byteLength(bodies[1]!) < Buffer.byteLength(bodies[0]!));
    assert.equal(events.at(-1)?.type, "run_end");
    assert(events.some(event => event.type === "run_end" && event.outcome === "completed" && event.recovery === "payload"));
    console.log("PASS: real encoder reduces a 413 retry and completes without discarding either image");
  } finally { globalThis.fetch = originalFetch; }

  // Optional forensic fixtures from the incident; test success does not depend
  // on users' files being present on CI.
  if (process.env.CONST_PAYLOAD_INCIDENT_IMAGES) {
    for (const [index, file] of process.env.CONST_PAYLOAD_INCIDENT_IMAGES.split(path.delimiter).entries()) {
      const bytes = await readFile(file);
      const output = await normalizeModelImage(`data:image/png;base64,${bytes.toString("base64")}`, { maxBytes: 500 * 1024, maxDimension: 1568 }, new AbortController().signal);
      const image = nativeImage.createFromDataURL(output.dataUrl);
      assert(!image.isEmpty());
      await writeFile(path.join(process.env.CONST_PAYLOAD_PREVIEW_DIR || directory, `incident-${index}-model.png`), image.toPNG());
      console.log(`PASS: incident image ${index}: ${bytes.length} -> ${Buffer.from(output.dataUrl.split(",")[1]!, "base64").length} bytes (${output.width}x${output.height})`);
    }
  }
  if (process.env.CONST_PAYLOAD_PREVIEW_DIR) {
    await writeFile(path.join(process.env.CONST_PAYLOAD_PREVIEW_DIR, "text-grid-original.png"), original);
    await writeFile(path.join(process.env.CONST_PAYLOAD_PREVIEW_DIR, "text-grid-model.png"), decoded.toPNG());
  }
  window.destroy();
}
run().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
