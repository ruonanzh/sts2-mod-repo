import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "mod-repo.json"), "utf8"));
const pkg = config.compile.packages[0];
const runtime = config.runtimeDependencies.find((entry) => entry.id === pkg.runtimeId);
assert.ok(runtime, "compile package runtimeId has a runtime dependency");
assert.equal(pkg.version, runtime.version, "compile and runtime versions agree");
const manifestPath = join(root, runtime.vendorDir, "mod_manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.id, runtime.id, "vendor manifest id agrees");
assert.equal(manifest.version, runtime.version, "vendor manifest version agrees");
assert.equal(pkg.id, `STS2.RitsuLib.Compat.${manifest.min_game_version}`, "compat package matches the vendor game API");
for (const assembly of pkg.assemblies) {
  const candidates = [
    join(root, runtime.vendorDir, "compat", manifest.min_game_version, assembly),
    join(root, runtime.vendorDir, "shared", assembly),
  ];
  assert.ok(candidates.some((path) => existsSync(path)), `vendor contains ${assembly}`);
}
const dump = JSON.parse(readFileSync(join(root, ".pi/lib/decompile.json"), "utf8"));
for (const [key, path] of Object.entries(dump.dump.paths)) {
  assert.ok(dump.dump.assemblies.includes(key), `dump includes ${key}`);
  assert.ok(existsSync(join(root, path)), `dump source exists: ${path}`);
}
console.log(`PASS: RitsuLib contract ${pkg.id}@${pkg.version}, ${pkg.assemblies.length} assemblies, vendor and dump agree`);
