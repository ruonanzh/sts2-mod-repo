import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const manifest = JSON.parse(read("editors/sts2_mod_page/.editor.tool.json"));
assert.equal(manifest.apiVersion, 1);
assert.equal(manifest.id, "sts2_mod_page");
assert.equal(manifest.entry, "index.html");
assert.deepEqual(manifest.match, ["your_mods/*/.preview/*.modpage.html"]);

const editor = read("editors/sts2_mod_page/editor.js");
assert.ok(editor.includes('pagePath = typeof data.file?.path === "string"'));
assert.ok(editor.includes("`/page-annotated ${JSON.stringify(pagePath)}`"));
assert.ok(editor.includes("It will read the feedback and decide what to update."));

const prompt = read(".pi/prompts/page-annotated.md");
assert.ok(prompt.includes("${1:-not supplied}"));
assert.ok(prompt.includes("exactly one candidate"));
assert.ok(prompt.includes("Decide which proposal, mod, or explanation changes are appropriate"));

const pageSkill = read(".pi/skills/mod-page/SKILL.md");
assert.ok(pageSkill.includes("data:image/png;base64"));
assert.ok(pageSkill.includes("An unmentioned starting-deck addition means no addition."));
assert.ok(pageSkill.includes("without a writable bound mod directory summarizes in text"));

for (const path of [
  "editors/sts2_mod_page/index.html",
  "editors/sts2_mod_page/editor.js",
  "editors/sts2_mod_page/editor.css",
]) {
  assert.ok(!/[\u3400-\u9fff]/u.test(read(path)), `${path} contains non-English editor text`);
}
console.log("PASS: mod-page editor, path-specific feedback, inline art, and English UI contract");
