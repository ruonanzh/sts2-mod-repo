import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "bun:test";
import { checkModelLocalization } from "./model-localization.ts";

const dirs = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

function fixture({ kind = "power", source = "[RegisterPower]\npublic sealed class Momentum : ModPowerTemplate {}", tables = { eng: {} } }) {
  const root = mkdtempSync(join(tmpdir(), "model-loc-"));
  dirs.push(root);
  writeFileSync(join(root, "Model.cs"), source);
  for (const [lang, content] of Object.entries(tables)) {
    const dir = join(root, "assets", "ExamplePower", "localization", lang);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${kind}s.json`), typeof content === "string" ? content : JSON.stringify(content));
  }
  return { root, kind };
}

const powerText = {
  "EXAMPLE_POWER_POWER_MOMENTUM.title": "Momentum",
  "EXAMPLE_POWER_POWER_MOMENTUM.description": "Gain Block.",
};

test("one complete language is enough and extra vanilla keys are allowed", () => {
  const { root, kind } = fixture({ tables: { zhs: { ...powerText, "STRENGTH.title": "Strength" } } });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "passed");
  assert.equal(result.models.length, 1);
});

test("a type-only key fails with the computed full ID", () => {
  const { root, kind } = fixture({ tables: { eng: { "MOMENTUM.title": "Momentum" } } });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "failed");
  assert.deepEqual(result.missing, [{ typeName: "Momentum", expectedId: "EXAMPLE_POWER_POWER_MOMENTUM" }]);
});

test("Content Pack registration without a table is not claimed as checked", () => {
  const { root, kind } = fixture({ source: "builder.Power<Momentum>();", tables: {} });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "not-checked");
  assert.equal(result.hasTable, false);
});

test("inherited registration without a table is not claimed as checked", () => {
  const { root, kind } = fixture({
    source: "[RegisterPower]\npublic abstract class BasePower : ModPowerTemplate {}\npublic sealed class Momentum : BasePower {}",
    tables: {},
  });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "not-checked");
});

test("no registration and no table is not required", () => {
  const { root, kind } = fixture({ source: "public sealed class Plain {}", tables: {} });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "not-required");
});

test("malformed model JSON fails instead of disappearing", () => {
  const { root, kind } = fixture({ tables: { eng: "{bad json" } });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "failed");
  assert.deepEqual(result.invalidJson, ["eng/powers.json"]);
});

test("null and primitive roots fail without throwing", () => {
  for (const value of [null, 1]) {
    const { root, kind } = fixture({ tables: { eng: value } });
    const result = checkModelLocalization(root, "ExamplePower", kind);
    assert.equal(result.status, "failed");
    assert.deepEqual(result.invalidJson, ["eng/powers.json"]);
  }
});

test("a card resolves FullPublicEntry through its string constant", () => {
  const { root, kind } = fixture({
    kind: "card",
    source: '[RegisterCard(typeof(IroncladCardPool), FullPublicEntry = PublicEntry)]\npublic sealed class FocusedStrike { public const string PublicEntry = "EXAMPLE_CARD_FOCUSED_STRIKE"; }',
    tables: { eng: {
      "EXAMPLE_CARD_FOCUSED_STRIKE.title": "Focused Strike",
      "EXAMPLE_CARD_FOCUSED_STRIKE.description": "Deal damage.",
    } },
  });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "passed");
  assert.equal(result.models[0].expectedId, "EXAMPLE_CARD_FOCUSED_STRIKE");
});

test("a card without an explicit entry uses mod, category, and type", () => {
  const { root, kind } = fixture({
    kind: "card",
    source: "[RegisterCard(typeof(IroncladCardPool))]\npublic sealed class FocusedStrike {}",
  });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.models[0].expectedId, "EXAMPLE_POWER_CARD_FOCUSED_STRIKE");
});

test("StableEntryStem uses the qualified stem", () => {
  const { root, kind } = fixture({
    kind: "card",
    source: '[RegisterCard(typeof(IroncladCardPool), StableEntryStem = "focused_strike")]\npublic sealed class FocusedStrike {}',
  });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.models[0].expectedId, "EXAMPLE_POWER_CARD_FOCUSED_STRIKE");
});

test("StableEntryStem and FullPublicEntry together fail", () => {
  const { root, kind } = fixture({
    kind: "card",
    source: '[RegisterCard(typeof(IroncladCardPool), StableEntryStem = "x", FullPublicEntry = "Y")]\npublic sealed class Example {}',
  });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "failed");
  assert.equal(result.invalid.length, 1);
});

test("an unresolved entry constant is not claimed as checked", () => {
  const { root, kind } = fixture({
    kind: "card",
    source: "[RegisterCard(typeof(IroncladCardPool), FullPublicEntry = ExternalEntry)]\npublic sealed class Example {}",
  });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "not-checked");
  assert.equal(result.unresolved.length, 1);
});

test("nameof and concatenated entry expressions are not checked", () => {
  for (const expression of ["nameof(AegisShard)", '"a" + "b"']) {
    const { root, kind } = fixture({
      kind: "card",
      source: `[RegisterCard(typeof(IroncladCardPool), FullPublicEntry = ${expression})]\npublic sealed class AegisShard {}`,
      tables: {},
    });
    const result = checkModelLocalization(root, "ExamplePower", kind);
    assert.equal(result.status, "not-checked");
    assert.equal(result.models.length, 0);
    assert.equal(result.unresolved.length, 1);
  }
});

test("three cards, one power, and two relics are checked independently", () => {
  const source = [
    "[RegisterCard(typeof(Pool))] public sealed class CardOne {}",
    "[RegisterCard(typeof(Pool))] public sealed class CardTwo {}",
    "[RegisterCard(typeof(Pool))] public sealed class CardThree {}",
    "[RegisterPower] public sealed class Momentum {}",
    "[RegisterRelic(typeof(Pool))] public sealed class RelicOne {}",
    "[RegisterRelic(typeof(Pool))] public sealed class RelicTwo {}",
  ].join("\n");
  const entries = (kind, names) => Object.fromEntries(names.flatMap((name) => [
    [`EXAMPLE_POWER_${kind.toUpperCase()}_${name}.title`, name],
    [`EXAMPLE_POWER_${kind.toUpperCase()}_${name}.description`, "Text"],
  ]));
  const { root } = fixture({ source, tables: {} });
  const base = join(root, "assets", "ExamplePower", "localization", "eng");
  mkdirSync(base, { recursive: true });
  const tables = {
    "cards.json": entries("card", ["CARD_ONE", "CARD_TWO", "CARD_THREE"]),
    "powers.json": entries("power", ["MOMENTUM"]),
    "relics.json": entries("relic", ["RELIC_ONE", "RELIC_TWO"]),
  };
  for (const [file, table] of Object.entries(tables)) writeFileSync(join(base, file), JSON.stringify(table));
  for (const [kind, count] of [["card", 3], ["power", 1], ["relic", 2]]) {
    const result = checkModelLocalization(root, "ExamplePower", kind);
    assert.equal(result.status, "passed");
    assert.equal(result.models.length, count);
  }
  delete tables["cards.json"]["EXAMPLE_POWER_CARD_CARD_TWO.description"];
  writeFileSync(join(base, "cards.json"), JSON.stringify(tables["cards.json"]));
  const missing = checkModelLocalization(root, "ExamplePower", "card");
  assert.equal(missing.status, "failed");
  assert.equal(missing.missing[0].expectedId, "EXAMPLE_POWER_CARD_CARD_TWO");
});

test("a relic uses the same localization checks", () => {
  const { root, kind } = fixture({
    kind: "relic",
    source: '[RegisterRelic(typeof(IroncladRelicPool), FullPublicEntry = "EXAMPLE_RELIC_AEGIS_SHARD")]\npublic sealed class AegisShard {}',
    tables: { eng: {
      "EXAMPLE_RELIC_AEGIS_SHARD.title": "Aegis Shard",
      "EXAMPLE_RELIC_AEGIS_SHARD.description": "Gain Block.",
    } },
  });
  const result = checkModelLocalization(root, "ExamplePower", kind);
  assert.equal(result.status, "passed");
});
