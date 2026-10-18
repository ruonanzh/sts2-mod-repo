/**
 * install_mod 的依赖判定：跑真代码，不跑副本。
 *
 * 为什么要这一份：这套逻辑的全部价值在「只填空，不覆盖」——
 * 一旦有人把它改成「有就覆盖」，本机一切正常，**玩家那边却开始被静默钉住旧版本**
 * （游戏加载器 prefers mods_directory，见 .pi/lib/mod-deps.ts 的文件头）。
 * 这条退化在真实游戏里几乎观察不到，只能在这里挡。
 *
 * 做法：把 `.pi/` 复制进临时目录（顺便给相对 import 补上 .ts），用 node 直接跑 TS
 * （node 24 默认剥离类型），再用一个假的 pi 对象接住 registerTool 回调。
 * 不碰真实游戏目录，也不读真实存档。
 *
 * 用法：node scripts/test-mod-install-deps.mjs
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "sts2-dep-check-"));

/** node 的 ESM 解析要求带扩展名，仓库源码按 bundler 风格写，所以复制时补 .ts */
function copyWithTsExtensions(from, to) {
  cpSync(from, to, { recursive: true });
  const walk = (dir) => {
    for (const entry of readdirSafe(dir)) {
      const p = join(dir, entry);
      if (statSafe(p)?.isDirectory()) {
        walk(p);
        continue;
      }
      if (entry.endsWith(".ts")) {
        const src = readFileSync(p, "utf8");
        const out = src.replace(/(from\s+")(\.\.?\/[^"]+?)(")/g, (m, a, spec, c) => {
          if (spec.endsWith(".ts") || spec.endsWith(".js")) return m;
          return `${a}${spec}.ts${c}`;
        });
        writeFileSync(p, out);
      }
    }
  };
  walk(to);
}

function statSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  const mark = condition ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${!condition && detail ? `\n      ${detail}` : ""}`);
}

// ── 临时仓库：只放 install_mod 真正会读的东西 ────────────────────────────────
const caseRoot = tmp;
copyWithTsExtensions(join(repoRoot, ".pi"), join(caseRoot, ".pi"));
symlinkSync(join(repoRoot, "node_modules"), join(caseRoot, "node_modules"));

const vendorDir = join(caseRoot, "vendor", "baselib");
mkdirSync(vendorDir, { recursive: true });
writeFileSync(join(vendorDir, "BaseLib.dll"), "fake-dll");
writeFileSync(join(vendorDir, "BaseLib.pck"), "fake-pck");
writeFileSync(
  join(vendorDir, "BaseLib.json"),
  JSON.stringify({ id: "BaseLib", name: "BaseLib", version: "v3.4.7", has_dll: true, has_pck: true }, null, 2),
);
writeFileSync(join(vendorDir, "LICENSE.txt"), "MIT");

writeFileSync(
  join(caseRoot, "mod-repo.json"),
  JSON.stringify(
    {
      version: 1,
      modType: "godot-csharp",
      game: { name: "Slay the Spire 2", steamAppId: "2868840" },
      sentinel: "sts2.dll",
      compile: { managedDir: { mac: "x", windows: "y" } },
      modInstall: { relativeTo: "gameDir", path: { mac: "SlayTheSpire2.app/Contents/MacOS/mods", windows: "mods" } },
      runtimeDependencies: [{ id: "BaseLib", vendorDir: "vendor/baselib", workshopUrl: "https://example.invalid" }],
    },
    null,
    2,
  ),
);

// 一个声明了 BaseLib 依赖的 mod
const modDir = join(caseRoot, "MyMod");
mkdirSync(modDir, { recursive: true });
writeFileSync(
  join(modDir, "MyMod.json"),
  JSON.stringify(
    {
      id: "MyMod",
      name: "My Mod",
      author: "test",
      version: "0.0.1",
      has_pck: false,
      has_dll: true,
      dependencies: [{ id: "BaseLib", min_version: "3.4.7" }],
    },
    null,
    2,
  ),
);
writeFileSync(join(modDir, "MyMod.dll"), "fake");

// ── 接住工具回调 ────────────────────────────────────────────────────────────
const extUrl = pathToFileURL(join(caseRoot, ".pi", "extensions", "mod-install.ts")).href;
const { default: register } = await import(extUrl);
let tool = null;
register({
  registerTool: (def) => {
    tool = def;
  },
});
if (!tool) throw new Error("the extension registered no tool");
console.log(`(tool: ${tool.name})\n`);

/** 每个用例一套干净的游戏侧目录，并写一次状态（install_mod 只认已记录的路径）。 */
function setup({ local = null, workshop = null } = {}) {
  const modsRoot = join(caseRoot, "mods");
  const workshopRoot = join(caseRoot, "workshop", "content", "2868840");
  rmSync(modsRoot, { recursive: true, force: true });
  rmSync(join(caseRoot, "workshop"), { recursive: true, force: true });
  mkdirSync(modsRoot, { recursive: true });
  mkdirSync(workshopRoot, { recursive: true });

  const put = (root, dirName, version, { bom = false } = {}) => {
    const d = join(root, dirName);
    mkdirSync(d, { recursive: true });
    const json = JSON.stringify({ id: "BaseLib", name: "BaseLib", version, has_dll: true, has_pck: true }, null, 2);
    // 上游的 BaseLib.json 带 UTF-8 BOM。Node 的 JSON.parse 遇到 BOM 直接抛，
    // 不处理会把这个依赖误判成「不存在」，然后覆盖玩家已经装好的那份。
    writeFileSync(join(d, "BaseLib.json"), bom ? `\uFEFF${json}` : json);
    writeFileSync(join(d, "BaseLib.dll"), "fake");
  };
  if (local) put(modsRoot, "BaseLib", local);
  if (workshop) put(workshopRoot, "3737335127", workshop);

  writeFileSync(
    join(caseRoot, ".gamer-agent.local.json"),
    JSON.stringify({ modInstallDir: modsRoot, workshopDir: workshopRoot }, null, 2),
  );
  return { modsRoot, workshopRoot };
}

async function runInstall() {
  const out = await tool.execute(
    "call-1",
    { modDir: join(caseRoot, "MyMod") },
    undefined,
    undefined,
    { cwd: caseRoot },
  );
  const text = out.content.map((c) => c.text).join("\n");
  return { text, details: out.details };
}

const vendorPlaced = (modsRoot) => existsSync(join(modsRoot, "BaseLib", "BaseLib.json"));

// ① 玩家一份都没有 → 该把随仓带的那份放进去
{
  const { modsRoot } = setup();
  const { text } = await runInstall();
  check("no copy anywhere -> the bundled BaseLib is placed", vendorPlaced(modsRoot), text);
  check("...and the report says so", /bundled .*was placed/.test(text), text);
  check("...and the mod itself is installed", existsSync(join(modsRoot, "MyMod", "MyMod.dll")), text);
}

// ② 玩家从 Workshop 订阅了且版本够 → 什么都不装（这是「不覆盖」的核心）
{
  const { modsRoot } = setup({ workshop: "v3.4.7" });
  const { text } = await runInstall();
  check("Workshop copy at the required version -> nothing is copied", !vendorPlaced(modsRoot), text);
  check("...and the report names the Workshop as the source", /already installed from the Workshop/.test(text), text);
}

// ③ 玩家订阅的版本太旧 → 只报告，不覆盖，也不塞一份本地副本进去
{
  const { modsRoot } = setup({ workshop: "v3.0.0" });
  const { text } = await runInstall();
  check("Workshop copy too old -> nothing is copied over it", !vendorPlaced(modsRoot), text);
  check("...and the report says it is older than required", /older than the required/.test(text), text);
  check("...and NEXT tells the player to update in the Workshop", /update BaseLib in the Steam Workshop/.test(text), text);
}

// ④ 本地 + Workshop 都有 → 这是唯一会让更新不到达的状态，必须报出来
{
  const { modsRoot } = setup({ local: "v3.4.7", workshop: "v3.5.0" });
  const { text } = await runInstall();
  check("copies in both places -> the duplicate is reported", /exists in both places/.test(text), text);
  check("...and nothing is overwritten", vendorPlaced(modsRoot), text);
}

// ⑥ manifest 带 UTF-8 BOM（上游原文件就是）→ 仍然要认出这个依赖存在
{
  const { modsRoot, workshopRoot } = setup();
  rmSync(join(workshopRoot, "3737335127"), { recursive: true, force: true });
  mkdirSync(join(workshopRoot, "3737335127"), { recursive: true });
  writeFileSync(
    join(workshopRoot, "3737335127", "BaseLib.json"),
    `\uFEFF${JSON.stringify({ id: "BaseLib", name: "BaseLib", version: "v3.4.7", has_dll: true }, null, 2)}`,
  );
  writeFileSync(join(workshopRoot, "3737335127", "BaseLib.dll"), "fake");
  const { text } = await runInstall();
  check("a dependency manifest with a UTF-8 BOM is still recognised", !vendorPlaced(modsRoot), text);
  check("...and it is not treated as missing", !/was not installed/.test(text), text);
}

// ⑤ 版本号带前缀也要能比（上游写 v3.4.7，manifest 写 3.4.7）
{
  setup({ workshop: "v3.4.7" });
  const { text } = await runInstall();
  check('"v3.4.7" satisfies min_version "3.4.7"', !/older than the required/.test(text), text);
}

rmSync(tmp, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
