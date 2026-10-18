#!/usr/bin/env node
/**
 * 把 BaseLib 的官方 wiki 逐字抓进 `reference/base-lib-wiki/`。
 *
 * 为什么要这份快照：agent 干活时不该先联网。它读本地这一页，`SOURCE.md` 记着出处，
 * 过不过期能一眼看出来。
 *
 * 为什么要脚本：**过期的快照比一条链接更坏** —— 它会静默给出旧答案。
 * 所以快照必须能被一条命令重抓并逐字对比，而不是靠人去点网页。
 *
 * 三条不许破坏的规矩：
 *   1. 抓下来的文件**一个字都不改**（改了下一次 diff 就全是噪音）。上游用 Jekyll 的
 *      `{% link %}` 语法，原样留着。
 *   2. `SOURCE.md` 必须写清上游 repo / commit / 抓取日期 / 对应版本。
 *   3. 这个目录要排除在 `scripts/check-doc-refs.mjs` 之外，见那边的注释。
 *
 * 用法：
 *   node scripts/sync-base-lib-wiki.mjs           抓取并写入
 *   node scripts/sync-base-lib-wiki.mjs --check   只比对，有差异就 exit 1（不写盘）
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = join(repoRoot, "reference", "base-lib-wiki");
const UPSTREAM = "Alchyr/BaseLib-Wiki";
const BRANCH = "main";
const API = `https://api.github.com/repos/${UPSTREAM}`;
const RAW = `https://raw.githubusercontent.com/${UPSTREAM}/${BRANCH}`;

const checkOnly = process.argv.includes("--check");

/**
 * 不带 token 也能跑：一次 tree 请求 + 每个文件一次 raw 请求。
 *
 * 必须重试：这台机器连 GitHub 会间歇性 `read ETIMEDOUT`（release CDN 上踩过同样的坑），
 * 一次超时不该让同步半途失败 —— 半截的产出比失败更坏。
 */
async function request(url, init) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastError;
}

async function getJson(url) {
  return (await request(url, { headers: { accept: "application/vnd.github+json" } })).json();
}

async function getText(url) {
  return (await request(url)).text();
}

const head = await getJson(`${API}/commits/${BRANCH}`);
const commit = head.sha;
const committedAt = head.commit.committer.date;

const tree = await getJson(`${API}/git/trees/${BRANCH}?recursive=1`);
const pages = tree.tree
  .filter((e) => e.type === "blob" && e.path.startsWith("docs/") && e.path.endsWith(".md"))
  .map((e) => e.path)
  .sort();

if (!pages.length) throw new Error("no pages found upstream -- the tree layout changed");

const fetched = new Map();
for (const path of pages) {
  fetched.set(relative("docs", path), await getText(`${RAW}/${path}`));
}

// 站点根 index.md 只是导航落地页，不属于内容页，这里不收。
// docs/ 下每个子目录自己的 index.md 收（它们是该目录的导读）。

const existing = [];
(function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".md") || entry.name === ".gitignore") existing.push(p);
  }
})(destRoot);

const added = [];
const changed = [];
for (const [rel, text] of fetched) {
  const target = join(destRoot, rel);
  if (!existsSync(target)) added.push(rel);
  else if (readFileSync(target, "utf8") !== text) changed.push(rel);
}
/** 我们自己在这个目录里维护的文件：同步只能改上游页，不许动这两个。 */
const OURS = new Set(["SOURCE.md", "INDEX.md"]);

const removed = existing
  .map((p) => relative(destRoot, p))
  .filter((rel) => !OURS.has(rel) && !fetched.has(rel));

const summary = [
  `${pages.length} pages upstream @ ${commit.slice(0, 8)} (${committedAt})`,
  `added ${added.length}, changed ${changed.length}, removed ${removed.length}`,
];
for (const l of added) summary.push(`  + ${l}`);
for (const l of changed) summary.push(`  ~ ${l}`);
for (const l of removed) summary.push(`  - ${l}`);

if (checkOnly) {
  console.log(summary.join("\n"));
  if (added.length || changed.length || removed.length) {
    console.log("\nThe snapshot is out of date. Run: node scripts/sync-base-lib-wiki.mjs");
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
// 上游删掉的页**真的删掉**，不留空文件。
// 空文件会让读它的 agent 以为「这页没内容」，还会让 check-doc-refs 通过；
// 真删掉则会让引用它的 INDEX.md / SKILL 当场报坏链，逼人更新。
for (const rel of removed) {
  const p = join(destRoot, rel);
  if (statSync(p).isFile()) rmSync(p);
}

writeFileSync(
  join(destRoot, "SOURCE.md"),
  `# Where this snapshot comes from

**Do not edit any file in this directory.** The upstream pages are copied verbatim. An edit makes
the next diff noise, and the snapshot stops being evidence of what upstream says.

|item|value|
|---|---|
|upstream|[\`${UPSTREAM}\`](https://github.com/${UPSTREAM}) (MIT)|
|branch|\`${BRANCH}\`|
|commit|\`${commit}\`|
|fetched|${new Date().toISOString().slice(0, 10)}|
|upstream commit date|${committedAt}|
|pages|${pages.length}|

## How to tell whether this snapshot is stale

The upstream wiki follows the BaseLib releases. Use this procedure:

1. Read the \`version\` field in \`vendor/baselib/BaseLib.json\`.
2. If that version is newer than the one this snapshot matches, compare against upstream:

\`\`\`sh
node scripts/sync-base-lib-wiki.mjs --check
\`\`\`

The command exits with code 1 when upstream and this snapshot differ. Run the same command without
\`--check\` to fetch the new pages.

## Pages that may be empty upstream

Some pages have a heading and no text below it. Two examples are the Spine section in
\`scenes/creature-visuals.md\` and the \`CardModel Documentation\` section in
\`models/custom-card.md\`. An empty section means upstream has not written it yet. It is not a
missing file. For those topics, read the decompiled assembly instead.

## Index

The hand-written index is [\`INDEX.md\`](INDEX.md). Read it first. Do not page through the
snapshot.
`,
  "utf8",
);

console.log(summary.join("\n"));
console.log(`\nwrote reference/base-lib-wiki/ (${pages.length} pages + SOURCE.md)`);
