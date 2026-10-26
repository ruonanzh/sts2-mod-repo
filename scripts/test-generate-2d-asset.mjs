import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { encodePng } from "../.pi/lib/png.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = mkdtempSync(join(tmpdir(), "sts2-image-tool-"));
execFileSync("bun", ["scripts/dev-harness.mjs", ".pi/extensions/generate-2d-asset.ts"], { cwd: root });
const { default: register } = await import("../.pi/extensions/generate-2d-asset.ts");
let tool;
register({ registerTool(definition) { tool = definition; } });
assert.equal(tool.name, "generate_2d_asset");
const execute = (params) => tool.execute("test", params, new AbortController().signal, undefined, { cwd });
const text = (result) => result.content.map((item) => item.text).join("\n");
const source = Buffer.from(encodePng({
  width: 32,
  height: 32,
  rgba: Buffer.alloc(32 * 32 * 4, 200),
}));
const oldFetch = globalThis.fetch;
const oldKey = process.env.TRIPO_API_KEY;

try {
  writeFileSync(join(cwd, "source.png"), source);
  const fit = await execute({ action: "fit", in: "source.png", out: "card.png", width: 100, height: 76, outputAlpha: "opaque" });
  assert.match(text(fit), /PASS: .*card.png written at 100x76/);
  assert.equal(readFileSync(join(cwd, "card.png"))[25], 2);

  const warning = await execute({ action: "check", file: "card.png", width: 100, height: 76, alpha: "prefer" });
  assert.match(text(warning), /WARN: ALPHA_RECOMMENDED/);
  assert.equal(warning.details.ok, true);

  const refs = await execute({ action: "refs", dir: ".", expect: ["source.png", "missing.png"] });
  assert.match(text(refs), /WARN: 1 of 2 expected picture\(s\) are missing/);
  assert.match(text(refs), /NOTE: missing missing.png/);

  await assert.rejects(execute({ action: "fit", in: "source.png", width: 10, height: 10 }), /INVALID_ARGS: action=fit needs out/);

  const mismatch = await execute({ action: "check", file: "source.png", width: 99, height: 99 });
  assert.match(text(mismatch), /FAIL: SIZE_MISMATCH/);
  assert.match(text(mismatch), /NEXT: run fit/);
  assert.equal(mismatch.details.ok, false);

  process.env.TRIPO_API_KEY = "test-key";
  const bodies = [];
  let generationCalls = 0;
  let active = 0;
  let maxActive = 0;
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    if (value.includes("/generation/")) {
      generationCalls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      bodies.push(JSON.parse(init.body));
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
      active -= 1;
      return new Response(JSON.stringify({ code: 0, data: { task_id: "tool-task" } }));
    }
    if (value.includes("/tasks/")) {
      return new Response(JSON.stringify({ code: 0, data: { status: "success", output: { image_url: "https://img.test/tool.png" } } }));
    }
    if (value === "https://img.test/tool.png") return new Response(source);
    throw new Error(`unexpected ${value}`);
  };
  const prompt = "the player's exact prompt, with any style";
  const generated = await execute({ action: "generate", prompt, out: ".preview/generated.png" });
  assert.match(text(generated), /PASS: .*generated.png written at 32x32, task tool-task/);
  assert.equal(bodies[0].prompt, prompt);
  assert.equal(generationCalls, 1);

  writeFileSync(join(cwd, "keep.png"), "keep");
  await assert.rejects(execute({ action: "generate", prompt: "do not call", out: "keep.png" }), /OUT_FILE_EXISTS/);
  assert.equal(generationCalls, 1);

  await Promise.all([
    execute({ action: "generate", prompt: "first", out: ".preview/first.png" }),
    execute({ action: "generate", prompt: "second", out: ".preview/second.png" }),
  ]);
  assert.equal(generationCalls, 3);
  assert.equal(maxActive, 1);

  const smoke = execFileSync("bun", [
    "scripts/dev-harness.mjs",
    ".pi/extensions/generate-2d-asset.ts",
    "generate_2d_asset",
    JSON.stringify({ action: "check", file: join(cwd, "source.png"), width: 32, height: 32, alpha: "prefer" }),
  ], { cwd: root, encoding: "utf8" });
  assert.match(smoke, /PASS: .*source.png is 32x32, alpha=true/);
  console.log("PASS: generate_2d_asset fit/check/refs/generate, warnings, no-overwrite, and dev-harness loading");
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.TRIPO_API_KEY;
  else process.env.TRIPO_API_KEY = oldKey;
  rmSync(cwd, { recursive: true, force: true });
}
