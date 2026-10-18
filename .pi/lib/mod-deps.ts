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
function readManifestIn(dir: string, id: string): { version: string | null } | null {
  const preferred = join(dir, `${id}.json`);
  const candidates = existsSync(preferred)
    ? [preferred]
    : safeReaddir(dir)
        .filter((n) => n.toLowerCase().endsWith(".json"))
        .map((n) => join(dir, n));
  for (const p of candidates) {
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

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** 本地装的那份：`<modRoot>/<任意目录>/<id>.json`。可能有多个目录（历史遗留），全收。 */
function findLocal(modRoot: string | null, id: string): DepInstall[] {
  if (!modRoot || !existsSync(modRoot)) return [];
  const out: DepInstall[] = [];
  for (const entry of safeReaddir(modRoot)) {
    const dir = join(modRoot, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const m = readManifestIn(dir, id);
    if (m) out.push({ source: "local", dir, version: m.version });
  }
  return out;
}

/** Workshop 订阅的那份：`<workshopDir>/<publishedFileId>/`（目录名是数字 id，不是 mod id）。 */
function findWorkshop(workshopDir: string | null, id: string): DepInstall[] {
  if (!workshopDir || !existsSync(workshopDir)) return [];
  const out: DepInstall[] = [];
  for (const entry of safeReaddir(workshopDir)) {
    const dir = join(workshopDir, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const m = readManifestIn(dir, id);
    if (m) out.push({ source: "workshop", dir, version: m.version });
  }
  return out;
}

export interface ResolveContext {
  /** 游戏的 mods 目录（本地那份的父目录） */
  modRoot: string | null;
  /** `steamapps/workshop/content/<appId>`；没有创意工坊内容时为 null */
  workshopDir: string | null;
}

/** 把一条依赖解析成「装了几份、从哪来、版本够不够」。 */
export function resolveDependency(spec: DepSpec, ctx: ResolveContext): DepResolution {
  const installations = [...findLocal(ctx.modRoot, spec.id), ...findWorkshop(ctx.workshopDir, spec.id)];
  // 多份时取最熟悉的那份（本地优先，与游戏加载器一致）来判断版本是否达标
  const shown = installations.find((i) => i.source === "local") ?? installations[0] ?? null;
  const satisfies =
    !spec.minVersion || !shown
      ? null
      : compareVersions(shown.version, spec.minVersion);
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
  | { kind: "warn-unknown-version" }; // 有，但读不出版本 → 不判断，提示确认

/**
 * 决定对一条依赖做什么。**凡是已经有任何一份，就不装** —— 见文件头。
 */
export function decideDependencyAction(res: DepResolution): DepAction {
  const { installations, satisfies, spec } = res;
  if (installations.length === 0) return { kind: "install-bundled" };
  const hasLocal = installations.some((i) => i.source === "local");
  const hasWorkshop = installations.some((i) => i.source === "workshop");
  // 重复优先报：这是唯一会让玩家「更新了却没生效」的状态。
  if (hasLocal && hasWorkshop) return { kind: "warn-duplicate" };
  if (satisfies === false) return { kind: "warn-too-old" };
  if (satisfies === null && spec.minVersion) return { kind: "warn-unknown-version" };
  return { kind: "ok" };
}
