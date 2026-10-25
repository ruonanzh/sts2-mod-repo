import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = join(root, "reference", "example_relic");
const manifest = JSON.parse(readFileSync(join(mod, "ExampleRelic.json"), "utf8"));
const project = readFileSync(join(mod, "ExampleRelic.csproj"), "utf8");
const relic = readFileSync(join(mod, "AegisShard.cs"), "utf8");
const entry = readFileSync(join(mod, "Entry.cs"), "utf8");
const starter = readFileSync(join(mod, "StartingRelicPatch.cs"), "utf8");
const english = JSON.parse(readFileSync(join(mod, "assets", "ExampleRelic", "localization", "eng", "relics.json"), "utf8"));
const chinese = JSON.parse(readFileSync(join(mod, "assets", "ExampleRelic", "localization", "zhs", "relics.json"), "utf8"));

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
assert.ok(relic.includes("RegisterRelic(typeof(IroncladRelicPool)"));
assert.ok(relic.includes("FullPublicEntry = PublicEntry") && relic.includes("EXAMPLE_RELIC_AEGIS_SHARD"));
assert.ok(relic.includes("ModRelicTemplate") && relic.includes("RelicAssetProfile"));
assert.ok(relic.includes("BeforeCombatStart") && relic.includes("CreatureCmd.GainBlock"));
assert.ok(relic.includes("BlockVar(4m, ValueProp.Unpowered)"));
assert.ok(starter.includes("Ironclad.StartingRelics") && starter.includes("ModelDb.Relic<AegisShard>()"));
assert.ok(!relic.includes("BaseLib") && !entry.includes("BaseLib"));
assert.deepEqual(english, {
  "EXAMPLE_RELIC_AEGIS_SHARD.title": "Aegis Shard",
  "EXAMPLE_RELIC_AEGIS_SHARD.description": "At the start of combat, gain {Block} Block.",
});
assert.deepEqual(chinese, {
  "EXAMPLE_RELIC_AEGIS_SHARD.title": "庇护碎片",
  "EXAMPLE_RELIC_AEGIS_SHARD.description": "战斗开始时，获得 {Block} 点格挡。",
});

const output = execFileSync("bun", [
  "scripts/dev-harness.mjs", ".pi/extensions/mod-lint.ts", "validate_mod", '{"modDir":"reference/example_relic"}',
], { cwd: root, encoding: "utf8" });
assert.match(output, /PASS: example_relic is valid and compiled/);
assert.match(output, /"pckBuild": "passed"/);
const entries = readPckEntries(join(mod, "bin", "Release", "ExampleRelic.pck"));
const sourcePng = "ExampleRelic/images/relics/aegis_shard.png";
const digest = createHash("md5").update(`res://${sourcePng}`).digest("hex");
assert.ok(entries.has(`.godot/imported/aegis_shard.png-${digest}.ctex`));
assert.ok(entries.has(`${sourcePng}.import`));
assert.deepEqual(JSON.parse(entries.get("ExampleRelic/localization/eng/relics.json").toString("utf8")), english);
assert.deepEqual(JSON.parse(entries.get("ExampleRelic/localization/zhs/relics.json").toString("utf8")), chinese);
console.log("PASS: example_relic registers a pinned RitsuLib relic with exact art, text, and combat-start Block");
