# 游戏机制与加载流程

本页的每条结论都有出处：反编译 `sts2.dll`，或在本机实测。改动前先确认出处仍然成立。

## 1. 加载流程

`MegaCrit.Sts2.Core.Modding.ModManager.Initialize(fileIo, settings, gameVersion)`，反编译后的实际顺序：

```csharp
if (CommandLineHelper.HasArg("nomods")) { State = Skipped; return; }      // -nomods 直接跳过
AppDomain.CurrentDomain.AssemblyResolve += HandleAssemblyResolveFailure;  // 放宽程序集版本绑定
string dir = Path.GetDirectoryName(OS.GetExecutablePath());
foreach (var root in new[] { Path.Combine(dir, "mods"),
                             Path.Combine(dir, "mods_STEAMTEST") })
    if (fileIo.DirectoryExists(root)) ReadModsInDirRecursive(root, ...);
if (SteamInitializer.Initialized) await ReadSteamMods();                  // 真正的 Workshop
if (_mods.Count == 0) { State = Initialized; return; }
RemoveDisabledMods();          // Workshop 与本地同名时，故意只留本地那份
SortModList(_settings?.ModList ?? ...);   // Kahn 拓扑排序，依赖先加载
foreach (var m in _mods) TryLoadMod(m);
Log.Info($" --- RUNNING MODDED! --- Loaded {loaded} mods ({_mods.Count} total)");
```

单个 mod 的装载：

```csharp
if (!PlayerAgreedToModLoading) { mod.state = Disabled; return; }   // 总开关，见 §4
var dll = Path.Combine(mod.path, modId + ".dll");
assembly = loadContext.LoadFromAssemblyPath(dll);
var pck = Path.Combine(mod.path, modId + ".pck");
ProjectSettings.LoadResourcePack(pck);                             // 单参 = replaceFiles: true
```

`mods_STEAMTEST/` 是本地冒充 Workshop 的调试口，被当作 `ModSource.SteamWorkshop` 读取。

## 2. 清单（`<id>.json`）

反编译 `ModManifest` 得到的**全部 10 个键**。多写的键会被 `System.Text.Json` 忽略——所以拼错不会报错，只会静默失效。

| 键 | 类型 | 说明 |
|---|---|---|
| `id` | string | **必填**。同时是 `<id>.dll` / `<id>.pck` 的文件名前缀 |
| `name` | string | 显示名 |
| `author` | string | 作者；无 `[ModInitializer]` 时也参与 Harmony 实例名 |
| `description` | string | 显示用 |
| `version` | string | 语义化版本。解析失败时 `Mod.version` 为 null，依赖方会 FAILED |
| `has_pck` | bool | 为 true 但没有 `.pck` 时，装载会抛异常 |
| `has_dll` | bool | 为 true 但没有 `.dll` 时只打错误、程序集不加载 |
| `dependencies` | `[{id, min_version}]` | 缺失则 FAILED，版本不足则 FAILED |
| `affects_gameplay` | bool | 默认 **true**。设错会让多人联机 desync 或被挡 |
| `min_game_version` | string | 装机版本低于它时判为不支持、不加载。不写只出 WARN |

**目录里只能有一个 `.json`。** `ReadModsInDirRecursive` 把任何 `.json` 都当清单读，缺 `id` 就报错跳过；多出来的那个若带 `id` 就会变成第二个 mod，或触发 `DUPLICATE_ID`。

## 3. 入口

```csharp
[ModInitializer(nameof(Init))]      // MegaCrit.Sts2.Core.Modding.ModInitializerAttribute
public static class Entry
{
    public static void Init() { /* ... */ }
}
```

加载器用 `BindingFlags.Static | Public | NonPublic` 找方法，然后 `method.Invoke(null, null)`——**必须 static、必须无参**。写成实例方法会说 `... but it's not static! Declare it to be static`。

没有 `[ModInitializer]` 时，加载器 auto `new Harmony(author + "." + id).PatchAll(assembly)`。

## 4. 加载总开关（最容易漏的一步）

```csharp
// ModManager
else if (!PlayerAgreedToModLoading) {
    Log.Info("Skipping loading mod " + modId + ", user has not yet seen the mods warning");
    mod.state = ModLoadState.Disabled;
}
```

- 反编译里叫 `ModSettings.PlayerAgreedToModLoading`，**落盘名是 `mods_enabled`**（`SettingsSave` v5，`SnakeCaseLower`）。
- 位置：`~/Library/Application Support/SlayTheSpire2/steam/<steamId>/settings.save`（mac）。
- 为 `false` 时**所有** mod 都 `Disabled`，日志只有上面那一句，**不报错、不提示怎么开**。
- 这个仓库的 `install_mod` 会读并报告这个开关（判据在 `.pi/lib/game-settings.ts`）。

## 5. 路径

| 用途 | macOS | Windows |
|---|---|---|
| 游戏目录 | `.../steamapps/common/Slay the Spire 2` | 同（Steam 库下） |
| 托管程序集 | `SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/` | `data_sts2_windows_x86_64/` |
| mod 根 | `SlayTheSpire2.app/Contents/MacOS/mods/` | `mods/` |
| 玩家数据 `user://` | `~/Library/Application Support/SlayTheSpire2/` | `%APPDATA%/SlayTheSpire2/` |
| 日志 | `<用户数据>/logs/godot.log` | 同 |

mac 有两份数据目录（`data_sts2_macos_arm64` / `data_sts2_macos_x86_64`），Godot 按进程架构选。`managedDirFor` 在写死的那份不存在时退到同级兄弟目录。

**mods 根不会被游戏自动创建**：`Initialize` 只在 `DirectoryExists` 为 true 时扫描。

## 6. 资源与美术（v1 不用，但要知道）

- 卡图走 `AtlasManager`：`res://images/atlases/<图集>.tpsheet` + PNG，`AtlasResourceLoader` 拦截 `.sprites/*.tres`。
- 生物视觉是 Spine：`res://scenes/creature_visuals/<id小写>.tscn`，`NCreatureVisuals` 只认 `%Visuals` 是 `SpineSprite`。
- **PCK 能覆盖原版路径**：`ProjectSettings.LoadResourcePack(pack, replaceFiles = true, ...)`，后挂者胜。
- 改原版卡图的生态做法是 patch `CardModel.PortraitPath` 的 getter，且必须带 `[HarmonyPriority(Priority.First)]`（BaseLib / RitsuLib / ATA 都 prefix 同一个 getter）。

## 7. 内容扩展（BaseLib）

- 继承 `Custom*Model`（`CustomCardModel` / `CustomRelicModel` / `CustomPotionModel` / `CustomPowerModel` / `CustomEventModel` / `CustomMonsterModel` / `CustomCharacterModel` …），构造函数会自动 `CustomContentDictionary.AddModel(GetType())`。
- 池归属用 `[Pool(typeof(IroncladCardPool))]`。
- 版本对应：BaseLib 3.3.0+ 配游戏 0.107；本机装的是 0.107.1。
- 本地化：`localization/<lang>/{cards,relics,powers,characters,ancients,card_keywords,static_hover_tips}.json`，键 `MODID-MODEL_ID.title` / `.description`。

## 8. 用 fetch 查名字的边界

`inspect_game_api` 读的是**游戏自带的** `sts2.dll`（6381 个类型）。所以：

- 游戏自己的类型都能查到并反编译。
- **BaseLib 的类型查不到**（`CustomCardModel` 等），因为 BaseLib 是一个 mod，不在游戏目录里。要用它，读 BaseLib 的源码或 wiki。
- `sts2.xml` 只是 `<summary>` 注释的集合（19635 条），**没有注释的成员不在里面**。例如 `CardModel.PortraitPath` 就没有文档，只能靠反编译看。所以查成员名字一律用 `action=source` 读类型源码。
