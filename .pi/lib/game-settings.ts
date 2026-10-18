/**
 * 读游戏的用户设置（**共享**：install_mod 与 runtime-check 都用这一份）。
 *
 * 为什么需要：StS2 有一个**总开关** `mod_settings.mods_enabled`。为 false 时，
 * 加载器把每个 mod 都判成 `ModLoadState.Disabled`，日志只有一句
 * `Skipping loading mod <id>, user has not yet seen the mods warning` ——
 * 不报错、也不提示怎么开。所以「装进去了」和「会被加载」是两件事，必须分开报。
 *
 * 踩过的坑：反编译里这个字段叫 `ModSettings.PlayerAgreedToModLoading`，
 * 但落盘名是 `mods_enabled`（SettingsSave v5，SnakeCaseLower 策略）。
 * 按属性名猜出来的键会被静默丢弃。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Godot 的自定义用户目录（`application/config/use_custom_user_dir=true`，name = SlayTheSpire2）。 */
export function userDataDir(): string | null {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "SlayTheSpire2");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    return appData ? join(appData, "SlayTheSpire2") : null;
  }
  const xdg = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
  return join(xdg, "SlayTheSpire2");
}

/**
 * settings.save 的位置。
 *
 * 实际路径是 `<userData>/steam/<steamId>/settings.save`（Steam 存档模式下按账号分目录）。
 * 不同版本也可能直接放在 `<userData>/settings.save`，所以两处都看；
 * steam 下取**最近修改**的那一个（多账号时那是当前账号）。
 */
export function findSettingsSave(): string | null {
  const root = userDataDir();
  if (!root) return null;
  const direct = join(root, "settings.save");
  const found: { path: string; mtime: number }[] = [];
  if (existsSync(direct)) {
    try {
      found.push({ path: direct, mtime: statSync(direct).mtimeMs });
    } catch {
      /* ignore */
    }
  }
  const steamRoot = join(root, "steam");
  if (existsSync(steamRoot)) {
    try {
      for (const account of readdirSync(steamRoot)) {
        const p = join(steamRoot, account, "settings.save");
        if (!existsSync(p)) continue;
        try {
          found.push({ path: p, mtime: statSync(p).mtimeMs });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0].path;
}

export interface ModLoadingState {
  /** 设置文件路径；找不到为 null */
  settingsPath: string | null;
  /**
   * 加载总开关。true = 会加载；false = 全部 Disabled；null = 读不到
   * （没有存档 = 玩家还没进过游戏，或字段还没写）。
   */
  modsEnabled: boolean | null;
  /** `mod_settings.mod_list` 里记录的 mod 数（只用于说明，不做判断） */
  listedMods: number;
}

/** 读 `mod_settings.mods_enabled`。任何解析失败都退回 null（不猜）。 */
export function readModLoadingState(): ModLoadingState {
  const settingsPath = findSettingsSave();
  if (!settingsPath) return { settingsPath: null, modsEnabled: null, listedMods: 0 };
  try {
    const raw = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      mod_settings?: { mods_enabled?: boolean; mod_list?: unknown[] } | null;
    };
    const ms = raw.mod_settings;
    const modsEnabled = typeof ms?.mods_enabled === "boolean" ? ms.mods_enabled : null;
    const listedMods = Array.isArray(ms?.mod_list) ? ms!.mod_list!.length : 0;
    return { settingsPath, modsEnabled, listedMods };
  } catch {
    return { settingsPath, modsEnabled: null, listedMods: 0 };
  }
}
