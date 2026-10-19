/**
 * 可查的程序集清单（**共享**：inspect_game_api 用它；validate_mod 将来也能用它判断
 * 「你引用了 BaseLib 却没在 manifest 里声明依赖」）。
 *
 * 两类来源，路径规则完全不同：
 *   · 游戏程序集：来自 `mod-repo.json` 的 `compile.references`，落在游戏数据目录里；
 *   · 包程序集：来自 `compile.packages`，落在 NuGet 全局缓存里，**版本不写进清单**
 *     （取本机已 restore 的最高版本——那才是编译时真正用的那一份）。
 *
 * 每个来源自带一个「根目录」：`tools/api-probe` 用 `--managed <dir> --dll <name>`，
 * 而 `--dll` 是按 `--managed` 解析的相对名。所以工具要**按根目录分组跑多次**，
 * 这不是妥协：两个根本来就不在同一个目录树里。
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

export interface ApiSource {
  /** 输出里用的短标签，来自清单（游戏固定是 "game"） */
  label: string;
  /** 程序集短名，用于报错与说明 */
  assembly: string;
  dllPath: string;
  /** api-probe 的 --managed：就是 dll 所在目录 */
  root: string;
  /** 包来源的版本号；游戏程序集为 null */
  version: string | null;
}

export interface ResolvedSources {
  sources: ApiSource[];
  /** 解析过程中的说明，直接拼进工具输出 */
  notes: string[];
}

export interface PackageSpec {
  id: string;
  label: string;
  assembly: string;
}

/** 语义化版本比较（够用即可：只处理数字段）。 */
function cmpVersion(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** NuGet 全局缓存根（尊重 NUGET_PACKAGES，默认 ~/.nuget/packages）。 */
function nugetRoot(): string {
  return process.env.NUGET_PACKAGES?.trim() || join(homedir(), ".nuget", "packages");
}

/**
 * 在 NuGet 缓存里找一个包程序集。
 *
 * 版本不在清单里钉死，因为 BaseLib 会升级；钉死会让清单在玩家装了新版之后失效。
 * 这里取**本机已 restore 的最高版本**，并把实际版本报出去，让「查的是哪一版」可回溯。
 */
function findPackageAssembly(spec: PackageSpec): { dllPath: string; version: string } | null {
  const pkgDir = join(nugetRoot(), spec.id.toLowerCase());
  if (!existsSync(pkgDir)) return null;
  let versions: string[];
  try {
    versions = readdirSync(pkgDir).filter((v) => {
      try {
        return statSync(join(pkgDir, v)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return null;
  }
  versions.sort((a, b) => cmpVersion(b, a));
  for (const version of versions) {
    const libDir = join(pkgDir, version, "lib");
    if (!existsSync(libDir)) continue;
    // 优先 net9.0（游戏的目标框架），否则取任意一个含该程序集的 TFM 目录。
    let tfms: string[];
    try {
      tfms = readdirSync(libDir);
    } catch {
      continue;
    }
    tfms.sort((a, b) => (a === "net9.0" ? -1 : b === "net9.0" ? 1 : a.localeCompare(b)));
    for (const tfm of tfms) {
      const dll = join(libDir, tfm, spec.assembly);
      if (existsSync(dll)) return { dllPath: dll, version };
    }
  }
  return null;
}

export interface SourceInputs {
  /** 游戏数据目录（已由路径工具确认） */
  managedDir: string | null;
  /** `compile.references`：文件名，相对 managedDir */
  references: string[];
  /** `compile.packages` */
  packages: PackageSpec[];
}

/** 把清单解析成「实际能打开的程序集」列表。缺项只记 NOTE，不抛。 */
export function resolveApiSources(inputs: SourceInputs): ResolvedSources {
  const sources: ApiSource[] = [];
  const notes: string[] = [];

  if (inputs.managedDir && existsSync(inputs.managedDir)) {
    for (const ref of inputs.references) {
      const dll = join(inputs.managedDir, ref);
      if (!existsSync(dll)) {
        notes.push(`NOTE: the game assembly ${ref} was not found in the data directory, so it was skipped.`);
        continue;
      }
      sources.push({
        label: "game",
        assembly: basename(dll, ".dll"),
        dllPath: dll,
        root: dirname(dll),
        version: null,
      });
    }
  } else {
    notes.push("NOTE: the game data directory is not recorded, so only package assemblies were searched.");
  }

  for (const spec of inputs.packages) {
    const hit = findPackageAssembly(spec);
    if (!hit) {
      notes.push(
        `NOTE: package ${spec.id} is not in the NuGet cache, so ${spec.label} was not searched. It arrives with "dotnet restore" in a mod that references it.`,
      );
      continue;
    }
    sources.push({
      label: spec.label,
      assembly: basename(hit.dllPath, ".dll"),
      dllPath: hit.dllPath,
      root: dirname(hit.dllPath),
      version: hit.version,
    });
  }

  return { sources, notes };
}
