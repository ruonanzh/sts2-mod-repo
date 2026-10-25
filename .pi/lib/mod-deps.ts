/**
 * 依赖 mod 的判定（**共享**：install_mod 用这一份）。
 *
 * 背景（反编译 `ModManager.RemoveDisabledMods`）：同一个 id 同时存在于
 * `mods_directory` 和 `steam_workshop` 时，游戏**关掉 Workshop 那份**，留本地那份，
 * 动机是「方便 modder 开发」。这条规则的代价不是冲突，而是**版本落后**：
 * 本地那份会静默钉死版本，订阅的新版永远到不了，只打一行 WARN。
 *
 * 所以这里只做一个决定：**能不能装**。判据是「只填空，不覆盖」——
 * 玩家没有任何一份时，我们随仓带的那份才落下去；已经有任何一份（不管从哪来），
 * 一律不动，只报告状态和下一步。这样「装上就能用」和「不关掉别人的更新」同时成立。
 *
 * 版本比较是**不低于**，不是相等：mod 的 manifest 声明 `min_version`，
 * 玩家用更新的版本时必须照常工作。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type DepSource = "local" | "workshop";

/** 扫描深度上限。游戏的 mods 目录实际只有一两层，这个值只为防异常树。 */
const MAX_DEPTH = 5;

export interface DepSpec {
  id: string;
  /** manifest 里声明的 `dependencies[].min_version`；没写就是 null（不卡版本） */
  minVersion: string | null;
}

export interface DepInstall {
  source: DepSource;
  /** 这份 mod 所在目录 */
  dir: string;
  /** 从它的 manifest 读到的版本；读不到就是 null */
  version: string | null;
}

export interface DepResolution {
  spec: DepSpec;
  /** 0 份、1 份、或 2 份（本地 + Workshop 都有 = 重复） */
  installations: DepInstall[];
  /** 版本是否满足 min_version；null = 无法判断（缺版本号） */
  satisfies: boolean | null;
}

/**
 * 读 mod 自己声明的依赖。
 *
 * 只认 `{ id, min_version }`；别的形状一律跳过 —— 宁可不判，不可误判。
 */
export function readDependencySpecs(manifestPath: string): DepSpec[] {
  if (!existsSync(manifestPath)) return [];
  let data: unknown;
  try {
    data = JSON.parse(stripBom(readFileSync(manifestPath, "utf8")));
  } catch {
    return [];
  }
  const deps = (data as { dependencies?: unknown })?.dependencies;
  if (!Array.isArray(deps)) return [];
  const out: DepSpec[] = [];
  for (const d of deps) {
    const rec = d as { id?: unknown; min_version?: unknown };
    if (typeof rec?.id !== "string" || !rec.id.trim()) continue;
    out.push({
      id: rec.id.trim(),
      minVersion: typeof rec.min_version === "string" ? rec.min_version : null,
    });
  }
  return out;
}

/**
 * 去掉 UTF-8 BOM。
 *
 * 上游写 manifest 的工具常带 BOM（BaseLib 自己的 `BaseLib.json` 就有）。
 * Godot 的解析器接受，Node 的 `JSON.parse` 直接抛 —— 不处理会把「依赖存在」误判成「不存在」。
 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 把 `v3.4.7` / `3.4.7-beta.1` 拆成数字段；非数字段忽略。读不懂返回 null。 */
export function parseVersion(value: string | null | undefined): number[] | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^v?(\d+(?:\.\d+)*)/i);
  if (!m) return null;
  return m[1].split(".").map((n) => Number.parseInt(n, 10));
}

/** -1 / 0 / 1。任一读不懂返回 null（不猜）。 */
export function compareVersions(a: string | null, b: string | null): -1 | 0 | 1 | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * 读某个目录里的 mod manifest，返回 `{ id, version }`。
 *
 * 目录里可能有多份 json（游戏自带模组也这么放），所以按 id 找：
 * `<id>.json` 优先，其次任何一份 id 对得上的。文件名不对不算，交给调用方判断。
 */
function manifestCandidates(dir: string, id: string): string[] {
  const preferred = join(dir, `${id}.json`);
  const rest = safeReaddir(dir)
    .filter((n) => n.toLowerCase().endsWith(".json") && join(dir, n) !== preferred)
    .sort()
    .map((n) => join(dir, n));
  return existsSync(preferred) ? [preferred, ...rest] : rest;
}

function readManifestIn(dir: string, id: string): { version: string | null } | null {
  for (const p of manifestCandidates(dir, id)) {
    try {
      const data = JSON.parse(stripBom(readFileSync(p, "utf8"))) as {
        id?: unknown;
        version?: unknown;
      };
      if (data?.id !== id) continue;
      return { version: typeof data.version === "string" ? data.version : null };
    } catch {
      /* 坏 json 跳过，继续找下一份 */
    }
  }
  return null;
}

/** Read a dependency's own dependencies from either official manifest naming convention. */
export function readDependencySpecsInDir(dir: string, id: string): DepSpec[] {
  for (const path of manifestCandidates(dir, id)) {
    try {
      const data = JSON.parse(stripBom(readFileSync(path, "utf8"))) as { id?: unknown };
      if (data.id === id) return readDependencySpecs(path);
    } catch {
      /* Try the next manifest. */
    }
  }
  return [];
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * 扫一个目录树，找出 id 对得上的 mod。
 *
 * **必须递归。** 游戏的 `ModManager.ReadModsInDirRecursive` 是递归扫 `mods/` 的，
 * 所以 `mods/dev/BaseLib` 是能被加载的。只看一层的话，我们会把一个玩家已经装好的依赖
 * 判成「没有」，于是再放一份进去 —— 结果是 `DUPLICATE_ID`，两份都留着。
 *
 * 跳过以 `.` 开头的目录：那是我们自己的中转目录（`.staging-*`），不是 mod。
 * `depth` 上限防住符号链接成环或异常深的树。
 */
function findModInTree(
  root: string,
  id: string,
  source: DepSource,
  depth = 0,
): DepInstall[] {
  if (depth > MAX_DEPTH) return [];
  const out: DepInstall[] = [];
  for (const entry of safeReaddir(root)) {
    if (entry.startsWith(".")) continue;
    const dir = join(root, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const m = readManifestIn(dir, id);
    // 一个目录只算一份。游戏也是这么做的：一个目录一个 manifest。
    if (m) out.push({ source, dir, version: m.version });
    // 继续往下找：同一个 mod 可能被放在更深的子目录里，也可能真有两份。
    out.push(...findModInTree(dir, id, source, depth + 1));
  }
  return out;
}

/** 本地装的那份：`<mods directory>` 下的任意深度。 */
function findLocal(modRoot: string | null, id: string): DepInstall[] {
  if (!modRoot || !existsSync(modRoot)) return [];
  return findModInTree(modRoot, id, "local");
}

/** Workshop 订阅的那份：`<workshopDir>/<publishedFileId>/`（目录名是数字 id，不是 mod id）。 */
function findWorkshop(workshopDir: string | null, id: string): DepInstall[] {
  if (!workshopDir || !existsSync(workshopDir)) return [];
  return findModInTree(workshopDir, id, "workshop");
}

/** 版本比较用的最大值：取高，不取先找到的那份。读不出版本的排最后。 */
function highest(installs: DepInstall[]): DepInstall | null {
  if (!installs.length) return null;
  return installs.reduce((best, cur) => {
    if (!best.version) return cur.version ? cur : best;
    if (!cur.version) return best;
    const cmp = compareVersions(cur.version, best.version);
    return cmp !== null && cmp > 0 ? cur : best;
  });
}

export interface ResolveContext {
  /** 游戏的 mods 目录（本地那份的父目录） */
  modRoot: string | null;
  /** `steamapps/workshop/content/<appId>`；没有创意工坊内容时为 null */
  workshopDir: string | null;
}

/** 把一条依赖解析成「装了几份、从哪来、版本够不够」。 */
export function resolveDependency(spec: DepSpec, ctx: ResolveContext): DepResolution {
  const local = findLocal(ctx.modRoot, spec.id);
  const workshop = findWorkshop(ctx.workshopDir, spec.id);
  const installations = [...local, ...workshop];
  // 谁决定生效版本：本地优先（与加载器一致），本地内部取最高。
  // 只取「先找到的那份」会让结果依赖目录顺序，同一个机器两次跑出不同结论。
  const effective = highest(local) ?? highest(workshop);
  const satisfies =
    !spec.minVersion || !effective ? null : compareVersions(effective.version, spec.minVersion);
  return {
    spec,
    installations,
    satisfies: satisfies === null ? null : satisfies >= 0,
  };
}

export type DepAction =
  | { kind: "ok" } // 已装且版本够（或没声明基线）
  | { kind: "install-bundled" } // 一份都没有 → 允许落我们随仓带的那份
  | { kind: "warn-too-old" } // 有，但低于 min_version → 不覆盖，让玩家升级
  | { kind: "warn-duplicate" } // 本地 + Workshop 都有 → 本地会盖掉 Workshop，提示删本地
  | { kind: "warn-duplicate-local" } // 本地有两份 → 先加载的那份赢，另一份报 DUPLICATE_ID
  | { kind: "warn-unknown-version" }; // 有，但读不出版本 → 不判断，提示确认

/**
 * 决定对一条依赖做什么。**凡是已经有任何一份，就不装** —— 见文件头。
 */
export function decideDependencyAction(res: DepResolution): DepAction {
  const { installations, satisfies, spec } = res;
  if (installations.length === 0) return { kind: "install-bundled" };
  const locals = installations.filter((i) => i.source === "local");
  const hasWorkshop = installations.some((i) => i.source === "workshop");
  // 重复优先报：这是唯一会让玩家「更新了却没生效」的状态。
  if (locals.length && hasWorkshop) return { kind: "warn-duplicate" };
  // 两份本地副本：游戏按扫描顺序先加载一份，另一份在 ModelDb 里撞 id → DUPLICATE_ID。
  if (locals.length > 1) return { kind: "warn-duplicate-local" };
  if (satisfies === false) return { kind: "warn-too-old" };
  if (satisfies === null && spec.minVersion) return { kind: "warn-unknown-version" };
  return { kind: "ok" };
}
