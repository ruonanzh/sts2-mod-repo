import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = join(root, "reference", "example_potion");
const manifest = JSON.parse(readFileSync(join(mod, "ExamplePotion.json"), "utf8"));
const project = readFileSync(join(mod, "ExamplePotion.csproj"), "utf8");
const potion = readFileSync(join(mod, "AegisDraught.cs"), "utf8");
const entry = readFileSync(join(mod, "Entry.cs"), "utf8");
const english = JSON.parse(readFileSync(join(mod, "assets", "ExamplePotion", "localization", "eng", "potions.json"), "utf8"));
const chinese = JSON.parse(readFileSync(join(mod, "assets", "ExamplePotion", "localization", "zhs", "potions.json"), "utf8"));

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
const count = (text, pattern) => [...text.matchAll(pattern)].length;
assert.equal(count(entry, /ModTypeDiscoveryHub\.RegisterModAssembly\("ExamplePotion",\s*assembly\)/g), 1);
assert.equal(count(potion, /\[RegisterPotion\(/g), 1);
assert.equal(count(potion, /\[RegisterCharacterStarterPotion\(/g), 1);
assert.ok(potion.includes("RegisterPotion(typeof(IroncladPotionPool)"));
assert.ok(potion.includes("RegisterCharacterStarterPotion(typeof(Ironclad), 1)"));
assert.ok(potion.includes("FullPublicEntry = PublicEntry") && potion.includes("EXAMPLE_POTION_AEGIS_DRAUGHT"));
assert.ok(potion.includes("ModPotionTemplate") && potion.includes("PotionAssetProfile"));
assert.ok(potion.includes("PotionUsage.CombatOnly") && potion.includes("TargetType.AnyPlayer"));
assert.ok(potion.includes("PotionModel.AssertValidForTargetedPotion(target)"));
assert.ok(potion.includes("CreatureCmd.GainBlock") && potion.includes("BlockVar(6m, ValueProp.Unpowered)"));
assert.ok(!potion.includes("BaseLib") && !entry.includes("BaseLib"));
assert.deepEqual(english, {
  "EXAMPLE_POTION_AEGIS_DRAUGHT.title": "Aegis Draught",
  "EXAMPLE_POTION_AEGIS_DRAUGHT.description": "Gain {Block} Block.",
  "EXAMPLE_POTION_AEGIS_DRAUGHT.selectionScreenPrompt": "Choose a player to gain {Block} Block.",
});
assert.deepEqual(chinese, {
  "EXAMPLE_POTION_AEGIS_DRAUGHT.title": "庇护药剂",
  "EXAMPLE_POTION_AEGIS_DRAUGHT.description": "获得 {Block} 点格挡。",
  "EXAMPLE_POTION_AEGIS_DRAUGHT.selectionScreenPrompt": "选择一名玩家，使其获得 {Block} 点格挡。",
});

const output = execFileSync("bun", [
  "scripts/dev-harness.mjs", ".pi/extensions/mod-lint.ts", "validate_mod", '{"modDir":"reference/example_potion"}',
], { cwd: root, encoding: "utf8" });
assert.match(output, /PASS: example_potion is valid and compiled/);
assert.match(output, /"pckBuild": "passed"/);
assert.match(output, /"potionLocalization": "passed"/);
assert.match(output, /"potionCount": 1/);
const entries = readPckEntries(join(mod, "bin", "Release", "ExamplePotion.pck"));
const sourcePng = "ExamplePotion/images/potions/aegis_draught.png";
const digest = createHash("md5").update(`res://${sourcePng}`).digest("hex");
assert.ok(entries.has(`.godot/imported/aegis_draught.png-${digest}.ctex`));
assert.ok(entries.has(`${sourcePng}.import`));
assert.deepEqual(JSON.parse(entries.get("ExamplePotion/localization/eng/potions.json").toString("utf8")), english);
assert.deepEqual(JSON.parse(entries.get("ExamplePotion/localization/zhs/potions.json").toString("utf8")), chinese);
console.log("PASS: example_potion registers a pinned RitsuLib potion with exact art, text, and targeted Block");
