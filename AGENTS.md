# AGENTS.md

This repository is the **Slay the Spire 2 mod workspace**. The player and the AI agent can write mods here. Read `docs/` to learn the format. Write the mod under `your_mods/<mod name>/`. Validate it with `validate_mod`. Install it with `install_mod`.

Every game fact comes from a direct test or from decompilation. The source is in `docs/`. Before you change a conclusion here, read `docs/traps.md` first.

## Environment facts (measured on this machine, 2026-10-18)

| Item | Value |
|---|---|
| Game | The version is `v0.107.1` and the commit is `59260271`. The Steam appid is `2868840`. |
| Engine | Godot 4.5.1 (MegaCrit's own build, `MegaDot`) plus C# `net9.0`. The game ships .NET 9.0.7 itself. |
| Build | The build needs the .NET **9** SDK (`net9.0`). SDK 8 fails with `NETSDK1045`. |
| mods directory | macOS: `SlayTheSpire2.app/Contents/MacOS/mods/`. Windows: `<game directory>/mods/`. |
| Startup | **The game must start through Steam.** To pass an argument, put it after `//`, for example `open "steam://rungameid/2868840//--verbose"`. `-nomods` is a debug switch: it turns every mod off, so it never proves that a mod loads. |

## What a mod is (one directory and two files with the same name)

```
your_mods/<directory name>/
├─ <id>.json    the manifest. **The file name must equal the id.**
├─ <id>.dll     the assembly. **The file name must equal the id.**
└─ <id>.csproj  the build project. AssemblyName must equal the id.
```

The loader finds the files by `id`. **The directory name takes no part.** The mod directory **holds only one `.json`**, because the loader reads every `.json` as a manifest.

The entry point is a `[ModInitializer("method name")]` attribute on a type. The method **must be static and must take no parameters**. If the attribute is absent, the loader runs `Harmony.PatchAll(assembly)` by itself.

## Directory responsibilities

- `reference/example_mod/`: the starting point for a new mod. After you copy it, change three names. These are the `AssemblyName` in the csproj, the namespace in `Entry.cs`, and the `id` in `<name>.json`. The three names must match.
- `.pi/lib/`: the criteria (**single source of truth**). `game-paths.ts` holds the paths. `dotnet.ts` holds the SDK. `game-settings.ts` holds the mod loading switch. `mod-identity.ts` holds the manifest rules.
- `.pi/extensions/`: the tools. A game class name or a game directory name **must not** appear here. Everything goes through `mod-repo.json`.
- `.pi/skills/`: the three procedures. `setup-workspace` gets the machine ready. `mod-creator` makes a mod, and its first step reads the wiki index. `mod-installer` puts a mod into the game and proves it loaded.
- `docs/`: the game's own mechanics, paths, and traps. Start at `docs/INDEX.md`, then read `docs/traps.md` before you debug anything.
- `reference/base-lib-wiki/`: a verbatim snapshot of the BaseLib wiki. `INDEX.md` inside it maps a player request to the page that explains it.
- `mod-repo.json`: the only contract file (constants, no criteria).

## The 8 questions to answer before onboarding (the StS2 answers)

| # | Question | Answer | Source |
|---|---|---|---|
| 1 | How does the game load a mod? | The official loader is the built-in `ModManager`. It scans `mods/` recursively and reads every `.json` as a manifest. It loads `<id>.dll` by `id`. | `docs/game.md` |
| 2 | Where do the products go? What is the relation between the names? | The products go into any subdirectory under the mods directory, because the scan is recursive. **The file name equals the `id` in the manifest**, and the directory name does not matter. | `docs/game.md` |
| 3 | What is the entry point called? What is its lifecycle? | The entry point is `[ModInitializer("Init")]` on a type, plus `public static void Init()`. If the attribute is absent, the loader runs `Harmony.PatchAll` by itself. | `docs/game.md` |
| 4 | Where do the assets go? | v1 ships **no assets** (DLL-only). If the mod needs assets, they are a Godot `.pck` (`has_pck`). See `docs/game.md`. | `docs/game.md` |
| 5 | What identifies the content? | The class name plus the namespace (`CustomCardModel` and similar, and BaseLib adds the `MODID-` prefix by itself). A card image uses `Pool.Title` plus `Id.Entry`. | `docs/game.md` |
| 6 | Which container concepts exist? | Card pool, relic pool, potion pool, event, encounter, Act, character. The `[Pool(typeof(...))]` attribute sets the pool of a type. | `docs/game.md` |
| 7 | How is the localization stored? | In `localization/<eng\|zhs\|...>/<family>.json`, a flat map. A key looks like `MODID-MODEL.title`. | `docs/game.md` |
| 8 | Which changes fail silently? | See `docs/traps.md`. It is the most important page in this repository. | `docs/traps.md` |

## Hard rules

- **Do not guess a class name or a field name.** Use `inspect_game_api` for the answer. `action=search` lists the real type names. `action=decompile` reads the C# behind one type or member. Add the fact you found to `docs/`, together with the search term.
- **Installed does not mean loaded.** The game holds a global switch in `settings.save`, `mod_settings.mods_enabled`. If that value is `false`, the game marks every mod `Disabled` and **reports no error**. `install_mod` reports this state. If the value is `false`, you must tell the player to switch it on.
- **Do not write other files in the game directory.** Write only your own directory under the mods directory. Do not touch `settings.save`. Do not touch a `.pck`.
- **One change, one validation.** After a change, the mod must compile and must load. State a reproducible validation, such as reading `godot.log`.
- **A tool must hold no game constant.** The paths, the assembly names, and the appid all come from `mod-repo.json`.
- **Do not assume assets.** v1 is a pure DLL. To add a `.pck`, first change `compile.pck` in `mod-repo.json`. Then make the export chain work.

## For maintainers

`scripts/dev-harness.mjs` can run a single tool without starting a session, which is useful for a local self-test after a change. It lives in `scripts/` with the other maintainer checks, not in `.pi/`, because `.pi/` is what the product loads: extensions, criteria, and skills. It needs two stub packages in `node_modules/`, `typebox` and `@earendil-works/pi-coding-agent`. Those two do not go into the repository.
