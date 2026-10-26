import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "bun:test";
import { cropCover, decodePng, encodePng, letterbox } from "./png.ts";

function fixture(width, height, alpha = 255) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = Math.round((x / Math.max(1, width - 1)) * 255);
      rgba[i + 1] = Math.round((y / Math.max(1, height - 1)) * 255);
      rgba[i + 2] = 40;
      rgba[i + 3] = alpha;
    }
  }
  return { width, height, rgba };
}

test("RGBA encode and decode preserve every pixel", () => {
  const source = fixture(37, 23, 128);
  const out = decodePng(encodePng(source));
  assert.equal(out.width, 37);
  assert.equal(out.height, 23);
  assert.ok(out.rgba.equals(source.rgba));
});

test("opaque encoding emits RGB and composites transparency onto the background", () => {
  const source = fixture(2, 1, 0);
  source.rgba[3] = 0;
  source.rgba[7] = 255;
  const encoded = encodePng(source, { opaque: true, background: "#102030" });
  assert.equal(encoded[25], 2);
  const out = decodePng(encoded);
  assert.deepEqual([...out.rgba.subarray(0, 4)], [0x10, 0x20, 0x30, 255]);
  assert.equal(out.rgba[7], 255);
});

test("an externally encoded game PNG decodes through real filter branches", () => {
  const file = new URL("../../reference/example_card/assets/ExampleCard/images/cards/focused_strike.png", import.meta.url);
  const out = decodePng(readFileSync(file));
  assert.equal(out.width, 512);
  assert.equal(out.height, 384);
  assert.equal(out.rgba.length, 512 * 384 * 4);
  assert.ok(out.rgba.some((value) => value !== 0));
});

test("cover and contain use premultiplied alpha at transparent edges", () => {
  const cover = { width: 2, height: 2, rgba: Buffer.from([
    255, 0, 0, 255, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]) };
  assert.deepEqual([...cropCover(cover, 1, 1).rgba], [255, 0, 0, 64]);
  const contain = { width: 2, height: 1, rgba: Buffer.from([255, 0, 0, 255, 0, 0, 0, 0]) };
  assert.deepEqual([...letterbox(contain, 1, 1).rgba], [255, 0, 0, 128]);
});

test("extreme aspect ratios cannot produce an empty cover crop", () => {
  const source = fixture(1, 100);
  const out = cropCover(source, 100, 1);
  assert.equal(out.rgba[3], 255);
});

test("an unused background does not invalidate RGBA output", () => {
  assert.doesNotThrow(() => encodePng(fixture(1, 1), { opaque: false, background: "transparent" }));
});

test("cover produces the accepted card size and preserves alpha", () => {
  const out = cropCover(fixture(400, 400, 128), 1000, 760);
  assert.equal(out.width, 1000);
  assert.equal(out.height, 760);
  assert.equal(out.rgba[3], 128);
  const middle = (380 * 1000 + 500) * 4;
  assert.ok(Math.abs(out.rgba[middle + 1] - 128) <= 2);
});

test("contain keeps the whole source and adds transparent bands", () => {
  const out = letterbox(fixture(200, 100), 200, 200);
  assert.equal(out.width, 200);
  assert.equal(out.height, 200);
  assert.equal(out.rgba[3], 0);
  assert.equal(out.rgba[(50 * 200 + 100) * 4 + 3], 255);
});

test("invalid images and excessive dimensions are refused", () => {
  assert.throws(() => decodePng(Buffer.from("not a png")), /not a PNG/);
  assert.throws(() => cropCover(fixture(2, 2), 5000, 5000), /excessive PNG dimensions/);
});

test("a full-size generated image fits a card without a long synchronous stall", () => {
  const started = performance.now();
  const out = cropCover(fixture(2048, 2048), 1000, 760);
  const elapsed = performance.now() - started;
  assert.equal(out.width, 1000);
  assert.equal(out.height, 760);
  assert.ok(elapsed < 2000, `crop took ${elapsed.toFixed(0)}ms`);
  console.log(`2048x2048 -> 1000x760 crop: ${elapsed.toFixed(0)}ms`);
});
