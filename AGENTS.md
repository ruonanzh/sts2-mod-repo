# AGENTS.md

这个仓库是 **Slay the Spire 2 的 mod 工作区**。玩家（和 AI agent）在这里就能做 mod：读 `docs/` 了解格式，在 `your_mods/<mod名>/` 下产出 mod，用 `validate_mod` 校验、`install_mod` 装进游戏。

游戏事实全部来自实测与反编译，出处写在 `docs/`。改这里的结论前先看 `docs/traps.md`。

## 环境事实（本机实测，2026-10-18）

| 项 | 值 |
|---|---|
| 游戏 | `v0.107.1`，commit `59260271`；Steam appid `2868840` |
| 引擎 | Godot 4.5.1（MegaCrit 自编译的 `MegaDot`）+ C# `net9.0`（自带 .NET 9.0.7） |
| 编译 | 需要 .NET **9** SDK（`net9.0`；SDK 8 会报 `NETSDK1045`） |
| mod 根 | macOS：`SlayTheSpire2.app/Contents/MacOS/mods/`；Windows：`<安装目录>/mods/` |
| 启动 | **必须过 Steam**。带参数用 `open "steam://rungameid/2868840//-nomods"` |

## mod 是什么（一个目录 + 两个同名文件）

```
your_mods/<目录名>/
├─ <id>.json    清单，**文件名必须等于 id**
├─ <id>.dll     程序集，**文件名必须等于 id**
└─ <id>.csproj  构建工程，AssemblyName 必须等于 id
```

加载器按 `id` 找文件，**目录名不参与**。目录里**只能有一个 `.json`**：加载器把任何 `.json` 都当清单读。

入口是一个 `[ModInitializer("方法名")]` 标在类型上，方法**必须 static 且无参**。没有该特性时加载器自动 `Harmony.PatchAll(assembly)`。

## 目录职责

- `reference/example_mod/`：新 mod 的起点。复制后改三个名字（csproj 的 `AssemblyName`、`Entry.cs` 的 namespace、`<name>.json` 的 `id`），三者必须一致。
- `.pi/lib/`：判据（**单一事实源**）。`game-paths.ts` 路径、`dotnet.ts` SDK、`game-settings.ts` 加载开关、`mod-identity.ts` 清单规则。
- `.pi/extensions/`：工具。**不得**出现游戏类名/目录名，一律走 `mod-repo.json`。
- `docs/`：游戏本身的机制、路径、坑。
- `mod-repo.json`：唯一的契约文件（常量，不含判据）。

## 接入前必须回答的 8 个问题（StS2 的答案）

| # | 问题 | 答案 | 出处 |
|---|---|---|---|
| 1 | 怎么加载 mod？ | 官方内建 `ModManager`：扫 `mods/` 递归，读每个 `.json` 当清单，按 `id` 装 `<id>.dll` | `docs/game.md` |
| 2 | 产物放哪？名字有什么关系？ | 放 mods 根下的任意子目录（递归扫）；**文件名 = manifest 的 `id`**，与目录名无关 | `docs/game.md` |
| 3 | 入口叫什么？生命周期？ | `[ModInitializer("Init")]` + `public static void Init()`；无特性则自动 `Harmony.PatchAll` | `docs/game.md` |
| 4 | 资产放哪？ | v1 **不带资产**（DLL-only）。要放时是 Godot `.pck`（`has_pck`），见 `docs/game.md` | `docs/game.md` |
| 5 | 内容用什么标识？ | 类名 + 命名空间（`CustomCardModel` 等，BaseLib 会自动加 `MODID-` 前缀）；卡图按 `Pool.Title` + `Id.Entry` | `docs/game.md` |
| 6 | 有哪些容器概念？ | 卡池 / 遗物池 / 药水池 / 事件 / 遭遇 / Act / 角色；用 `[Pool(typeof(...))]` 归属 | `docs/game.md` |
| 7 | 本地化怎么存？ | `localization/<eng\|zhs\|...>/<族>.json`，扁平 map，键形如 `MODID-MODEL.title` | `docs/game.md` |
| 8 | 什么改动会静默失效？ | 见 `docs/traps.md`（这是这个仓库最重要的一页） | `docs/traps.md` |

## 硬规则

- **不猜类名/字段名**：查 `sts2.xml`（游戏自带 19635 条 API 文档）或反编译 `sts2.dll`，把命令写进 `docs/`。
- **装进去 ≠ 会被加载**：游戏的 `settings.save` 里有总开关 `mod_settings.mods_enabled`，为 `false` 时每个 mod 都 `Disabled` 且**不报错**。`install_mod` 会报这个状态；为 false 时必须告诉玩家去开。
- **不写游戏目录里的其他文件**：只往 mods 根下写自己的目录，不碰 `settings.save`、不碰 `.pck`。
- **一次改动一次验证**：改完要能编译、能加载，并给出可复现的检查方式（看 `godot.log`）。
- **工具里不许出现游戏常量**：路径、程序集名、appid 都从 `mod-repo.json` 来。
- **不假设有资产**：v1 是纯 DLL。要加 `.pck` 先改 `mod-repo.json` 的 `compile.pck` 并打通导出链。

## 维护者

`.pi/dev-harness.mjs` 可以在不启动会话的情况下跑单个工具（用于本地改完自测）。它需要 `node_modules/` 里的两个空壳（`typebox`、`@earendil-works/pi-coding-agent`），这两个不进库。
