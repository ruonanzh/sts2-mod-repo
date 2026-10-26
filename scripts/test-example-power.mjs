import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = join(root, "reference", "example_power");
const manifest = JSON.parse(readFileSync(join(mod, "ExamplePower.json"), "utf8"));
const project = readFileSync(join(mod, "ExamplePower.csproj"), "utf8");
const power = readFileSync(join(mod, "Momentum.cs"), "utf8");
const card = readFileSync(join(mod, "BuildMomentum.cs"), "utf8");
const englishCards = JSON.parse(readFileSync(join(mod, "assets", "ExamplePower", "localization", "eng", "cards.json"), "utf8"));
const chineseCards = JSON.parse(readFileSync(join(mod, "assets", "ExamplePower", "localization", "zhs", "cards.json"), "utf8"));
const englishPowers = JSON.parse(readFileSync(join(mod, "assets", "ExamplePower", "localization", "eng", "powers.json"), "utf8"));
const chinesePowers = JSON.parse(readFileSync(join(mod, "assets", "ExamplePower", "localization", "zhs", "powers.json"), "utf8"));

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
assert.equal(manifest.has_pck, true);
assert.deepEqual(manifest.dependencies, [{ id: "STS2-RitsuLib", min_version: "0.6.10" }]);
assert.ok(power.includes("[RegisterPower]") && power.includes("ModPowerTemplate"));
assert.ok(!power.includes("FullPublicEntry"), "standalone RegisterPower uses the type-derived id");
assert.ok(power.includes("PowerType.Buff") && power.includes("PowerStackType.Counter"));
assert.ok(power.includes("AfterCardPlayed") && power.includes("CreatureCmd.GainBlock"));
assert.ok(card.includes("PowerCmd.Apply<Momentum>") && card.includes("DynamicVars[\"Power\"].UpgradeValueBy(1m)"));
assert.deepEqual(englishPowers, {
  "EXAMPLE_POWER_POWER_MOMENTUM.title": "Momentum",
  "EXAMPLE_POWER_POWER_MOMENTUM.description": "Whenever you play an Attack, gain {Amount} Block.",
});
assert.deepEqual(chinesePowers, {
  "EXAMPLE_POWER_POWER_MOMENTUM.title": "势头",
  "EXAMPLE_POWER_POWER_MOMENTUM.description": "每打出一张攻击牌，获得 {Amount} 点格挡。",
});

for (const [file, width, height, colorType] of [["momentum.png", 128, 128, 6], ["momentum_big.png", 256, 256, 6]]) {
  const png = readFileSync(join(mod, "assets", "ExamplePower", "images", "powers", file));
  assert.equal(png.readUInt32BE(16), width);
  assert.equal(png.readUInt32BE(20), height);
  assert.equal(png[25], colorType);
}
const cardPng = readFileSync(join(mod, "assets", "ExamplePower", "images", "cards", "build_momentum.png"));
assert.equal(cardPng[25], 2);

const output = execFileSync("bun", [
  "scripts/dev-harness.mjs", ".pi/extensions/mod-lint.ts", "validate_mod", '{"modDir":"reference/example_power"}',
], { cwd: root, encoding: "utf8" });
assert.match(output, /PASS: example_power is valid and compiled/);
assert.match(output, /"pckBuild": "passed"/);
const entries = readPckEntries(join(mod, "bin", "Release", "ExamplePower.pck"));
assert.ok(power.includes("momentum_big.png"));
for (const sourcePng of ["ExamplePower/images/cards/build_momentum.png", "ExamplePower/images/powers/momentum.png", "ExamplePower/images/powers/momentum_big.png"]) {
  const digest = createHash("md5").update(`res://${sourcePng}`).digest("hex");
  const leaf = sourcePng.split("/").at(-1);
  assert.ok(entries.has(`.godot/imported/${leaf}-${digest}.ctex`));
  assert.ok(entries.has(`${sourcePng}.import`));
}
assert.deepEqual(JSON.parse(entries.get("ExamplePower/localization/eng/cards.json").toString("utf8")), englishCards);
assert.deepEqual(JSON.parse(entries.get("ExamplePower/localization/zhs/cards.json").toString("utf8")), chineseCards);
assert.deepEqual(JSON.parse(entries.get("ExamplePower/localization/eng/powers.json").toString("utf8")), englishPowers);
assert.deepEqual(JSON.parse(entries.get("ExamplePower/localization/zhs/powers.json").toString("utf8")), chinesePowers);
console.log("PASS: example_power registers and applies a stacked power with exact art, text, and attack-triggered Block");
