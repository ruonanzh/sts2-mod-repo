---
name: mod-installer
description: 玩家说「装进游戏」「我要试一下」「装好了吗」时用。覆盖复制产物、确认加载开关、重启游戏、看日志确认。不适用：还没编译过的 mod（先见 mod-creator）、环境路径还没记录（先见 setup-workspace）。
---

# 把 mod 装进游戏

**目标**：让 mod 真的被游戏加载，并且用日志证明它加载了。这一步不等同于「文件复制成功」。

## 1. 需要的输入

只有一项：装哪个 mod（`your_mods/` 下的目录名）。路径从状态文件来，不问玩家。

## 2. 做

1. `install_mod modDir=your_mods/<名字>`。它会把 `<id>.json` 与 `<id>.dll` 复制到游戏 mods 目录下自己的子目录。
2. 读返回里的 `mods_enabled`：

   | 值 | 含义 | 下一步 |
   |---|---|---|
   | `true` | 会加载 | 直接重启游戏 |
   | `false` | 总开关关着，所有 mod 都会被判 Disabled，而且**不报错** | 告诉玩家去游戏内的 Mod Settings 打开，再重启 |
   | 读不到 | 玩家还没进过游戏，或存档路径不同 | 让玩家重启游戏后看日志；看不到 mod 时再回来查开关 |

   为什么单独报这个：加载器在 `PlayerAgreedToModLoading` 为 false 时直接 `mod_states = Disabled`，日志只有 `Skipping loading mod <id>, user has not yet seen the mods warning`。字段在存档里的名字是 `mods_enabled`。
3. 重启游戏。新装上的 mod 只在启动时被发现，运行中装进去不会被加载。
4. 带启动参数时走 Steam：`open "steam://rungameid/2868840//-nomods"`。直接跑包内二进制不是正统路径。

## 3. 验收

看日志 `~/Library/Application Support/SlayTheSpire2/logs/godot.log`，四行都要出现：

```
Found mod manifest file .../mods/<目录>/<id>.json
Loading assembly DLL .../mods/<目录>/<id>.dll
Calling initializer method of type <T> for <id>, Version=...
 --- RUNNING MODDED! --- Loaded N mods (M total)
```

只看到第一行时，程序集没加载：检查 `has_dll` 与文件名。看到前两行但没有第三行时，程序集加载了但没有 `[ModInitializer]`。

另外确认了两点再算收工：游戏里 mod 列表能看到它，并且存档走的是 modded 分支（日志 `Profile-scoped data path initialized: user://steam/<id>/modded/profileN`）。

## 4. 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| 装完游戏里没有 | 加载总开关关着 | 见上表 |
| 装了但日志里第一行都没有 | mods 目录位置不对 | `check_game_paths` 复核 modInstallDir |
| 目录名带 `_pimod` | 目标目录被别的 mod 占着 | 正常行为，没覆盖别人。告诉玩家装了两份 |
| 游戏里显示 duplicate | 同一个 mod 同时在 Workshop 与本地 | 正常行为：本地优先 |
| 日志说版本不支持 | 清单的 `min_game_version` 高于装机版本 | 改了游戏版本后要同步改清单 |
| 装完闪退 | 入口方法不是静态，或装载时抛异常 | 看日志里的 `Exception thrown when calling mod initializer` |
