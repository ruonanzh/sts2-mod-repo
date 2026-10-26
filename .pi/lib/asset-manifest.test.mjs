import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "bun:test";
import {
  MANIFEST_FILE,
  appendManifest,
  manifestRec,
  modRootOf,
  nowLocal,
  relToModRoot,
} from "./asset-manifest.ts";

const dirs = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "asset-manifest-"));
  dirs.push(dir);
  return dir;
}

const base = {
  endpoint: "/v3/generation/text-to-image",
  name: "preview",
  request_id: "task-1",
  parent_request_id: null,
  seed: null,
  files: [".preview/preview.png"],
  input: { prompt: "player style", output_format: "png" },
};

test("mod root and relative paths cover previews, direct files, and outside outputs", () => {
  const root = tempDir();
  const mod = join(root, "your_mods", "demo");
  assert.equal(modRootOf(root, join(mod, ".preview", "card.png")), mod);
  assert.equal(modRootOf(root, join(root, "your_mods", "card.png")), join(root, "your_mods"));
  assert.equal(modRootOf(root, join(root, "outside", "card.png")), join(root, "outside"));
  assert.equal(relToModRoot(mod, join(mod, ".preview", "card.png")), ".preview/card.png");
});

test("the record keeps the Duckov field contract and local timestamp", () => {
  const rec = manifestRec(base);
  assert.deepEqual(Object.keys(rec), ["t", "provider", "endpoint", "name", "request_id", "parent_request_id", "seed", "files", "input"]);
  assert.equal(rec.provider, "tripo");
  assert.equal("error" in rec, false);
  assert.match(rec.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  assert.equal(nowLocal(new Date(2026, 0, 2, 3, 4, 5)), "2026-01-02T03:04:05");
  const failure = manifestRec({ ...base, files: [], error: "DOWNLOAD_FAILED" });
  assert.equal(failure.error, "DOWNLOAD_FAILED");
});

test("append writes one UTF-8 JSON object per line without splitting prompts", () => {
  const root = tempDir();
  appendManifest(root, manifestRec(base));
  appendManifest(root, manifestRec({ ...base, input: { prompt: "first line\n第二行" } }));
  const lines = readFileSync(join(root, MANIFEST_FILE), "utf8").trimEnd().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => JSON.parse(line).request_id), ["task-1", "task-1"]);
  assert.equal(JSON.parse(lines[1]).input.prompt, "first line\n第二行");
});

test("a manifest write failure returns a warning instead of throwing", () => {
  const root = tempDir();
  const blocker = join(root, "blocker");
  writeFileSync(blocker, "file");
  const warning = appendManifest(join(blocker, "child"), manifestRec(base));
  assert.match(warning, /could not write asset_manifest.jsonl/);
  assert.equal(existsSync(join(blocker, "child")), false);
});

test("an existing manifest directory is reused", () => {
  const root = tempDir();
  mkdirSync(root, { recursive: true });
  assert.equal(appendManifest(root, manifestRec(base)), null);
});
