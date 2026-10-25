#!/usr/bin/env node
/**
 * Check Markdown links and repository-root paths.
 * Markdown links resolve from the containing file. Backtick paths resolve from the repository root.
 * Code fences are excluded because commands and game paths use another convention.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules", "your_mods", "bin", "obj"]);
// Generated upstream pages can contain site-specific links. Check our INDEX.md only.
const SKIP_PATHS = ["reference/ritsulib-wiki"];
const isSkippedPath = (rel) => SKIP_PATHS.some((p) => rel === p || rel.startsWith(`${p}/`));
const REPO_TOP_DIRS = ["docs", "scripts", "libs", "reference", "editors", "tools", ".pi", "templates"];
const OTHER_REPO = /desktop-gamer-agent-pi|duckov|eu5-mod-repo|pi-desktop/;

const problems = [];
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name));
    } else if (entry.name.endsWith(".md")) {
      const abs = join(dir, entry.name);
      if (isSkippedPath(relative(root, abs)) && !abs.endsWith("ritsulib-wiki/INDEX.md")) continue;
      files.push(abs);
    }
  }
})(root);

/** Remove code fences while preserving line numbers. */
function stripFences(text) {
  const out = [];
  let inFence = false;
  let marker = "";
  for (const line of text.split("\n")) {
    const match = /^\s*(```+|~~~+)/.exec(line);
    if (match) {
      if (!inFence) {
        inFence = true;
        marker = match[1][0];
      } else if (match[1][0] === marker) {
        inFence = false;
      }
      out.push("");
      continue;
    }
    out.push(inFence ? "" : line);
  }
  return out.join("\n");
}

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const where = relative(root, file);

  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+\.md)(#[^)]*)?\)/g)) {
    const target = match[1];
    if (/^(https?:|\/\/|mailto:)/.test(target)) continue;
    if (!existsSync(resolve(dirname(file), target))) {
      const resolved = relative(root, resolve(dirname(file), target));
      problems.push(`broken link: ${where} -> ${target} (resolved to ${resolved})`);
    }
  }

  const nakedLines = stripFences(text).split("\n");
  for (let i = 0; i < nakedLines.length; i++) {
    const line = nakedLines[i];
    if (OTHER_REPO.test(line) || OTHER_REPO.test(nakedLines[i - 1] ?? "")) continue;
    for (const match of line.matchAll(/`([A-Za-z0-9_./-]+\.(?:md|mjs|py|cs|json|ini|ts|png|glb|jsonl))`/g)) {
      const path = match[1];
      if (path.includes("..")) continue;
      if (!REPO_TOP_DIRS.includes(path.split("/")[0])) continue;
      if (!existsSync(join(root, path))) problems.push(`missing path: ${where} -> \`${path}\``);
    }
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  console.error(`${problems.length} documentation reference problem(s)`);
  process.exit(1);
}
console.log(`PASS documentation references (${files.length} Markdown files)`);
