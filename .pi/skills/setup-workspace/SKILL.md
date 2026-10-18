---
name: setup-workspace
description: 第一次在本工作区工作时用，例如工具说路径没记录、SDK 没装、或玩家问「环境准备好了吗」。也用于换机器后重新就位。不适用：写 mod（见 mod-creator）、把 mod 装进游戏（见 mod-installer）。
---

# 让工作区就位

**目标**：把「能编译、能安装」的前置条件逐个确认好。每个前置都有专用工具，不得跳步，也不得一次问玩家一堆问题。

## 1. 需要的输入

只有一项需要问玩家：游戏装在哪。默认先自己找，找不到再问。

| 项 | 默认 |
|---|---|
| 游戏目录 | 先跑 `try_set_game_dir`（无参）。它会扫 Steam 库并验证；失败时才请玩家给出路径 |
| .NET SDK | 不问玩家。`check_runtime` 会查 |
| mod 加载开关 | 不问玩家。`install_mod` 会报 |

## 2. 做

按顺序四步，每步看到 PASS 才进下一步。

1. `check_runtime`（无参）。要求 .NET 9 SDK。返回 FAIL 时跑 `install_runtime` 拿安装指引，装完再跑一次 `check_runtime`。
   为什么是 9：游戏用 `net9.0`，SDK 8 会在编译时报 `NETSDK1045`。出处：`mod-repo.json` 的 `compile.sdkMajor`，以及本机实测。
   同一步还会跑 `dotnet tool restore`，把仓库锁定的反编译器装好。**这个反编译器不是 SDK 自带的**：它是第三方包（ILSpy Team），`dotnet` 只提供安装机制。所以**第一次需要联网**（约 11 MB），之后走本机 NuGet 缓存。
2. `try_set_game_dir`（无参）。它做三件事：发现游戏目录、派生 mod 目录与数据目录、写进 `.gamer-agent.local.json`。
3. `check_game_paths`（无参）。只读校验上一步记下的路径。全部 PASS 才算就位。
4. 只在要编译时：确认 `validate_mod` 能跑（见 mod-creator）。

`install_runtime` 只给指引，不执行安装。需要玩家自己确认时才用。

## 3. 验收

- `check_runtime` 返回 PASS 且报出 dotnet 版本。
- `try_set_game_dir` 报出 gameDir 与 modInstallDir 两条路径。
- `check_game_paths` 对 gameDir 与 modInstallDir 都返回 PASS。

macOS 上 modInstallDir 形如 `.../SlayTheSpire2.app/Contents/MacOS/mods`。它确实在 `.app` 包内，这是游戏的规定，不是配置错误。出处：反编译 `ModManager.Initialize` 取 `Path.GetDirectoryName(OS.GetExecutablePath())` 再拼 `mods`。

## 4. 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| `check_runtime` 报 SDK 太旧 | 本机原有 SDK 8，游戏要 9 | 跑 `install_runtime` 按指引装 .NET 9，然后重跑 `check_runtime` |
| `try_set_game_dir` 找不到游戏 | Steam 库在非默认盘，或游戏没装 | 请玩家给出安装目录，再用 `set_game_dir` 记录 |
| `check_game_paths` 报 modInstallDir 不存在 | mods 目录需要时创建，游戏不会建 | 正常。`install_mod` 会创建它 |
| `check_game_paths` 报 Workshop 目录没记录 | 玩家没订阅任何 mod | 正常，可选参考路径。不影响做 mod |
| 路径 PASS 但游戏里看不到 mod | 加载总开关是关闭的 | 见 mod-installer 的验收段 |
| `Local tools restored` 这句话没出现 | 仓库里没有 `.config/dotnet-tools.json`，或 restore 失败 | restore 失败时会写 WARN 并说明原因。没有网时它会失败，此时 `inspect_game_api` 只能读文档，**清单不完整** |
