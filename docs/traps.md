# Traps

This game puts its most expensive learning cost here. When something is wrong, the default
behaviour **is not a crash in most cases**. The default behaviour is "it looks installed, but it
did not load". A few traps crash the game or stop it at startup, but **the error appears far from
the cause** (trap 14 is the clearest example).
Each trap below has three parts: symptom, cause, and how to check.

## 1. The mod is installed but the game does not show it

**Symptom**: The mod directory is in `mods/`, the game does not show it, and the game prints no
error.

**Cause** (in order of probability):

| Cause | How to check |
|---|---|
| The global switch `mod_settings.mods_enabled` is `false` | `godot.log` holds only `Skipping loading mod <id>, user has not yet seen the mods warning` |
| The `.json` file name is not equal to `id` | The loader finds the assembly by `<id>.dll`. A wrong file name gives the same result as no manifest |
| The directory holds a second `.json` file | The loader reads that file as a manifest too. It may become a second mod, or `DUPLICATE_ID` |
| `has_dll` is absent or false | The log holds `Found mod manifest file` but it does not hold `Loading assembly DLL` |
| We create the `mods/` directory ourselves. The game does not create it | If the directory does not exist, `Initialize` skips the mod at once |

**How to check**: Read the order of these four lines in `godot.log`.

```
Found mod manifest file .../mods/<mod directory>/<id>.json
Loading assembly DLL .../mods/<mod directory>/<id>.dll
Calling initializer method of type <T> for <id>, Version=...
 --- RUNNING MODDED! --- Loaded N mods (M total)
```

If the second line is absent, the assembly did not load. The cause is `has_dll` or the file name.
If the third line is absent, the assembly loaded but it has no `[ModInitializer]`.

## 2. The compiler reports CS0012. The assembly that is absent is sts2, not BaseLib

**Symptom**:

```
error CS0012: The type 'PowerModel' is defined in an assembly that is not referenced.
You must add a reference to assembly 'sts2, Version=0.1.0.0, ...'.
```

**Cause**: `BaseLib` is not a replacement for the game. It is **a layer that sits on top of the
game**. The base class of `BaseLib.Abstracts.CustomPowerModel` is
`MegaCrit.Sts2.Core.Models.PowerModel`, so that base class is in `sts2.dll`.

**Measured**: Write a class that names no MegaCrit type and inherits only a BaseLib type.

```csharp
public abstract class MyPower : BaseLib.Abstracts.CustomPowerModel { }
```

With a reference to `BaseLib.dll` only, the compiler still asks for `sts2.dll`. The inheritance
itself is a reference.

**So**: Reference both assemblies. In `mod-repo.json` of this repository, `compile.references` is
already `["sts2.dll","0Harmony.dll"]`, and `compile.packages` adds BaseLib.

**The reverse also holds**: A mod that inherits no BaseLib type **does not need** BaseLib.
`reference/example_mod` has no dependency, and it still loads. Add BaseLib only when you want its
convenience classes.

## 3. The card is added but it has no name

**Symptom**: The model count goes up (`ModelIdSerializationCache ... Entries: 1623`), and the game
registers the card. The title in the game is a key string, or the title is blank. The game does not
crash.

**Cause**: Localization did not take effect. `ModManager.GetModdedLocTables` reads only
`res://<mod.id>/localization/...`, and **a DLL-only mod has no `res://` namespace**. The game
cannot read a json localization at all.

**Two fixes**:

- Ship a PCK (the `.pck` holds `localization/<lang>/cards.json`).
- Or override the BaseLib `Localization` property in C#, for example
  `public override List<(string, string)> Localization => new CardLoc("Focused Strike", "Deal {Damage} damage.");`

When a key is absent, BaseLib reports an error and does not crash. So this problem does not show
itself.

**The same silence hides two mistakes in the C# route.** `SimpleLoc.TrySimplify` rewrites a string
only when it starts with `#`, so a plain description goes to SmartFormat untouched. The placeholder
must also equal `DynamicVar.Name` exactly: `{Damage}` works, `{damage}` never formats and reports
nothing. The title still shows, so the card looks fine until you read the description.

## 4. The patch runs but it has no effect

**Symptom**: The DLL loads, the log is normal, and the game behaviour does not change.

**Cause**: A **framework patched the same method first**. BaseLib, RitsuLib, and ATA all use a
Harmony prefix to take a getter such as `CardModel.PortraitPath`. Their prefix has a higher
priority, so your patch does not run at all.

**Fix**: Add this attribute to your prefix.

```csharp
[HarmonyPriority(Priority.First)]
```

**How to check**: Write one `Log.Info` line in the prefix, and check whether it appears in
`godot.log`.

## 5. The build "passes" but the dll is an empty shell

**Symptom**: `dotnet build` exits with 0, the dll exists, and the game loads it. Nothing happens.

**Cause**: The csproj points `OutputPath` at the project root. The default exclusion rules of the
SDK then exclude every `*.cs` file of the project itself. The compiler compiles nothing.

**How to check**: `validate_mod` checks the size of the output and the reference to
`ModInitializerAttribute`. You can also run

```bash
strings -a <id>.dll | grep ModInitializerAttribute
```

## 6. `version` fails to parse, and every dependent mod reports FAILED

**Symptom**: Another mod declares a dependency on your mod, and that mod reports
`MOD_ERROR.DEPENDENCY_VERSION_INVALID`.

**Cause**: `version` is not in the `x.y.z` form. The game fails to parse it, and `Mod.version`
becomes null.

## 7. `min_game_version` is too high

**Symptom**: The mod does not load at all, and the log names an unsupported version.

**Cause**: If the installed version is lower than `min_game_version`, the loader marks the mod as
unsupported.

**This machine**: `v0.107.1`. When the game version changes, change this field too.

## 8. `affects_gameplay` is set wrong

**Symptom**: A multiplayer session cannot connect, or the game state of the other player differs
from yours.

**Cause**: The default value of this field is **true**. If you set a cosmetic-only mod to true, the
consistency check pulls the mod in. If you set a mod that changes game logic to false, the session
desyncs.

## 9. The same mod exists in the Workshop and on the local disk

**Symptom**: The log holds `Mod with ID <id> is loaded both via Steam and local mods directory. Disabling the Steam workshop version.`,
and the state is `DisabledDuplicate`.

**Cause** (from the decompiled `ModManager.RemoveDisabledMods`): The game collects every id under
`ModSource.ModsDirectory`, and then it disables the `SteamWorkshop` entry with the same id. The
comment states the reason: "convenient for modders to develop". This is not a bug.

**The real risk is not a conflict. It is a version that falls behind**: The local copy
**overrides** the Workshop copy. If the version the player subscribed to is already newer, and the
local disk still holds an old manual copy, the game silently uses the old copy. The upgrade never
arrives.

**So the rule is**:

- **Never copy a dependency mod by hand on the player machine.** `install_mod` makes the decision.
  If the player has no copy, the tool places the copy that ships with the repository in `vendor/`.
  If the player already has a copy, from the Workshop or from the mods directory, the tool does not
  touch it. The decision code is in `.pi/lib/mod-deps.ts`, and the test is in
  `scripts/test-mod-install-deps.mjs`.
- A local copy is a convenience for a developer (change a version, test it at once). Delete it when
  you finish the work.
- This holds even more for your own mod. If an old version stays on the local disk, the game
  disables the newer version that the player subscribed to.

**Do not expect an error here**: This trap prints one WARN line only. The game starts as usual, and
everything looks normal.

## 10. Starting the game binary directly with an argument

**Symptom**: The game exits at once, or Steam does not take over.

**Cause**: A Steam game must start through Steam. To pass an argument, use

```bash
open "steam://rungameid/2868840//-nomods"
```

## 11. A migration drops an edit of `settings.save`

**Symptom**: A hand-written key disappears after the start, and the behaviour does not change.

**Cause**: `SettingsSave` has a version migration (on this machine, a migration from v4 to v5 has
already happened once), and key names use `SnakeCaseLower`.
**Do not guess a key name from the decompiled property name**: The name that
`PlayerAgreedToModLoading` writes to disk is `mods_enabled`.

## 12. macOS specifics

- The mods directory is **inside the `.app` bundle** (`Contents/MacOS/mods/`). A write there
  changes the contents of the bundle. A Steam integrity check may delete it.
- The game has two data directories, arm64 and x86_64. The `sts2.dll` that the build references
  must match the architecture of the current process (`managedDirFor` falls back to the right one
  automatically).

## 13. `inspect_api` finds nothing, and that does not mean that nothing uses it

**Symptom**: `action=search` for `GetCustomAttribute` returns `0 match(es)`, and the agent concludes
from that result that "no code reads this attribute".

**Cause**: `search` indexes only the types and members that **the searched DLL declares itself**.
`GetCustomAttribute<T>()` is defined in `System.Reflection`. Code that calls it is only an external
reference inside BaseLib. `search` never finds it.

**Already hit**: That conclusion led to the deletion of the `[Pool]` that BaseLib requires, and then
the game did not start (trap 14).

**What to do instead**: To find a name, use `action=search`. To decide **whether any code uses
it**, read that class with `action=source` and read the member that calls it. A 0 hit from
`search` proves only that nothing declares it.

The names `decompile` and `il` belong to the `api-probe` command line, not to `inspect_api`. The
tool has three actions only: `search`, `members`, and `source`.

## 14. `[Pool]` is absent: the game does not start, and the error is not in the mod loading stage

**Symptom**: A class that derives from `CustomCardModel` or `CustomRelicModel` has no `[Pool]`, and
the game stops at an error dialog at startup.

**Log** (`~/Library/Application Support/SlayTheSpire2/logs/godot.log`):

```
[ERROR] Encountered error on game startup! Attempting to show error dialog
[ERROR] System.Exception: Model ExampleCard.FocusedStrike must be marked with a PoolAttribute to determine which pool to add it to.
   at BaseLib.Patches.Content.CustomContentDictionary.AddModel(Type modelType)
   at BaseLib.Abstracts.CustomCardModel..ctor(...)
   at MegaCrit.Sts2.Core.Models.ModelDb.Init_Patch4()
   at MegaCrit.Sts2.Core.Nodes.NGame.GameStartup()
```

**The easiest thing to misread**: The log of this crash **does hold** `--- RUNNING MODDED! --- Loaded 3 mods`,
and that line appears **before** the error. So "the mods all loaded" is not evidence that "nothing is
wrong". The crash point is `ModelDb.Init`, which is later than mod loading. Start the diagnosis with
the `[ERROR]` stack.

**Fix**: Add `[Pool(typeof(...))]` to the class. After you add it, do **not** also write
`ModHelper.AddModelToPool` by hand (`docs/game.md` §7).

## 15. The card is in the pool, but it never shows up

**Symptom**: `ModelIdSerializationCache` counts the card (`Entries` went up by one), the game
starts, and the card is still nowhere in play.

**Cause**: A pool and a starting deck are two different lists.

| List | What it decides | Where it lives |
|---|---|---|
| Card pool | Which cards can appear as a reward, in a shop, or in the card library | `IroncladCardPool.GenerateAllCards()` (87 vanilla cards) plus whatever `ModHelper.AddModelToPool` appends |
| Starting deck | Which cards you hold at the start of a run | `Ironclad.StartingDeck`, a fixed array of 10 cards: 5 Strike, 4 Defend, 1 Bash |

Adding a card to the pool does nothing to the starting deck. A `Common` card in the Ironclad pool
appears only as a combat reward, so a short test run may never show it.

**How to check**: print what the game itself has, from a Harmony postfix on `ModelDb.Init`, with
`[HarmonyPriority(Priority.Last)]` so it runs after the models exist:

```csharp
var pool = ModelDb.AllCardPools.OfType<IroncladCardPool>().First();
var all = pool.AllCards.ToList();
Log.Info($"pool count = {all.Count}, contains mine = {all.OfType<FocusedStrike>().Any()}");
```

A vanilla Ironclad pool has 87 cards. Measured output for `reference/example_card`:

```
[probe] ModelId of FocusedStrike = CARD.EXAMPLECARD-FOCUSED_STRIKE
[probe] ironclad pool count = 88, contains FocusedStrike = True
[probe] title = 'Focused Strike', rarity = Common, showInLibrary = True
```

That output proves registration, pool membership, and the localisation. It also proves the card
will not be in the first hand.

**A card with no portrait is not invisible.** The game logs one `AtlasResourceLoader: Missing
sprite` WARN and draws a placeholder. The sprite key is `<pool title>/<mod id>-<class name>` in
lowercase, and `docs/game.md` section 6 shows the exact request line.

**Fix**: if the player must see the card immediately, append it to the starting deck with a Harmony
postfix on the getter. `reference/example_card/StartingDeckPatch.cs` does exactly that, and
`Ironclad.StartingDeck` returns `IEnumerable<CardModel>`, so the postfix appends one card and leaves
the other 10 alone.

## 16. A BETA status card appears where a mod card used to be

**Symptom**: the player removed or disabled a mod, loaded an old run, and the deck holds a status
card with BETA art. Its text says the card was removed in a recent update, it draws a card, it
removes itself from the deck, and it exhausts. The deck has one more card than it should.

**Cause**: this is the game's fallback, not corruption. A run save stores card ids as strings. When
a mod is gone, its id resolves to nothing, and the save path deliberately substitutes a placeholder:

```csharp
/// Obtains a card by ID, or falls back to the deprecated card if it's not found.
/// This should only be used in save loading where it's okay to fall back to deprecated content.
public static CardModel CardOrDeprecated(ModelId id)
{
    return ModelDb.GetByIdOrNull<CardModel>(id) ?? ModelDb.Card<DeprecatedCard>();
}
```

`SaveUtil` has the same fallback for every content type: `CardOrDeprecated`, `RelicOrDeprecated`,
`PotionOrDeprecated`, `EncounterOrDeprecated`, `EventOrDeprecated`, `AncientEventOrDeprecated`,
`ModifierOrDeprecated`, `EnchantmentOrDeprecated`, `MonsterOrDeprecated`, `CharacterOrDeprecated`,
`ActOrDeprecated`.

**What to tell the player**: nothing is broken. Play the card and it leaves the deck. The run
continues and the save stays valid.

**What not to conclude**: do not read `ModelDb.GetById` and decide that a missing model breaks a
save. `GetById` throws `ModelNotFoundException`, but save loading never calls it.

**Related**: the stale id also stays in `discovered_cards` in `progress.save`. The card library
builds a `HashSet<ModelId>` from that list and compares by id, so a stale entry matches nothing.
