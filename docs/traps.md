# 坑（每条都会静默失效，不报错）

这个游戏最贵的学习成本在这里：出错的默认表现不是崩溃，而是**「看起来装了，其实没加载」**。
下面每条都按「症状、原因、怎么确认」三段写。

## 1. mod 装了但游戏里没有

**症状**：`mods/` 里有目录，游戏里看不到，也没有报错。

**原因**（按概率排序）：

| 原因 | 怎么确认 |
|---|---|
| 总开关 `mod_settings.mods_enabled` 是 `false` | `godot.log` 里只有 `Skipping loading mod <id>, user has not yet seen the mods warning` |
| `.json` 文件名 ≠ `id` | 加载器按 `<id>.dll` 找程序集；文件名不对就等于没写清单 |
| 目录里有第二个 `.json` | 加载器会把它也当清单读，可能变成第二个 mod 或 `DUPLICATE_ID` |
| `has_dll` 缺失或为 false | 日志有 `Found mod manifest file` 但没有 `Loading assembly DLL` |
| `mods/` 目录是我们自己建的，游戏不会建 | 目录不存在时 `Initialize` 直接跳过 |

**确认方式**：看 `godot.log` 里这四行的顺序——

```
Found mod manifest file .../mods/<目录>/<id>.json
Loading assembly DLL .../mods/<目录>/<id>.dll
Calling initializer method of type <T> for <id>, Version=...
 --- RUNNING MODDED! --- Loaded N mods (M total)
```

少了第二行说明程序集没加载（`has_dll` 或文件名问题）。少了第三行说明程序集加载了但没有 `[ModInitializer]`。

## 2. 编译报 CS0012：缺的不是 BaseLib，是 sts2

**症状**：

```
error CS0012: The type 'PowerModel' is defined in an assembly that is not referenced.
You must add a reference to assembly 'sts2, Version=0.1.0.0, ...'.
```

**原因**：`BaseLib` 不是游戏的替代品，它是**架在游戏之上的一层**。`BaseLib.Abstracts.CustomPowerModel` 的基类是 `MegaCrit.Sts2.Core.Models.PowerModel`，所以在 `sts2.dll` 里。

**实测**：写一个类，一个 MegaCrit 类名都不出现，只继承 BaseLib 的类型 ——

```csharp
public abstract class MyPower : BaseLib.Abstracts.CustomPowerModel { }
```

只引用 `BaseLib.dll` 时，编译器仍然要求 `sts2.dll`。继承关系本身就是引用。

**所以**：两个程序集都要引用。这个仓库的 `mod-repo.json` 里 `compile.references` 已经是 `["sts2.dll","0Harmony.dll"]`，`compile.packages` 加了 BaseLib。

**反过来也成立**：不继承 BaseLib 类型的 mod **不需要** BaseLib。`reference/example_mod` 就是零依赖的，照样能加载。BaseLib 只有要它的便利类时才引入。

## 3. 卡牌加进去了但没名字

**症状**：模型计数涨了（`ModelIdSerializationCache ... Entries: 1623`），卡牌也注册了，但游戏里标题是一串 key 或者空白。没有崩溃。

**原因**：本地化没生效。`ModManager.GetModdedLocTables` 只查 `res://<mod.id>/localization/...`，而 **DLL-only 的 mod 没有 `res://` 命名空间** —— json 本地化根本读不到。

**两条修法**：

- 出 PCK（`.pck` 里带 `localization/<lang>/cards.json`）；
- 或者在 C# 里重写 BaseLib 的 `Localization` 属性，例如
  `public override List<(string, string)> Localization => new CardLoc("Focused Strike", "Deal {Damage} damage.");`

缺 key 时 BaseLib 只报错不崩，所以这个问题不会自己暴露。

## 4. 补丁写了但没效果

**症状**：DLL 加载成功，日志正常，但游戏行为没变。

**原因**：同一个方法被**框架抢先 patch**。BaseLib / RitsuLib / ATA 都用 Harmony prefix 抢 `CardModel.PortraitPath` 一类 getter，它们的 prefix 优先级更高，你的 patch 根本不执行。

**修法**：给自己的 prefix 加

```csharp
[HarmonyPriority(Priority.First)]
```

**确认方式**：在 prefix 里 `Log.Info` 一行，看它有没有出现在 `godot.log`。

## 5. 编译"成功"但 dll 是空壳

**症状**：`dotnet build` 退出 0，dll 存在，游戏能加载，但什么都没发生。

**原因**：csproj 把 `OutputPath` 指到了工程根目录，于是 SDK 的默认排除规则把工程自己的 `*.cs` 全排掉，什么都没编。

**确认方式**：`validate_mod` 会检查产物大小与 `ModInitializerAttribute` 引用；也可以

```bash
strings -a <id>.dll | grep ModInitializerAttribute
```

## 6. `version` 解析失败，依赖方全部 FAILED

**症状**：别的 mod 声明依赖你，报 `MOD_ERROR.DEPENDENCY_VERSION_INVALID`。

**原因**：`version` 不是 `x.y.z` 形式，游戏解析失败后 `Mod.version` 为 null。

## 7. `min_game_version` 写太高

**症状**：mod 完全不加载，日志说明不支持的版本。

**原因**：装机版本低于 `min_game_version` 时，加载器判为不支持。

**本机**：`v0.107.1`。改游戏版本后要一起改这里。

## 8. `affects_gameplay` 设错

**症状**：多人联机连不上，或对方的游戏状态和你不一样。

**原因**：这个字段默认 **true**。纯外观 mod 设成 true 会被拉进 mod 一致性校验；改游戏逻辑的 mod 设成 false 会导致 desync。

## 9. 同一个 mod 同时存在于 Workshop 与本地

**症状**：日志 `Mod with ID <id> is loaded both via Steam and local mods directory. Disabling the Steam workshop version.`，状态是 `DisabledDuplicate`。

**原因**（反编译 `ModManager.RemoveDisabledMods`）：收集所有 `ModSource.ModsDirectory` 的 id，然后把 id 相同的 `SteamWorkshop` 那条关掉。注释写明动机是「方便 modder 开发」。不是 bug。

**真正的风险不是冲突，是版本落后**：本地那份会**盖掉** Workshop 那份。如果玩家订阅的版本已经更新，而本地还留着一份旧的手工拷贝，游戏会静默用旧的，升级永远到不了。

**所以规则是**：

- **玩家机器上不得手工拷贝依赖**。依赖由 `install_mod` 判断：玩家一份都没有，才把 `vendor/` 里随仓带的那份放进去；已经有一份（不管来自 Workshop 还是 mods 目录）就不动。判据在 `.pi/lib/mod-deps.ts`，测试在 `scripts/test-mod-install-deps.mjs`。
- 本地拷贝对开发者是便利（改一版、立刻试），开发完要清掉。
- 自己的 mod 更是如此：本地留着旧版，玩家订阅的新版就被关了。

**不得指望有报错**：这条只打一行 WARN，游戏照常启动，看起来一切正常。

## 10. 带启动参数直接跑二进制

**症状**：游戏闪退或 Steam 没接管。

**原因**：Steam 游戏要走 Steam 启动。带参数要用

```bash
open "steam://rungameid/2868840//-nomods"
```

## 11. 改了 `settings.save` 但被迁移丢掉

**症状**：手写的键启动后消失，行为不变。

**原因**：`SettingsSave` 有版本迁移（本机从 v4 迁移到 v5 已经发生过一次），且键名走 `SnakeCaseLower`。
**不得按反编译的属性名猜键名**：`PlayerAgreedToModLoading` 的落盘名是 `mods_enabled`。

## 12. macOS 特有

- mods 根在 **`.app` 包内**（`Contents/MacOS/mods/`），写进去会改动 bundle 内容。Steam 校验完整性时可能被清掉。
- 游戏有 arm64 与 x86_64 两份数据目录，编译引用的 `sts2.dll` 要与当前进程架构一致（`managedDirFor` 会自动兜底）。
