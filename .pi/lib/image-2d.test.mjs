import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "bun:test";
import { checkImage, checkRefs, fitImage, generateImage, ImageError } from "./image-2d.ts";
import { encodePng } from "./png.ts";

const dirs = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "sts2-image-"));
  dirs.push(dir);
  return dir;
}

function image(width = 32, height = 32, alpha = 255) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 200;
    rgba[i + 1] = 100;
    rgba[i + 2] = 50;
    rgba[i + 3] = alpha;
  }
  return { width, height, rgba };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function successApi(png, calls, bodies) {
  let upload = 0;
  return async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/files")) return json({ code: 0, data: { file_token: `token-${++upload}` } });
    if (url.includes("/generation/")) {
      bodies.push(JSON.parse(init.body));
      return json({ code: 0, data: { task_id: "task-new" } });
    }
    if (url.includes("/tasks/")) return json({ code: 0, data: { status: "success", output: { image_url: "https://img.test/result.png" } } });
    if (url === "https://img.test/result.png") return new Response(png, { status: 200 });
    throw new Error(`unexpected URL ${url}`);
  };
}

test("fit preserves RGBA and emits exact dimensions", async () => {
  const dir = tempDir();
  const input = join(dir, "in.png");
  const output = join(dir, "out.png");
  writeFileSync(input, encodePng(image(64, 32, 128)));
  const result = await fitImage({ inFile: input, outFile: output, width: 100, height: 76, mode: "cover" });
  assert.equal(result.status, "pass");
  const checked = await checkImage({ file: output, width: 100, height: 76, alpha: "prefer" });
  assert.equal(checked.status, "pass");
  assert.equal(checked.alpha, true);
});

test("fit can emit solid RGB with an explicit compositing background", async () => {
  const dir = tempDir();
  const input = join(dir, "in.png");
  const output = join(dir, "out.png");
  writeFileSync(input, encodePng(image(32, 32, 0)));
  await fitImage({ inFile: input, outFile: output, width: 100, height: 76, outputAlpha: "opaque", background: "#102030" });
  const checked = await checkImage({ file: output, width: 100, height: 76, alpha: "avoid" });
  assert.equal(checked.status, "pass");
  assert.equal(checked.alpha, false);
});

test("fit ignores an unused background when preserving alpha", async () => {
  const dir = tempDir();
  const input = join(dir, "in.png");
  writeFileSync(input, encodePng(image(32, 32, 128)));
  const result = await fitImage({ inFile: input, outFile: join(dir, "out.png"), width: 16, height: 16, outputAlpha: "preserve", background: "transparent" });
  assert.equal(result.alpha, true);
});

test("fit never overwrites an existing output", async () => {
  const dir = tempDir();
  const input = join(dir, "in.png");
  writeFileSync(input, encodePng(image()));
  await assert.rejects(fitImage({ inFile: input, outFile: input, width: 10, height: 10 }), (error) => {
    assert.equal(error.code, "OUT_FILE_EXISTS");
    return true;
  });
});

test("check treats alpha preferences as warnings, not failures", async () => {
  const dir = tempDir();
  const rgb = join(dir, "rgb.png");
  const rgba = join(dir, "rgba.png");
  writeFileSync(rgb, encodePng(image(), { opaque: true }));
  writeFileSync(rgba, encodePng(image(32, 32, 128)));
  const icon = await checkImage({ file: rgb, alpha: "prefer" });
  assert.equal(icon.status, "warn");
  assert.match(icon.warning, /ALPHA_RECOMMENDED/);
  const card = await checkImage({ file: rgba, alpha: "avoid" });
  assert.equal(card.status, "warn");
  assert.match(card.warning, /SOLID_RECOMMENDED/);
  const opaqueRgba = join(dir, "opaque-rgba.png");
  writeFileSync(opaqueRgba, encodePng(image()));
  const solid = await checkImage({ file: opaqueRgba, alpha: "avoid" });
  assert.equal(solid.status, "pass");
  assert.equal(solid.alpha, false);
});

test("check reports wrong dimensions with a fit next step", async () => {
  const dir = tempDir();
  const file = join(dir, "in.png");
  writeFileSync(file, encodePng(image(10, 10)));
  await assert.rejects(checkImage({ file, width: 20, height: 20 }), (error) => {
    assert.equal(error.code, "SIZE_MISMATCH");
    assert.match(error.next, /run fit/);
    return true;
  });
});

test("refs reports present and missing files without throwing", async () => {
  const dir = tempDir();
  writeFileSync(join(dir, "a.png"), "a");
  const result = await checkRefs({ dir, expect: ["a.png", "b.png"] });
  assert.equal(result.status, "warn");
  assert.equal(result.present, 1);
  assert.deepEqual(result.missing, ["b.png"]);
});

test("text generation uses the exact player prompt and downloads PNG immediately", async () => {
  const dir = tempDir();
  const out = join(dir, "preview.png");
  const png = encodePng(image(16, 16, 128));
  const calls = [];
  const bodies = [];
  const prompt = "A brass bird on a velvet pedestal, in any style the player wants";
  const result = await generateImage({ prompt, out, key: "test", fetchImpl: successApi(png, calls, bodies), pollMs: 1 });
  assert.equal(result.task, "task-new");
  assert.equal(result.width, 16);
  assert.equal(result.height, 16);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].prompt, prompt);
  assert.equal(bodies[0].model, "chat_image_2.5_flare");
  assert.equal(bodies[0].background, "transparent");
  assert.equal(bodies[0].output_format, "png");
  assert.ok(calls.some((call) => call.url.endsWith("/generation/text-to-image")));
  assert.ok(calls.some((call) => call.url === "https://img.test/result.png"));
  assert.equal((await checkImage({ file: out })).width, 16);
});

test("one and two reference pictures use image-to-image without changing the prompt", async () => {
  const dir = tempDir();
  const first = join(dir, "first.png");
  const second = join(dir, "second.png");
  writeFileSync(first, "first");
  writeFileSync(second, "second");
  const png = encodePng(image());
  for (const refs of [[first], [first, second]]) {
    const calls = [];
    const bodies = [];
    const prompt = refs.length === 1 ? "one reference" : "two references";
    await generateImage({ prompt, refs, out: join(dir, `out-${refs.length}.png`), key: "test", fetchImpl: successApi(png, calls, bodies), pollMs: 1 });
    assert.ok(calls.some((call) => call.url.endsWith("/generation/image-to-image")));
    assert.equal(bodies[0].prompt, prompt);
    if (refs.length === 1) assert.equal(bodies[0].input, "token-1");
    else assert.deepEqual(bodies[0].inputs, ["token-1", "token-2"]);
  }
});

test("task reuse skips generation and only refreshes and downloads the task image", async () => {
  const dir = tempDir();
  const calls = [];
  const bodies = [];
  const result = await generateImage({ task: "existing-task", out: join(dir, "reused.png"), key: "test", fetchImpl: successApi(encodePng(image()), calls, bodies), pollMs: 1 });
  assert.equal(result.task, "existing-task");
  assert.equal(bodies.length, 0);
  assert.equal(calls.filter((call) => call.url.includes("/generation/")).length, 0);
  assert.ok(calls.some((call) => call.url.endsWith("/tasks/existing-task")));
});

test("an existing generate output fails before any API call", async () => {
  const dir = tempDir();
  const out = join(dir, "existing.png");
  writeFileSync(out, "keep");
  let called = false;
  await assert.rejects(generateImage({ prompt: "new", out, key: "test", fetchImpl: async () => { called = true; throw new Error("must not call"); } }), (error) => {
    assert.equal(error.code, "OUT_FILE_EXISTS");
    return true;
  });
  assert.equal(called, false);
  assert.equal(readFileSync(out, "utf8"), "keep");
});

test("a missing reference fails before creating a generation task", async () => {
  const dir = tempDir();
  const calls = [];
  const bodies = [];
  await assert.rejects(generateImage({ prompt: "test", refs: [join(dir, "missing.png")], out: join(dir, "out.png"), key: "test", fetchImpl: successApi(encodePng(image()), calls, bodies) }), (error) => {
    assert.equal(error.code, "NO_FILE");
    return true;
  });
  assert.equal(calls.length, 0);
  assert.equal(bodies.length, 0);
});

test("rate limits do not retry in a loop", async () => {
  const dir = tempDir();
  let calls = 0;
  await assert.rejects(generateImage({ prompt: "test", out: join(dir, "out.png"), key: "test", fetchImpl: async () => {
    calls += 1;
    return json({ code: 2000, message: "limit" }, 429);
  } }), (error) => {
    assert.equal(error.code, "TRIPO_RATE_LIMIT");
    assert.match(error.next, /30-60/);
    return true;
  });
  assert.equal(calls, 1);
});

test("a download failure preserves the task id for reuse", async () => {
  const dir = tempDir();
  const fetchImpl = async (url) => {
    if (url.includes("/tasks/")) return json({ code: 0, data: { status: "success", output: { image_url: "https://img.test/missing.png" } } });
    if (url === "https://img.test/missing.png") return new Response("missing", { status: 404 });
    throw new Error(`unexpected ${url}`);
  };
  await assert.rejects(generateImage({ task: "keep-me", out: join(dir, "out.png"), key: "test", fetchImpl, pollMs: 1 }), (error) => {
    assert.equal(error.code, "DOWNLOAD_FAILED");
    assert.match(error.next, /keep-me/);
    return true;
  });
});

test("a task timeout explains how to reuse the paid task", async () => {
  const dir = tempDir();
  const fetchImpl = async (url) => {
    if (url.includes("/generation/")) return json({ code: 0, data: { task_id: "slow-task" } });
    if (url.includes("/tasks/")) return json({ code: 0, data: { status: "running" } });
    throw new Error(`unexpected ${url}`);
  };
  await assert.rejects(generateImage({ prompt: "test", out: join(dir, "out.png"), key: "test", fetchImpl, pollMs: 1, timeoutMs: 5 }), (error) => {
    assert.equal(error.code, "TASK_TIMEOUT");
    assert.match(error.next, /slow-task/);
    assert.match(error.message, /5 milliseconds/);
    return true;
  });
});

test("user cancellation is not reported as a network failure", async () => {
  const dir = tempDir();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(generateImage({
    prompt: "test",
    out: join(dir, "out.png"),
    key: "test",
    signal: controller.signal,
    fetchImpl: async () => { throw new DOMException("aborted", "AbortError"); },
  }), (error) => {
    assert.equal(error.code, "CANCELLED");
    return true;
  });
});

test("a late output collision preserves the paid task id", async () => {
  const dir = tempDir();
  const out = join(dir, "out.png");
  const calls = [];
  const bodies = [];
  const api = successApi(encodePng(image()), calls, bodies);
  const fetchImpl = async (url, init) => {
    if (url === "https://img.test/result.png") writeFileSync(out, "keep");
    return api(url, init);
  };
  await assert.rejects(generateImage({ prompt: "test", out, key: "test", fetchImpl, pollMs: 1 }), (error) => {
    assert.equal(error.code, "OUT_FILE_EXISTS");
    assert.match(error.next, /task-new/);
    return true;
  });
  assert.equal(readFileSync(out, "utf8"), "keep");
});

test("the configured desktop data directory supplies the Tripo key", async () => {
  const dir = tempDir();
  writeFileSync(join(dir, "api-keys.json"), JSON.stringify({ tripo: "file-key" }));
  const oldKey = process.env.TRIPO_API_KEY;
  const oldDir = process.env.PI_DESKTOP_DATA_DIR;
  try {
    delete process.env.TRIPO_API_KEY;
    process.env.PI_DESKTOP_DATA_DIR = dir;
    const result = await generateImage({ prompt: "test", out: join(dir, "out.png"), fetchImpl: successApi(encodePng(image()), [], []), pollMs: 1 });
    assert.equal(result.task, "task-new");
  } finally {
    if (oldKey === undefined) delete process.env.TRIPO_API_KEY;
    else process.env.TRIPO_API_KEY = oldKey;
    if (oldDir === undefined) delete process.env.PI_DESKTOP_DATA_DIR;
    else process.env.PI_DESKTOP_DATA_DIR = oldDir;
  }
});

test("ImageError exposes stable machine-readable codes", () => {
  const error = new ImageError("TEST_CODE", "message", "next");
  assert.equal(error.code, "TEST_CODE");
  assert.equal(error.next, "next");
});
