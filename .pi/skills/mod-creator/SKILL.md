---
name: mod-creator
description: 玩家想做一个 mod、加一段玩法、改卡牌数值、或加一张新卡时用。覆盖从复制样例到编译通过的整段。不适用：只把已有 mod 装进游戏（见 mod-installer）、环境还没就位时（见 setup-workspace）。
---

# 做一个 mod

**目标**：产出一个能编译、能过 `validate_mod` 的 mod 目录。不管玩法，只保证结构正确。

## 1. 需要的输入

| 问 | 默认 |
|---|---|
| 做什么 | 必须问清。一句话即可，例如「加一张 2 费的攻击牌」 |
| mod 叫什么 | 玩家给的目录名。它只决定目录，不决定游戏里的名字 |
| 用不用 BaseLib | 加内容（卡牌、遗物、事件、角色）时用；只打补丁可以不用 |

## 2. 做

1. 复制样例目录，然后**一次改三处同名的地方**：

   ```
   cp -r reference/example_mod your_mods/<你的名字>
   ```

   | 改哪里 | 改成什么 |
   |---|---|
   | `.csproj` 的 `<AssemblyName>` | 你的 mod id |
   | `Entry.cs` 的 `namespace` | 同上 |
   | `<名字>.json` 的文件名与 `id` 字段 | 同上 |

   三处必须完全一致。加载器按 `<id>.dll` 读程序集，文件名与 id 不一致时它会静默不加载。

2. 写或改入口。入口方法是静态、无参：

   ```csharp
   [ModInitializer(nameof(Init))]
   public static class Entry
   {
       public static void Init() { /* 你的 mod */ }
   }
   ```

3. 写清单。只允许这 10 个键：`id`、`name`、`author`、`description`、`version`、`has_pck`、`has_dll`、`dependencies`、`affects_gameplay`、`min_game_version`。

   | 键 | 这个仓库的写法 |
   |---|---|
   | `has_dll` | 必须 `true` |
   | `has_pck` | v1 必须是 `false`；写了 `true` 却不出 `.pck` 会在装载时抛异常 |
   | `version` | 必须是 `x.y.z`。解析失败会让依赖它的 mod 全部失败 |
   | `min_game_version` | 写本机版本（当前 `0.107.1`）。不写只出 WARN |
   | `affects_gameplay` | 改了游戏逻辑写 `true`，纯外观写 `false`。设错会让多人联机 desync |
   | `dependencies` | 用 BaseLib 时写 `[{"id":"BaseLib","min_version":"3.3.0"}]` |

   **目录里只能有一个 `.json`。** 加载器把任何 `.json` 都当清单读。

4. 要用游戏 API 时先查名字，不得凭记忆：`inspect_api action=search query=<子串>`，再用 `action=source typeName=<全名>` 读源码。
5. 编译并校验：`validate_mod modDir=your_mods/<你的名字>`。

## 3. 验收

- `validate_mod` 返回 PASS，并且文本里有「compiled」字样。
- 返回 PARTIAL 时**不算通过**：那表示没编译。按 NEXT 行补齐前置再跑一次。
- 想确认产物真的是自己写的代码：`strings -a <id>.dll | grep ModInitializerAttribute` 应有输出。

## 4. 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| `manifest file is X.json but its id is Y` | 文件名与 id 不一致 | 两处一起改，不得只改一处 |
| `found N .json files at the top` | 目录里有第二个 json | 删掉多余的那个，配置要用别的扩展名或放进子目录 |
| `AssemblyName is "A" but the manifest id is "B"` | csproj 没改 | 改 `<AssemblyName>` |
| `missing <id>.dll after a successful build` | 输出名与 id 不同 | 同上 |
| `dll looks like an empty stub` | csproj 把输出目录指到了工程根，SDK 把源文件排除了 | 删掉自定义 `OutputPath`，用默认的 `bin/Release` |
| `NETSDK1045` | SDK 低于 9 | 见 setup-workspace |
| `min_game_version is X but the installed game is Y` | 清单写的版本高于本机 | 改成不高于本机版本 |
| 编译报找不到类型 | 类型名猜错，或没引用程序集 | 用 `inspect_api` 查真名；引用列表在 `mod-repo.json` 的 `compile.references` |
