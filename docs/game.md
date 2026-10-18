# Game mechanics and load flow

Every conclusion on this page has a source: the decompiled `sts2.dll`, or a measurement on this
machine. Before you change a conclusion, check that its source still holds.

## 1. Load flow

This is the real order after a decompilation. The entry point is
`MegaCrit.Sts2.Core.Modding.ModManager.Initialize(fileIo, settings, gameVersion)`.

```csharp
if (CommandLineHelper.HasArg("nomods")) { State = Skipped; return; }      // -nomods skips everything
AppDomain.CurrentDomain.AssemblyResolve += HandleAssemblyResolveFailure;  // relax the assembly version binding
string dir = Path.GetDirectoryName(OS.GetExecutablePath());
foreach (var root in new[] { Path.Combine(dir, "mods"),
                             Path.Combine(dir, "mods_STEAMTEST") })
    if (fileIo.DirectoryExists(root)) ReadModsInDirRecursive(root, ...);
if (SteamInitializer.Initialized) await ReadSteamMods();                  // the real Workshop
if (_mods.Count == 0) { State = Initialized; return; }
RemoveDisabledMods();          // on a name clash with Workshop, keep only the local copy on purpose
SortModList(_settings?.ModList ?? ...);   // Kahn topological sort, dependencies load first
foreach (var m in _mods) TryLoadMod(m);
Log.Info($" --- RUNNING MODDED! --- Loaded {loaded} mods ({_mods.Count} total)");
```

The load of one mod:

```csharp
if (!PlayerAgreedToModLoading) { mod.state = Disabled; return; }   // global load switch, see §4
var dll = Path.Combine(mod.path, modId + ".dll");
assembly = loadContext.LoadFromAssemblyPath(dll);
var pck = Path.Combine(mod.path, modId + ".pck");
ProjectSettings.LoadResourcePack(pck);                             // one argument = replaceFiles: true
```

`mods_STEAMTEST/` is a debug hook that makes local mods look like a Workshop install.
The loader reads that directory as `ModSource.SteamWorkshop`.

## 2. Manifest (`<id>.json`)

These are **all 10 keys** of the decompiled `ModManifest`. `System.Text.Json` ignores any extra
key. A spelling error therefore raises no error, and the key silently does nothing.

| Key | Type | Description |
|---|---|---|
| `id` | string | **Required.** It is also the file name prefix of `<id>.dll` and `<id>.pck` |
| `name` | string | Display name |
| `author` | string | Author. When the mod has no `[ModInitializer]`, the loader also uses it in the Harmony instance name |
| `description` | string | For display |
| `version` | string | Semantic version. When parsing fails, `Mod.version` is null and the dependent mod reports FAILED |
| `has_pck` | bool | If the key is true and the file `.pck` is absent, the loader logs an error and continues without the pck. It throws only when a pck exists but Godot cannot load it |
| `has_dll` | bool | If the key is true and the file `.dll` is absent, the loader logs an error only and does not load the assembly |
| `dependencies` | `[{id, min_version}]` | If a dependency is absent, the mod reports FAILED. If its version is too low, the mod also reports FAILED |
| `affects_gameplay` | bool | Defaults to **true**. A wrong value causes a desync in multiplayer, or the game blocks the mod |
| `min_game_version` | string | If the installed game version is lower, the game marks the mod unsupported and does not load it. If you omit the key, the game logs a WARN only |

**A mod directory can hold one `.json` only.** `ReadModsInDirRecursive` reads every `.json` as a
manifest, and reports an error and skips the file when the `id` is absent. If the extra file has an
`id`, it becomes a second mod, or it triggers `DUPLICATE_ID`.

## 3. Entry point

```csharp
[ModInitializer(nameof(Init))]      // MegaCrit.Sts2.Core.Modding.ModInitializerAttribute
public static class Entry
{
    public static void Init() { /* ... */ }
}
```

The loader finds the method with `BindingFlags.Static | Public | NonPublic`. It then calls
`method.Invoke(null, null)`. **The method must be static, and it must have no parameter.** If you
write an instance method, the loader reports
`... but it's not static! Declare it to be static`.

If the mod has no `[ModInitializer]`, the loader automatically runs
`new Harmony(author + "." + id).PatchAll(assembly)`.

## 4. The global load switch (the step missed most often)

```csharp
// ModManager
else if (!PlayerAgreedToModLoading) {
    Log.Info("Skipping loading mod " + modId + ", user has not yet seen the mods warning");
    mod.state = ModLoadState.Disabled;
}
```

- The decompiled name is `ModSettings.PlayerAgreedToModLoading`. **The on-disk name is
  `mods_enabled`** (`SettingsSave` v5, `SnakeCaseLower`).
- Location: `~/Library/Application Support/SlayTheSpire2/steam/<steamId>/settings.save` (macOS).
- When the value is `false`, **all** mods are `Disabled`, and the log holds the line above only.
  **The game reports no error and gives no hint on how to enable mods.**
- `install_mod` in this repository reads this switch and reports it. The criterion is in
  `.pi/lib/game-settings.ts`.

## 5. Paths

| Purpose | macOS | Windows |
|---|---|---|
| Game directory | `.../steamapps/common/Slay the Spire 2` | The same (under the Steam library) |
| Managed assemblies | `SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/` | `data_sts2_windows_x86_64/` |
| Mod directory | `SlayTheSpire2.app/Contents/MacOS/mods/` | `mods/` |
| Player data `user://` | `~/Library/Application Support/SlayTheSpire2/` | `%APPDATA%/SlayTheSpire2/` |
| Log | `<user data>/logs/godot.log` | The same |

macOS has two data directories (`data_sts2_macos_arm64` / `data_sts2_macos_x86_64`), and Godot picks
one by process architecture. When the hard-coded directory is absent, `managedDirFor` falls back to
the sibling directory at the same level.

**The game does not create the mods directory for you.** `Initialize` scans a directory only when
`DirectoryExists` returns true.

## 6. Assets and art (unused in v1, but know it)

- Card art goes through `AtlasManager`. It uses `res://images/atlases/<atlas>.tpsheet` plus a PNG.
  `AtlasResourceLoader` intercepts `.sprites/*.tres`.
- Creature visuals use Spine: `res://scenes/creature_visuals/<id in lowercase>.tscn`.
  `NCreatureVisuals` accepts the scene only when `%Visuals` is a `SpineSprite`.
- **A PCK can override a vanilla path.** `ProjectSettings.LoadResourcePack(pack, replaceFiles = true, ...)`
  means the pack that loads last wins.
- The usual approach in the ecosystem to change a vanilla card image is to patch the getter of
  `CardModel.PortraitPath`. That patch must carry `[HarmonyPriority(Priority.First)]`. BaseLib,
  RitsuLib, and ATA all prefix the same getter.
- **Where a mod card's portrait is looked up** (measured, not documented upstream). A card named
  `FocusedStrike` in mod `ExampleCard` inside the Ironclad pool makes the game request:

  ```
  [WARN] AtlasResourceLoader: Missing sprite 'ironclad/examplecard-focused_strike' in card_atlas
         (requested: res://images/atlases/card_atlas.sprites/ironclad/examplecard-focused_strike.tres)
  ```

  So the key is `<pool title>/<mod id>-<class name>`, lowercased, with underscores between words.
  The file it looks for is a `.tres` under `card_atlas.sprites/<pool title>/`. A mod card without
  that sprite still loads and still works. It shows a missing-atlas placeholder, and the game logs
  one WARN per sprite.

### 6.0 How a DLL-only mod gets a picture in (measured, 2026-10-18)

Every art example in the upstream wiki returns a `res://<ModRoot>/images/...` path: orb icons,
ancient map icons, event portraits. That path needs the mod's own PCK. A DLL-only mod has no
`res://<id>/` namespace, so the wiki's answer does not apply to it. Measurements:

| Attempt | Result |
|---|---|
| `PortraitPath => "res://..."` for a sprite we ship | Impossible without a PCK. The resource is not there |
| `PortraitPath => "user://x.png"` with a real PNG | `ResourceLoader.Load` returns **null**, silently. A raw PNG has no importer in a built game |
| `Image.LoadFromFile("user://x.png")` | Works. It read a 512x384 png |
| `ImageTexture.CreateFromImage(image)` | Works. It returns a usable `Texture2D` |
| Harmony postfix on the `Portrait` getter | Works. The card then reports `Portrait = 512x384` |

Two facts force the last row. `CardModel.PortraitPath` is `virtual`, but `CardModel.Portrait` is
not, and `Portrait` is what the UI reads. So the path gets you nowhere and the texture has to be
supplied by a patch.

`reference/example_card/` does this in `PortraitPatch.cs`: it reads `portrait.png` from the mod's
own directory, caches the texture, and returns it for that one card. `install_mod` copies image
files next to the assembly, because the assembly reads them from its own directory.

This is a stopgap, not a design. The real fix is a `<id>.pck`, and the art direction is deferred.

### 6.1 Localization: `res://` accepts only the mod's own PCK

This is the decompiled `ModManager.GetModdedLocTables`:

```csharp
string text = $"res://{mod.manifest.id}/localization/{language}/{file}";
if (ResourceLoader.Exists(text)) yield return text;
```

The loader checks `res://` only. **A DLL-only mod cannot ship JSON localization.** The prefix
`res://<id>/` exists only after the loader mounts the PCK of that mod.

Two options:

| Approach | Needs a PCK | Fits |
|---|---|---|
| `<id>/localization/<eng\|zhs>/cards.json` | **Yes** | Many strings, translation needed |
| Rewrite the BaseLib `ILocalizationProvider.Localization` in C# (`CardLoc`, `PowerLoc`, `RelicLoc`, and the other location classes have an implicit conversion to `List<(string,string)>`) | No | Few strings, v1 ships Chinese or English only |

`reference/example_card` uses the second option. When a key is absent, the game logs an error and
does not crash, so **the symptom is a card with no name, not a crash**.

## 7. Content extension (BaseLib)

- Extend a `Custom*Model` class (`CustomCardModel` / `CustomRelicModel` / `CustomPotionModel` /
  `CustomPowerModel` / `CustomEventModel` / `CustomMonsterModel` / `CustomCharacterModel` / the other
  model classes). The constructor automatically calls `CustomContentDictionary.AddModel(GetType())`.
- **A card pool and a starting deck are two different lists.** The pool decides whether a card can
  appear as a reward (`IroncladCardPool` holds 87 fixed cards). The starting deck is the 10 fixed
  cards in `Ironclad.StartingDeck`. A card in the pool is not in the opening hand (`traps.md` 15).
- **Pool membership uses `[Pool(typeof(IroncladCardPool))]`, and this attribute is mandatory.**
  This is the decompiled `BaseLib.Patches.Content.CustomContentDictionary.AddModel`:

  ```csharp
  PoolAttribute poolAttribute = modelType.GetCustomAttribute<PoolAttribute>()
      ?? throw new Exception("Model " + modelType.FullName + " must be marked with a PoolAttribute ...");
  if (!IsValidPool(modelType, poolAttribute.PoolType)) throw ...;
  ModHelper.AddModelToPool(poolAttribute.PoolType, modelType);
  ```

  Without that attribute, the class throws **at construction time**. The exception reaches
  `ModelDb.Init` and then `NGame.GameStartup`. The result is **a game that does not start**
  (`traps.md` trap 14). **`[Pool]` is inheritable.** Many cards can share one base class that
  carries the attribute. After you add `[Pool]`, do **not** write `ModHelper.AddModelToPool` by
  hand. BaseLib already calls it, and a second call puts the same card into the pool twice.
- If the class does not extend `Custom*Model` and carries the `ICustomModel` marker only, its
  default constructor must call `CustomContentDictionary.AddModel(GetType())`. Only then does
  `[Pool]` take effect.
- Localization: `localization/<lang>/{cards,relics,powers,characters,ancients,card_keywords,static_hover_tips}.json`
  with the keys `MODID-MODEL_ID.title` / `.description`. A DLL-only mod cannot ship this JSON,
  because of the `res://` limit above. That mod implements `ILocalizationProvider` in C# instead.
- **An absent localization entry logs one error only and does not crash.** The upstream
  `Features.md` states this. A card with no name and a card that fails to load are therefore two
  different problems. Do not merge them.
- **The version number does not belong on this page.** To find the installed version, read the
  `version` field of `vendor/baselib/BaseLib.json`. An earlier revision of this page said `3.3.0+`,
  and that value is out of date.
- **The verbatim snapshot of the official wiki is in `reference/base-lib-wiki/`.** Read that
  `INDEX.md` first to find the page, then use `inspect_api` to find the real name.

## 8. Limits when you find a name with fetch

`inspect_api` reads both the `sts2.dll` of the **game** (6381 types) and the `BaseLib.dll` of
**BaseLib** (1015 types), and each result carries a `[game]` or `[baselib]` label. Therefore:

- Every type of the game is available for a lookup and for decompilation.
- A BaseLib type is available only if this machine restored it before. The package lands in the
  NuGet cache after some mod references it and restores. If you never restored the package,
  the tool explains this and searches the game only.
- `sts2.xml` is a collection of `<summary>` comments only (19635 entries), and **a member with no
  comment is not in it**. `CardModel.PortraitPath` has no documentation, for example, so you must
  decompile the type to read it. To find a member name, always read the type source with
  `action=source`.
