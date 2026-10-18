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

**The manifest scan is recursive.** `ModManager.ReadModsInDirRecursive` walks every subdirectory of
`mods/` and reads every `.json` there as a manifest. A build tree copied by hand therefore floods the
log: `bin/Release/*.deps.json` and the `obj/**/*.json` files each produce
`Mod manifest <path> is missing the 'id' field!` (`ModManager.cs:376`). The loader skips those files, so
this is noise rather than breakage, but it buries the lines you need. `install_mod` copies only
`<id>.json` and `<id>.dll`, which is why the normal path never sees this.

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
- **Where the game looks up a mod card's portrait** (measured, not documented upstream). A card named
  `FocusedStrike` in mod `ExampleCard` inside the Ironclad pool makes the game request:

  ```
  [WARN] AtlasResourceLoader: Missing sprite 'ironclad/examplecard-focused_strike' in card_atlas
         (requested: res://images/atlases/card_atlas.sprites/ironclad/examplecard-focused_strike.tres)
  ```

  So the key is `<pool title>/<mod id>-<class name>`, lowercased, with underscores between words.
  The file it looks for is a `.tres` under `card_atlas.sprites/<pool title>/`. A mod card without
  that sprite still loads and still works. It draws a missing-atlas placeholder, and the game logs
  one WARN per sprite.

### 6.0 How a mod card gets a picture in (measured 2026-10-18, corrected 2026-10-18)

**There is a supported route, and it is one property.** `BaseLib.Abstracts.CustomCardModel` declares
two virtual members, and BaseLib already installs the patch that uses them:

```csharp
// CustomCardModel.cs:65,67
public virtual string? CustomPortraitPath => null;
public virtual Texture2D? CustomPortrait => null;

// CustomCardPortrait.cs, a Harmony prefix on CardModel.Portrait
if (instance is CustomCardModel m && m.CustomPortrait != null) { __result = m.CustomPortrait; return false; }
```

So a card that derives from `CustomCardModel` overrides `CustomPortrait` and returns a texture. You need
nothing else. The first pass missed this because it read only the vanilla `CardModel`. There,
`PortraitPath` is virtual and `Portrait` is not, which makes the path look like the only hook.

The measurements below are still true, and they matter when you want art **without a PCK**:

| Attempt | Result |
|---|---|
| `PortraitPath => "res://..."` for a sprite the mod ships | Impossible without a PCK. The resource is not there |
| `PortraitPath => "user://x.png"` with a real PNG | `ResourceLoader.Load` returns **null**, silently. A built game has no importer for a raw PNG |
| `Image.LoadFromFile("user://x.png")` | Works. It read a 512x384 png |
| `ImageTexture.CreateFromImage(image)` | Works. It returns a usable `Texture2D` |
| Override `CustomPortrait` and return that texture | Works, and it is the intended route |
| Harmony postfix on `CardModel.Portrait` | Also works, but it duplicates what BaseLib already does. Do not add it |

Every art example in the upstream wiki returns a `res://<ModRoot>/images/...` path: orb icons, ancient
map icons, event portraits. That path needs the mod's own PCK, so those examples do not apply to a
DLL-only mod.

`reference/example_card/` reads `portrait.png` from its own directory, builds a texture, and returns it
from `CustomPortrait`. `install_mod` copies image files next to the assembly, because the assembly reads
them from that directory. Shipping a `<id>.pck` remains the real answer, and the art direction is
deferred.

### 6.0b Why the card library marks a mod card as locked

The card library decides in `NCardLibraryGrid.RefreshVisibility` with two sets:

```csharp
_seenCards     = SaveManager.Instance.Progress.DiscoveredCards.ToHashSet();
_unlockedCards = ModelDb.AllCardPools.Select(p => p.GetUnlockedCards(unlockState, CardMultiplayerConstraint.None))...
```

Two gates, and they are different. **Unlocked** comes from the epoch filter in each pool, and a mod
card passes it because it belongs to no epoch. **Seen** comes from `DiscoveredCards` in the progress
save, and the game only adds an id there when the player meets that card in a run. So a brand new
mod card renders as locked even though nothing forbids it.

BaseLib has a patch for this, `CustomCardPoolMarkAsSeenPatch`, but it only marks cards from a
`CustomCardPoolModel` with `SeenByDefault`. A card added to the vanilla `IroncladCardPool` is not
covered. Call `SaveManager.Instance.Progress.MarkCardAsSeen(card.Id)` yourself, in a Harmony prefix
on `RefreshVisibility` so it runs before the grid reads `Progress`. Measured on 2026-10-18:

```
[probe] DiscoveredCards before=False added=True after=True (count=1)
```

Do not use `SaveManager.Instance.MarkCardAsSeen(card)`. It also requires `card.Owner` to be the local
player, and a canonical model from a pool does not have one.

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

Two details make the in-code route silent when it is wrong:

1. **`SimpleLoc.TrySimplify` rewrites a string only when it starts with `#`** (`SimpleLoc.cs:106-112`).
   A plain `"Deal {Damage} damage."` goes to SmartFormat unchanged.
2. **The placeholder name must equal `DynamicVar.Name` exactly.** `LocString.Add(DynamicVar)` keys the
   variable by that name, so `new DamageVar(...)` produces `Damage`. Writing `{damage}` or `{Dmg}`
   reports nothing. The description simply never formats.

## 7. Content extension (BaseLib)

- Extend a `Custom*Model` class (`CustomCardModel` / `CustomRelicModel` / `CustomPotionModel` /
  `CustomPowerModel` / `CustomEventModel` / `CustomMonsterModel` / `CustomCharacterModel` / the other
  model classes). The constructor automatically calls `CustomContentDictionary.AddModel(GetType())`.
- **A card pool and a starting deck are two different lists.** The pool decides whether a card can
  appear as a reward (`IroncladCardPool` holds 87 fixed cards). The starting deck is the 10 hard-coded
  cards in `Ironclad.StartingDeck`. A card in the pool is not in the opening hand (`traps.md` 15).
- **Use the `CardAttack` overload whose second parameter is a `CardPlay`.** The overloads that take a
  `Creature` target instead, and the ones that take a `decimal`, carry
  `[Obsolete("Use the variant that has a CardPlay as the second parameter instead ...")]`
  (`CommonActions.cs:52,58,128`). The wiki's card example shows the obsolete form, so do not copy it.
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

## 7.1 Removing a mod does not break the save

If a save names a model that no longer exists, the game substitutes a deprecated placeholder. This
ships with the game, and it covers every content type:

```csharp
/// Obtains a card by ID, or falls back to the deprecated card if it's not found.
/// This should only be used in save loading where it's okay to fall back to deprecated content.
public static CardModel CardOrDeprecated(ModelId id)
{
    return ModelDb.GetByIdOrNull<CardModel>(id) ?? ModelDb.Card<DeprecatedCard>();
}
```

`SaveUtil` holds the whole family: `CardOrDeprecated`, `RelicOrDeprecated`, `PotionOrDeprecated`,
`EncounterOrDeprecated`, `EventOrDeprecated`, `AncientEventOrDeprecated`, `ModifierOrDeprecated`,
`EnchantmentOrDeprecated`, `MonsterOrDeprecated`, `CharacterOrDeprecated`, `ActOrDeprecated`.

So a run save that still holds a card from a removed mod loads normally. The card turns into
`DeprecatedCard`: a status card named "deprecated card" with BETA art. When the player draws it, it
draws a card, removes itself from the deck, and exhausts. Nothing breaks.

Measured on 2026-10-18 by removing the mod from a save whose deck held
`CARD.EXAMPLECARD-FOCUSED_STRIKE`: the deck entry appeared as that status card, and the run loaded.

The `discovered_cards` list in `progress.save` also keeps the stale id. The card library builds a
`HashSet<ModelId>` from it and compares by id, so a stale entry matches nothing and harms nothing.

Do not conclude from `ModelDb.GetById` that a missing model crashes a load. `GetById` throws
`ModelNotFoundException`, but the save path deliberately calls the `OrDeprecated` variant instead.

## 8. Limits when you resolve a name

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
