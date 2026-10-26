import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { fitImage } from "../.pi/lib/image-2d.ts";
import { encodePng } from "../.pi/lib/png.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localDotnet = join(process.env.HOME ?? "", ".dotnet", "dotnet");
const dotnet = process.env.DOTNET ?? (existsSync(localDotnet) ? localDotnet : "dotnet");
const tmp = mkdtempSync(join(tmpdir(), "sts2-image-pck-"));

function readPckEntries(file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.readUInt32LE(0), 0x43504447);
  const fileBase = Number(bytes.readBigUInt64LE(24));
  const dirOffset = Number(bytes.readBigUInt64LE(32));
  const count = bytes.readUInt32LE(dirOffset);
  let pos = dirOffset + 4;
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    const length = bytes.readUInt32LE(pos); pos += 4;
    const name = bytes.subarray(pos, pos + length).toString("utf8").replace(/\0+$/u, ""); pos += length;
    const offset = Number(bytes.readBigUInt64LE(pos)); pos += 8;
    const size = Number(bytes.readBigUInt64LE(pos)); pos += 8;
    pos += 20;
    entries.set(name, bytes.subarray(fileBase + offset, fileBase + offset + size));
  }
  assert.equal(pos, bytes.length);
  return entries;
}

try {
  const source = join(tmp, "source.png");
  const rgba = Buffer.alloc(2048 * 2048 * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 180;
    rgba[i + 1] = 220;
    rgba[i + 2] = 80;
    rgba[i + 3] = 128;
  }
  writeFileSync(source, encodePng({ width: 2048, height: 2048, rgba }));
  const assets = join(tmp, "assets");
  const card = join(assets, "ImageContract", "images", "cards", "card.png");
  const icon = join(assets, "ImageContract", "images", "powers", "icon.png");
  mkdirSync(dirname(card), { recursive: true });
  mkdirSync(dirname(icon), { recursive: true });
  await fitImage({ inFile: source, outFile: card, width: 1000, height: 760, outputAlpha: "opaque" });
  await fitImage({ inFile: source, outFile: icon, width: 128, height: 128, outputAlpha: "preserve" });
  assert.equal(readFileSync(card)[25], 2);
  assert.equal(readFileSync(icon)[25], 6);

  execFileSync(dotnet, ["build", join(root, "tools/pck-pack/PckPack.csproj"), "-c", "Release", "--nologo"], { stdio: "pipe" });
  const output = join(tmp, "image-contract.pck");
  execFileSync(dotnet, [join(root, "tools/pck-pack/bin/Release/net9.0/pck-pack.dll"), assets, output], { stdio: "pipe" });
  const entries = readPckEntries(output);
  for (const [sourcePath, width, height, format] of [
    ["ImageContract/images/cards/card.png", 1000, 760, 4],
    ["ImageContract/images/powers/icon.png", 128, 128, 5],
  ]) {
    const digest = createHash("md5").update(`res://${sourcePath}`).digest("hex");
    const ctex = entries.get(`.godot/imported/${sourcePath.split("/").at(-1)}-${digest}.ctex`);
    assert.ok(ctex, `${sourcePath} CTEX exists`);
    assert.equal(ctex.readUInt32LE(8), width);
    assert.equal(ctex.readUInt32LE(12), height);
    assert.equal(ctex.readUInt32LE(48), format);
    assert.ok(entries.has(`${sourcePath}.import`));
    assert.ok(!entries.has(sourcePath));
  }
  console.log("PASS: fit outputs RGB card art and RGBA icons with exact PCK CTEX dimensions");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
