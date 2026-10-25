import assert from "node:assert/strict";
import { test } from "bun:test";
import { normalizePublicStem, standaloneModelId } from "./ritsulib-ids.ts";

test("normalizePublicStem matches RitsuLib boundaries and punctuation", () => {
  assert.equal(normalizePublicStem("ExamplePower"), "EXAMPLE_POWER");
  assert.equal(normalizePublicStem("myMod"), "MY_MOD");
  assert.equal(normalizePublicStem("HTTPPower"), "HTTP_POWER");
  assert.equal(normalizePublicStem("EXAMPLECARD-FOCUSEDSTRIKE"), "EXAMPLECARD_FOCUSEDSTRIKE");
  assert.equal(normalizePublicStem("  already__normalized  "), "ALREADY_NORMALIZED");
});

test("standaloneModelId includes mod, category, and type", () => {
  assert.equal(standaloneModelId("ExamplePower", "power", "Momentum"), "EXAMPLE_POWER_POWER_MOMENTUM");
  assert.equal(standaloneModelId("ExampleRelic", "relic", "AegisShard"), "EXAMPLE_RELIC_RELIC_AEGIS_SHARD");
});

test("normalizePublicStem rejects empty segments", () => {
  assert.throws(() => normalizePublicStem("  "), /EMPTY_PUBLIC_STEM/);
});
