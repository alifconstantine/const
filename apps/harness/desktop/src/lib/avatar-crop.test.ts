import { strict as assert } from "node:assert";
import { test } from "node:test";
import { avatarCropRect } from "./avatar-crop";

test("portrait and landscape photos start with a centered square", () => {
  assert.deepEqual(avatarCropRect(1200, 800, 1, { x: 0, y: 0 }), {
    x: 200,
    y: 0,
    side: 800,
  });
  assert.deepEqual(avatarCropRect(800, 1200, 1, { x: 0, y: 0 }), {
    x: 0,
    y: 200,
    side: 800,
  });
});

test("zoom and pan select the same source rectangle as the preview", () => {
  assert.deepEqual(avatarCropRect(1200, 800, 2, { x: 1, y: -1 }), {
    x: 0,
    y: 400,
    side: 400,
  });
  assert.deepEqual(avatarCropRect(800, 800, 2, { x: -1, y: 1 }), {
    x: 400,
    y: 0,
    side: 400,
  });
});

test("crop stays within image bounds at every supported zoom and position", () => {
  for (const [width, height] of [
    [1600, 300],
    [300, 1600],
    [800, 800],
  ]) {
    for (const zoom of [1, 1.01, 1.5, 2, 3]) {
      for (const x of [-2, -1, -0.4, 0, 1, 2]) {
        for (const y of [-2, -1, -0.4, 0, 1, 2]) {
          const crop = avatarCropRect(width!, height!, zoom, { x, y });
          assert.ok(crop.x >= 0 && crop.y >= 0);
          assert.ok(crop.x + crop.side <= width! + 1e-8);
          assert.ok(crop.y + crop.side <= height! + 1e-8);
        }
      }
    }
  }
});
