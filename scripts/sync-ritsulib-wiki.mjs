#!/usr/bin/env node
/** Extract the English sections of the RitsuLib guide into reference/ritsulib-wiki/. */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = join(repoRoot, "reference", "ritsulib-wiki");
const UPSTREAM = "BAKAOLC/STS2-RitsuLib";
const REF = "v0.6.10";
const GUIDE_ROOT = "docs/pages/guide";
const checkOnly = process.argv.includes("--check");

async function resolveCommit() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-remote", `https://github.com/${UPSTREAM}.git`, `refs/tags/${REF}`, `refs/tags/${REF}^{}`],
      { timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const lines = stdout.trim().split("\n").map((line) => line.trim().split(/\s+/));
    const peeled = lines.find((line) => line[1] === `refs/tags/${REF}^{}`);
    const direct = lines.find((line) => line[1] === `refs/tags/${REF}`);
    const commit = (peeled ?? direct)?.[0];
    if (!commit) throw new Error(`cannot resolve ${UPSTREAM} ${REF}`);
    return commit;
  } catch (error) {
    const source = readFileSync(join(destRoot, "SOURCE.md"), "utf8");
    const commit = /^\|commit\|`([0-9a-f]{40})`\|$/m.exec(source)?.[1];
    if (!commit || !source.includes(`|ref|\`${REF}\`|`)) throw error;
    console.warn(`WARN: cannot resolve the tag. Check the pinned archive ${commit.slice(0, 8)} instead.`);
    return commit;
  }
}

const commit = await resolveCommit();
const response = await fetch(`https://codeload.github.com/${UPSTREAM}/tar.gz/${commit}`, {
  signal: AbortSignal.timeout(300_000),
});
if (!response.ok) throw new Error(`guide archive -> HTTP ${response.status}`);
const archive = gunzipSync(Buffer.from(await response.arrayBuffer()));

function textField(start, length) {
  return archive.subarray(start, start + length).toString("utf8").replace(/\0[\s\S]*$/, "");
}

function numberField(start, length) {
  const text = textField(start, length).trim();
  return text ? Number.parseInt(text, 8) : 0;
}

/** Read the regular files needed from a ustar archive. */
function guideFiles() {
  const files = new Map();
  for (let offset = 0; offset + 512 <= archive.length; ) {
    const name = textField(offset, 100);
    if (!name) break;
    const prefix = textField(offset + 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = numberField(offset + 124, 12);
    const modified = numberField(offset + 136, 12);
    const type = String.fromCharCode(archive[offset + 156]);
    const marker = `/${GUIDE_ROOT}/`;
    const guideIndex = path.indexOf(marker);
    if ((type === "0" || type === "\0") && guideIndex >= 0 && path.endsWith(".md")) {
      const relativePath = path.slice(guideIndex + marker.length);
      const body = archive.subarray(offset + 512, offset + 512 + size).toString("utf8");
      files.set(relativePath, { body, modified });
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const upstream = guideFiles();
if (!upstream.size) throw new Error("no guide pages found upstream; the archive layout changed");
const committedAt = new Date(Math.max(...[...upstream.values()].map((file) => file.modified)) * 1000).toISOString();

function englishSections(text) {
  const lines = text.split("\n");
  const output = [];
  let inEnglish = false;
  let inFrontmatter = lines[0] === "---";
  for (const line of lines.slice(1)) {
    if (inFrontmatter) {
      if (line === "---") inFrontmatter = false;
      continue;
    }
    if (/^::: en\s*$/.test(line)) {
      inEnglish = true;
      continue;
    }
    if (inEnglish && /^:::\s*$/.test(line)) {
      inEnglish = false;
      output.push("");
      continue;
    }
    if (inEnglish) output.push(line);
    else if (/\{lang="en"\}\s*$/.test(line)) output.push(line.replace(/\{lang="en"\}\s*$/, ""));
  }
  return `${output.join("\n").trim()}\n`;
}

const fetched = new Map();
for (const [rel, file] of [...upstream.entries()].sort()) {
  // Our hand-written INDEX.md replaces the upstream index on every filesystem.
  if (rel === "index.md") continue;
  const english = englishSections(file.body);
  if (!english.trim()) throw new Error(`no English sections found in ${rel}`);
  const prose = english.replace(/```[\s\S]*?```/g, "");
  if (/[\u3400-\u9fff]/u.test(prose)) throw new Error(`non-English prose remains in ${rel}`);
  fetched.set(rel, english);
}

const existing = [];
(function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith(".md")) existing.push(path);
  }
})(destRoot);

const added = [];
const changed = [];
for (const [rel, text] of fetched) {
  const target = join(destRoot, rel);
  if (!existsSync(target)) added.push(rel);
  else if (readFileSync(target, "utf8") !== text) changed.push(rel);
}
const OURS = new Set(["SOURCE.md", "INDEX.md"]);
const removed = existing.map((path) => relative(destRoot, path)).filter((rel) => !OURS.has(rel) && !fetched.has(rel));
const summary = [
  `${upstream.size} guide pages upstream @ ${commit.slice(0, 8)} (${committedAt})`,
  `added ${added.length}, changed ${changed.length}, removed ${removed.length}`,
];
for (const line of added) summary.push(`  + ${line}`);
for (const line of changed) summary.push(`  ~ ${line}`);
for (const line of removed) summary.push(`  - ${line}`);

if (checkOnly) {
  console.log(summary.join("\n"));
  if (added.length || changed.length || removed.length) {
    console.log("\nThe snapshot is out of date. Run: node scripts/sync-ritsulib-wiki.mjs");
    process.exit(1);
  }
  console.log("snapshot matches upstream");
  process.exit(0);
}

for (const [rel, text] of fetched) {
  const target = join(destRoot, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}
for (const rel of removed) {
  const path = join(destRoot, rel);
  if (statSync(path).isFile()) rmSync(path);
}

writeFileSync(
  join(destRoot, "SOURCE.md"),
  `# Where this snapshot comes from

**Do not edit the generated pages in this directory.** Only the English sections are extracted from the bilingual upstream pages. This is not a full-page snapshot.

|item|value|
|---|---|
|upstream|[\`${UPSTREAM}\`](https://github.com/${UPSTREAM}) (MIT)|
|ref|\`${REF}\`|
|commit|\`${commit}\`|
|fetched|${new Date().toISOString().slice(0, 10)}|
|upstream commit date|${committedAt}|
|guide pages|${fetched.size} generated + hand-written INDEX.md (${upstream.size} upstream)|

## Freshness check

The snapshot matches the RitsuLib version in \`mod-repo.json\` and \`vendor/ritsulib/mod_manifest.json\`.

\`\`\`sh
node scripts/sync-ritsulib-wiki.mjs --check
\`\`\`

The command exits with code 1 when upstream and this English snapshot differ. Run the same command without
\`--check\` to fetch the pages again. The hand-written task map is [\`INDEX.md\`](INDEX.md).
`,
  "utf8",
);
console.log(summary.join("\n"));
console.log(`\nwrote reference/ritsulib-wiki/ (${fetched.size} generated pages + INDEX.md + SOURCE.md)`);
