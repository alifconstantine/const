import assert from "node:assert/strict";
import test from "node:test";
import { checkAudioInputAvailable } from "./audio-devices";

test("checkAudioInputAvailable returns true only when getUserMedia exists and an audioinput device is present", async () => {
  const fakeGetUserMedia = async () => ({} as MediaStream);

  assert.equal(await checkAudioInputAvailable(undefined), false);
  assert.equal(await checkAudioInputAvailable({}), false);
  assert.equal(
    await checkAudioInputAvailable({
      getUserMedia: fakeGetUserMedia,
      enumerateDevices: async () => [{ kind: "audiooutput" }, { kind: "videoinput" }],
    }),
    false,
  );
  assert.equal(
    await checkAudioInputAvailable({
      getUserMedia: fakeGetUserMedia,
      enumerateDevices: async () => [{ kind: "audiooutput" }, { kind: "audioinput" }],
    }),
    true,
  );
  assert.equal(
    await checkAudioInputAvailable({
      getUserMedia: fakeGetUserMedia,
      enumerateDevices: async () => {
        throw new Error("device enumeration blocked");
      },
    }),
    false,
  );
});
