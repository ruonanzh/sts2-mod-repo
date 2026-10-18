#!/usr/bin/env node
/**
 * Machine part of the English writing standard.
 *
 * The rules are in `docs/prompt-standard.md`, section 3. This script checks only what a script can
 * decide without judgement. Hedges, literals, and the term tables need a human read.
 *
 * What it checks:
 *   1. No semicolon in prose. A semicolon inside code, a literal, or a quoted log line is fine.
 *   2. No arrow and no symbol that carries meaning. `->` written as a word is a violation too.
 *   3. No `etc.`, no `and so on`, and no list that ends with `...`.
 *   4. No marketing adjective: seamless, robust, cutting-edge, powerful, best-in-class.
 *   5. No descriptive sentence longer than 25 words.
 *   6. No `folder` outside a literal. The standard uses `directory`.
 *
 * Why this exists at all: the repository was Chinese until this file was written, and the rules
 * that kept the Chinese text honest were machine-checked. The English text needs the same
 * protection, because the failure mode is the same. One file drifts, the next file copies it, and
 * a few weeks later the repo has two words for one concept.
 *
 * The verbatim upstream wiki is skipped. Upstream has its own style and must not be edited.
 *
 * Usage: node scripts/check-prompt-standard-en.mjs [file ...]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Copied from upstream. Our own index and source files inside it are checked. */
const SKIP_TREE = "reference/base-lib-wiki";
const CHECKED_IN_SKIP_TREE = new Set(["INDEX.md", "SOURCE.md"]);

const SKIP_DIRS = new Set([".git", "node_modules", "your_mods", "bin", "obj", "vendor/baselib"]);

const MAX_WORDS = 25;

const MARKETING = [
  /\bseamless(ly)?\b/i,
  /\brobust\b/i,
  /\bcutting[- ]edge\b/i,
  /\bpowerful\b/i,
  /\bbest[- ]in[- ]class\b/i,
];

const collect = () => {
  const out = [];
  const push = (p) => {
    if (existsSync(p)) out.push(p);
  };
  push(join(root, "AGENTS.md"));
  push(join(root, "README.md"));
  push(join(root, "THIRD_PARTY_LICENSES.md"));

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(p);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const rel = relative(root, p).replace(/\\/g, "/");
      if (rel.startsWith(`${SKIP_TREE}/`)) {
        const leaf = rel.slice(SKIP_TREE.length + 1);
        if (!CHECKED_IN_SKIP_TREE.has(leaf)) continue;
      }
      out.push(p);
    }
  };

  walk(join(root, "docs"));
  walk(join(root, ".pi", "skills"));
  push(join(root, "vendor", "baselib", "README.md"));
  push(join(root, SKIP_TREE, "INDEX.md"));
  push(join(root, SKIP_TREE, "SOURCE.md"));
  return [...new Set(out)];
};

/**
 * Replace fenced code and inline code with blanks, and keep the line count, so a line number in a
 * report still points at the real line. `semicolonsAreFine()` reads the same stripped text.
 */
function stripCode(text) {
  const lines = text.split("\n");
  let inFence = false;
  let fenceMark = "";
  return lines.map((line) => {
    const fence = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMark = fence[1][0];
        return "";
      }
      if (fence[1][0] === fenceMark) {
        inFence = false;
        return "";
      }
    }
    if (inFence) return "";
    // Drop the inline code spans, keep the words around them.
    return line.replace(/`[^`]*`/g, "``");
  });
}

const problems = [];
const report = (file, line, rule, detail) => {
  problems.push({ file: relative(root, file), line, rule, detail });
};

for (const file of collect()) {
  if (!statSync(file).isFile()) continue;
  const raw = readFileSync(file, "utf8");
  const lines = stripCode(raw);

  lines.forEach((line, index) => {
    const n = index + 1;
    const text = line.trim();
    if (!text) return;
    // Frontmatter and table rules are structure, not prose.
    if (/^[a-z_]+:\s/.test(text) && n <= 10) return;

    if (text.includes(";")) {
      report(file, n, "semicolon", "Write two sentences instead of a semicolon.");
    }
    if (/[→←✓✗⚠⭐]/.test(text)) {
      report(file, n, "symbol", "Write a full sentence instead of a symbol or an arrow.");
    }
    if (/\betc\.|\band so on\b/i.test(text)) {
      report(file, n, "open-list", "List every item, or say where the full list is.");
    }
    if (/\.\.\.\s*(\||$)/.test(text) && !/^\|/.test(text)) {
      report(file, n, "open-list", "Do not end a list with an ellipsis.");
    }
    for (const pattern of MARKETING) {
      if (pattern.test(text)) {
        report(file, n, "marketing", `Replace ${pattern.source} with a measured value.`);
      }
    }
    if (/\bfolder/i.test(text) && !/libraryfolders/.test(text)) {
      report(file, n, "term", 'Use "directory". "folder" belongs only inside a literal.');
    }

    // Sentence length. A table row is several cells, so measure each cell on its own. Otherwise
    // four short cells add up to one long "sentence" and every table row fails.
    const cells = text.startsWith("|") ? text.split("|").filter((c) => c.trim()) : [text];
    for (const cell of cells) {
      // Drop a link target, keep the visible text.
      const prose = cell.replace(/\[[^\]]*\]\([^)]*\)/g, " link ");
      for (const sentence of prose.split(/(?<=[.!?])\s+/)) {
      const words = sentence.replace(/[*_|>#-]/g, " ").trim().split(/\s+/).filter(Boolean);
        if (words.length > MAX_WORDS) {
          report(
            file,
            n,
            "length",
            `${words.length} words. Split this sentence: ${sentence.trim().slice(0, 90)}`,
          );
        }
      }
    }
  });
}

if (!problems.length) {
  console.log(`OK  prompt-standard (English rules) clean  (${collect().length} files scanned)`);
  process.exit(0);
}

console.log(`FAIL  prompt-standard (English rules) has ${problems.length} problem(s):`);
for (const p of problems) console.log(`  ${p.file}:${p.line}  [${p.rule}] ${p.detail}`);
console.log("\nThe rules live in docs/prompt-standard.md, section 3.");
process.exit(1);
