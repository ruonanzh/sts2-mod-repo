/**
 * mod 身份的判据（**共享**：mod-lint 与 mod-install 都用这一份，避免两边各自实现后漂移）。
 *
 * StS2 的游戏硬规则（反编译 `MegaCrit.Sts2.Core.Modding.ModManager` 得到）：
 *   · 清单文件是 `<id>.json`，**文件名必须等于 `id`**；
 *   · 程序集按 `Path.Combine(mod.path, modId + ".dll")` 读取，所以 `<id>.dll` 也必须同名；
 *   · 加载器会把目录里**任何** `.json` 当清单（缺 `id` 就报错跳过）——所以 mod 目录只能有一个 json。
 *
 * 因此「目录名 / 文件名 / id」三者必须一致；这里只负责判据，不改磁盘。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 游戏反编译出的合法键集合。多一个键不报错（System.Text.Json 忽略未知键），但我们要主动拦，
 *  因为它们几乎总是拼写错误，而拼错 `has_dll` 的后果是「静默不加载程序集」。 */
export const MANIFEST_KEYS = [
  "id",
  "name",
  "author",
  "description",
  "version",
  "has_pck",
  "has_dll",
  "dependencies",
  "affects_gameplay",
  "min_game_version",
] as const;

/** `id` 会被拼进文件路径（`<id>.dll`）与 Harmony 实例名，只允许单段标识符。 */
export const CODE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const isCodeIdentifier = (v: string): boolean => CODE_IDENTIFIER_RE.test(v);

export interface ModDependency {
  id?: string;
  min_version?: string;
}

export interface ModManifestData {
  id?: string;
  name?: string;
  author?: string;
  description?: string;
  version?: string;
  has_pck?: boolean;
  has_dll?: boolean;
  dependencies?: ModDependency[] | null;
  affects_gameplay?: boolean;
  min_game_version?: string;
}

export interface ModIdentity {
  /** manifest 的 id，同时是产物文件名前缀 */
  id: string;
  /** 显示名 */
  name: string;
  version: string;
  /** 清单文件的绝对路径 */
  manifestPath: string;
}

export type ManifestResult =
  | { ok: true; identity: ModIdentity; data: ModManifestData }
  | { ok: false; reason: string };

/**
 * 读 mod 目录里的清单。
 *
 * 失败条件（每一条都对应一种真实踩法）：
 *   · 没有 json → 加载器根本发现不了；
 *   · 多个 json → 加载器会挨个当清单读，多出来的那个若带 `id` 就会变成第二个 mod（或 DUPLICATE_ID）；
 *   · 文件名与 `id` 不一致 → 加载器按 `<id>.dll` 找程序集，找不到就 Disabled/Failed；
 *   · `id` 非法标识符 → 路径/Harmony 名字出问题。
 */
export function readManifest(modDir: string): ManifestResult {
  if (!existsSync(modDir)) return { ok: false, reason: `mod directory not found: ${modDir}` };

  let entries: string[];
  try {
    entries = readdirSync(modDir);
  } catch (e) {
    return { ok: false, reason: `cannot read mod directory: ${(e as Error).message}` };
  }

  const jsons = entries.filter((f) => f.toLowerCase().endsWith(".json") && !f.startsWith("."));
  if (jsons.length === 0) {
    return { ok: false, reason: "no .json manifest in the mod directory. The loader only finds a mod through <id>.json" };
  }
  if (jsons.length > 1) {
    return {
      ok: false,
      reason: `found ${jsons.length} .json files at the top of the mod directory (${jsons.join(", ")}). The loader treats every .json as a manifest, so a mod directory may contain exactly one`,
    };
  }

  const file = jsons[0];
  const manifestPath = join(modDir, file);
  let data: ModManifestData;
  try {
    data = JSON.parse(readFileSync(manifestPath, "utf8")) as ModManifestData;
  } catch (e) {
    return { ok: false, reason: `${file} is not valid JSON: ${(e as Error).message}` };
  }

  const id = typeof data.id === "string" ? data.id.trim() : "";
  if (!id) {
    return { ok: false, reason: `${file} has no "id". The loader skips manifests without an id` };
  }
  if (!isCodeIdentifier(id)) {
    return {
      ok: false,
      reason: `id "${id}" is not a plain identifier. It becomes a file name (<id>.dll) and part of the Harmony instance name`,
    };
  }

  const stem = file.slice(0, -".json".length);
  if (stem !== id) {
    return {
      ok: false,
      reason: `manifest file is ${file} but its id is "${id}". The loader reads the assembly from <id>.dll, so the file must be named ${id}.json`,
    };
  }

  return {
    ok: true,
    data,
    identity: {
      id,
      name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : id,
      version: typeof data.version === "string" ? data.version.trim() : "",
      manifestPath,
    },
  };
}

/** 只要 id/name/version 时的便捷入口（install 用）。 */
export function readModIdentity(modDir: string): ModIdentity | null {
  const r = readManifest(modDir);
  return r.ok ? r.identity : null;
}

/**
 * 粗粒度 semver 检查。游戏用 `SemanticVersion` 解析 manifest 的 `version`；
 * 解析失败时 `Mod.version` 为 null，依赖方声明 `min_version` 就会判 FAILED。
 * 所以 version 必须是「至少 x.y.z」。
 */
export function isParseableVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+/.test(v.replace(/^v/i, ""));
}
