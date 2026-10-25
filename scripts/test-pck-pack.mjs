import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localDotnet = join(process.env.HOME ?? "", ".dotnet", "dotnet");
const dotnet = process.env.DOTNET ?? (existsSync(localDotnet) ? localDotnet : "dotnet");
const tmp = mkdtempSync(join(tmpdir(), "sts2-pck-pack-"));
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions++; };

function readPck(path) {
  const bytes = readFileSync(path);
  check(bytes.readUInt32LE(0) === 0x43504447, "PCK magic");
  check(bytes.readUInt32LE(4) === 3, "PCK format v3");
  check(bytes.readUInt32LE(8) === 4 && bytes.readUInt32LE(12) === 5 && bytes.readUInt32LE(16) === 1, "Godot 4.5.1");
  check(bytes.readUInt32LE(20) === 2, "file-base-relative offsets");
  const fileBase = Number(bytes.readBigUInt64LE(24));
  const dirOffset = Number(bytes.readBigUInt64LE(32));
  check(fileBase === 112, "file base 112");
  const count = bytes.readUInt32LE(dirOffset);
  let pos = dirOffset + 4;
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    const pathLength = bytes.readUInt32LE(pos); pos += 4;
    const entryPath = bytes.subarray(pos, pos + pathLength).toString("utf8").replace(/\0+$/u, ""); pos += pathLength;
    const offset = Number(bytes.readBigUInt64LE(pos)); pos += 8;
    const size = Number(bytes.readBigUInt64LE(pos)); pos += 8;
    const md5 = bytes.subarray(pos, pos + 16); pos += 16;
    const flags = bytes.readUInt32LE(pos); pos += 4;
    const data = bytes.subarray(fileBase + offset, fileBase + offset + size);
    check(data.length === size, `${entryPath}: size`);
    check(createHash("md5").update(data).digest().equals(md5), `${entryPath}: md5`);
    check(flags === 0, `${entryPath}: flags`);
    entries.set(entryPath, data);
  }
  check(pos === bytes.length, "directory ends at EOF");
  return { bytes, entries };
}

try {
  execFileSync(dotnet, ["build", join(repoRoot, "tools/pck-pack/PckPack.csproj"), "-c", "Release", "--nologo"], { stdio: "pipe" });
  const output = join(tmp, "probe.pck");
  const dll = join(repoRoot, "tools/pck-pack/bin/Release/net9.0/pck-pack.dll");
  execFileSync(dotnet, [dll, join(repoRoot, "reference/ritsulib_probe/assets"), output], { stdio: "pipe" });
  const first = readPck(output);

  const sourcePng = "RitsuR0Probe/images/cards/focused_strike.png";
  const digest = createHash("md5").update(`res://${sourcePng}`).digest("hex");
  const ctexPath = `.godot/imported/focused_strike.png-${digest}.ctex`;
  check(first.entries.size === 4, "two textures entries plus two localization files");
  check(!first.entries.has(sourcePng), "raw PNG is replaced by its imported pair");
  check(first.entries.has(`${sourcePng}.import`), "PNG import remap exists");
  check(first.entries.has(ctexPath), "CTEX path uses md5 of the res:// source path");
  check(first.entries.has("RitsuR0Probe/localization/eng/cards.json"), "English localization exists");
  check(first.entries.has("RitsuR0Probe/localization/zhs/cards.json"), "Chinese localization exists");

  const importText = first.entries.get(`${sourcePng}.import`).toString("utf8");
  check(importText.includes(`path="res://${ctexPath}"`), "import remap targets CTEX");
  const ctex = first.entries.get(ctexPath);
  check(ctex.subarray(0, 4).toString("ascii") === "GST2", "CTEX magic");
  check(ctex.readUInt32LE(4) === 1, "CTEX version");
  check(ctex.readUInt32LE(8) === 512 && ctex.readUInt32LE(12) === 384, "CTEX dimensions");
  check(ctex.readUInt32LE(36) === 1, "CTEX DATA_FORMAT_PNG");
  check(ctex.readUInt32LE(52) === ctex.length - 56, "CTEX payload size");
  check(ctex.subarray(56, 60).toString("ascii") === "PNG ", "Godot PNG unpack prefix");

  const secondOutput = join(tmp, "probe-second.pck");
  execFileSync(dotnet, [dll, join(repoRoot, "reference/ritsulib_probe/assets"), secondOutput], { stdio: "pipe" });
  const second = readPck(secondOutput);
  check(first.bytes.equals(second.bytes), "deterministic output");

  const badInput = join(tmp, "bad-input");
  mkdirSync(badInput);
  writeFileSync(join(badInput, "bad.png"), "not a png");
  const badOutput = join(tmp, "bad.pck");
  const bad = spawnSync(dotnet, [dll, badInput, badOutput], { encoding: "utf8" });
  check(bad.status === 1, "invalid PNG returns exit 1");
  check(bad.stderr.includes("not a PNG file"), "invalid PNG names the error");
  check(!existsSync(badOutput), "invalid PNG leaves no PCK");
  console.log(`PASS: pck-pack ${assertions} assertions; PCK and imported PNG are deterministic`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
