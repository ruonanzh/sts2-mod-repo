/**
 * 判断"探针要不要重新构建"的 helper。只有一个调用方：`.pi/lib/decompile.ts`，也就是
 * `inspect_game_code` 的 dump 路径。
 *
 * `inspect_game_api` 不经过这里：它直接运行 `tools/api-probe`，构建由 `check_runtime` 负责。
 * 这里只管一件事：探针 DLL 是否比它的源码新。增量构建虽快，但每次 `dotnet build` 都有
 * MSBuild 开销，没必要白跑。
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 探针 DLL 已存在、且比它的源码/依赖都新 → 无需重建。 */
export function probeUpToDate(probeDir: string, probeDll: string): boolean {
  if (!existsSync(probeDll)) return false;
  const dllTime = statSync(probeDll).mtimeMs;
  const watched: string[] = [];
  try {
    for (const e of readdirSync(probeDir)) {
      if (e.endsWith(".cs") || e.endsWith(".csproj")) watched.push(join(probeDir, e));
    }
  } catch {
    return false;
  }
  const libDir = join(probeDir, "lib");
  if (existsSync(libDir)) {
    try {
      for (const e of readdirSync(libDir)) watched.push(join(libDir, e));
    } catch {
      // ignore: 读不到 lib/ 目录就不看它，仍按其余源文件判断
    }
  }
  return watched.every((p) => {
    try {
      return statSync(p).mtimeMs <= dllTime;
    } catch {
      return false;
    }
  });
}
