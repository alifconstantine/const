import assert from "node:assert/strict";
import test from "node:test";
import { concatFloat32Chunks, encodePcmToWavBase64, transcribeAudioAttachments } from "./voice-dictation.js";

test("concatFloat32Chunks and encodePcmToWavBase64 produce a valid 16kHz mono WAV container", () => {
  const merged = concatFloat32Chunks([
    new Float32Array([0, 0.5, -0.5]),
    new Float32Array([1, -1]),
  ]);
  assert.equal(merged.length, 5);

  const b64 = encodePcmToWavBase64(merged, 16000);
  const bytes = Buffer.from(b64, "base64");
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WAVE");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "fmt ");
  assert.equal(bytes.readUInt16LE(20), 1); // PCM
  assert.equal(bytes.readUInt16LE(22), 1); // Mono
  assert.equal(bytes.readUInt32LE(24), 16000); // Sample rate
  assert.equal(bytes.subarray(36, 40).toString("ascii"), "data");
  assert.equal(bytes.readUInt32LE(40), 10); // 5 samples * 2 bytes
  assert.equal(bytes.length, 54);
});

test("transcribeAudioAttachments populates missing textContent via desktop STT bridge", async () => {
  const prevWindow = (globalThis as any).window;
  const calls: Array<{ filePath?: string; audioBase64?: string; filename?: string; authToken?: string }> = [];
  (globalThis as any).window = {
    electron: {
      stt: {
        transcribe: async (payload: any) => {
          calls.push(payload);
          if (payload.filename === "fail.wav") return { success: false, error: "network" };
          return { success: true, text: `transcribed:${payload.filename}` };
        },
      },
    },
  };

  try {
    const res = await transcribeAudioAttachments(
      [
        { name: "clip.mp3", type: "audio", path: "/tmp/clip.mp3" },
        { name: "memo.wav", type: "audio", base64: "AAAA" },
        { name: "already.mp3", type: "audio", path: "/tmp/already.mp3", textContent: "existing" },
        { name: "fail.wav", type: "audio", path: "/tmp/fail.wav" },
        { name: "pic.png", type: "image", path: "/tmp/pic.png" },
      ],
      "tok-123",
    );

    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], {
      filePath: "/tmp/clip.mp3",
      audioBase64: undefined,
      filename: "clip.mp3",
      authToken: "tok-123",
    });
    assert.deepEqual(calls[1], {
      filePath: undefined,
      audioBase64: "AAAA",
      filename: "memo.wav",
      authToken: "tok-123",
    });
    assert.equal(res?.[0]?.textContent, "transcribed:clip.mp3");
    assert.equal(res?.[1]?.textContent, "transcribed:memo.wav");
    assert.equal(res?.[2]?.textContent, "existing");
    assert.equal(res?.[3]?.textContent, undefined);
    assert.equal(res?.[4]?.textContent, undefined);
  } finally {
    (globalThis as any).window = prevWindow;
  }
});
