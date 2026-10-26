import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = join(root, "reference", "example_card");
const manifest = JSON.parse(readFileSync(join(mod, "ExampleCard.json"), "utf8"));
const project = readFileSync(join(mod, "ExampleCard.csproj"), "utf8");
const card = readFileSync(join(mod, "FocusedStrike.cs"), "utf8");
const entry = readFileSync(join(mod, "Entry.cs"), "utf8");
const english = JSON.parse(readFileSync(join(mod, "assets", "ExampleCard", "localization", "eng", "cards.json"), "utf8"));
const chinese = JSON.parse(readFileSync(join(mod, "assets", "ExampleCard", "localization", "zhs", "cards.json"), "utf8"));

function readPckEntries(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt32LE(0), 0x43504447);
  const fileBase = Number(bytes.readBigUInt64LE(24));
  const dirOffset = Number(bytes.readBigUInt64LE(32));
  const count = bytes.readUInt32LE(dirOffset);
  let pos = dirOffset + 4;
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    const length = bytes.readUInt32LE(pos); pos += 4;
    const name = bytes.subarray(pos, pos + length).toString("utf8").replace(/\0+$/u, ""); pos += length;
    const offset = Number(bytes.readBigUInt64LE(pos)); pos += 8;
    const size = Number(bytes.readBigUInt64LE(pos)); pos += 8;
    pos += 16;
    const flags = bytes.readUInt32LE(pos); pos += 4;
    assert.equal(flags, 0);
    entries.set(name, bytes.subarray(fileBase + offset, fileBase + offset + size));
  }
  assert.equal(pos, bytes.length);
  return entries;
}

assert.ok(project.includes("STS2.RitsuLib.Compat.0.107.1") && project.includes("Version=\"0.6.10\""));
assert.ok(!project.includes("Alchyr.Sts2.BaseLib"));
assert.equal(manifest.has_pck, true);
assert.deepEqual(manifest.dependencies, [{ id: "STS2-RitsuLib", min_version: "0.6.10" }]);
assert.ok(card.includes('FullPublicEntry = PublicEntry') && card.includes('EXAMPLE_CARD_FOCUSED_STRIKE'));
assert.ok(card.includes("ModCardTemplate") && card.includes("CardAssetProfile") && card.includes("DamageCmd.Attack"));
assert.ok(!card.includes("BaseLib") && !entry.includes("BaseLib"));
assert.deepEqual(english, {
  "EXAMPLE_CARD_FOCUSED_STRIKE.title": "Focused Strike",
  "EXAMPLE_CARD_FOCUSED_STRIKE.description": "Deal {Damage} damage.",
});
assert.deepEqual(chinese, {
  "EXAMPLE_CARD_FOCUSED_STRIKE.title": "精准打击",
  "EXAMPLE_CARD_FOCUSED_STRIKE.description": "造成 {Damage} 点伤害。",
});

const cardPng = readFileSync(join(mod, "assets", "ExampleCard", "images", "cards", "focused_strike.png"));
assert.equal(cardPng[25], 2);

const output = execFileSync("bun", [
  "scripts/dev-harness.mjs", ".pi/extensions/mod-lint.ts", "validate_mod", '{"modDir":"reference/example_card"}',
], { cwd: root, encoding: "utf8" });
assert.match(output, /PASS: example_card is valid and compiled/);
assert.match(output, /"pckBuild": "passed"/);
const entries = readPckEntries(join(mod, "bin", "Release", "ExampleCard.pck"));
const sourcePng = "ExampleCard/images/cards/focused_strike.png";
const digest = createHash("md5").update(`res://${sourcePng}`).digest("hex");
assert.ok(entries.has(`.godot/imported/focused_strike.png-${digest}.ctex`));
assert.ok(entries.has(`${sourcePng}.import`));
assert.deepEqual(JSON.parse(entries.get("ExampleCard/localization/eng/cards.json").toString("utf8")), english);
assert.deepEqual(JSON.parse(entries.get("ExampleCard/localization/zhs/cards.json").toString("utf8")), chinese);
console.log("PASS: example_card uses pinned RitsuLib, exact packaged art/localization, native combat, and passes validate_mod");
