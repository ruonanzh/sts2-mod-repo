# Slay the Spire 2 mod workspace

This repository is the modding environment for Slay the Spire 2. Create player mods only under `your_mods/`. The rest of the workspace is read-only.

## Environment facts

| Item | Current contract |
|---|---|
| Game | v0.107.1, commit 59260271 |
| Runtime | Godot 4.5.1 and C# `net9.0` |
| Framework | RitsuLib 0.6.10, compatibility package `STS2.RitsuLib.Compat.0.107.1` |
| Build | .NET 9 SDK |
| Steam app id | 2868840 |
| macOS mods | `SlayTheSpire2.app/Contents/MacOS/mods/` |
| Windows mods | `<game directory>/mods/` |

## Workspace map

- `your_mods/`: the only write area for a player mod.
- `reference/example_mod/`: a zero-framework mod with the official loader entry point.
- `reference/example_card/`: a RitsuLib card with packaged art and English and Chinese text.
- `reference/ritsulib-wiki/INDEX.md`: the task map for the English RitsuLib guide.
- `docs/INDEX.md`: the map for game, RitsuLib, PCK, decompilation, and failure documents.
- `.pi/extensions/`: agent tools. Use `validate_mod` before `install_mod`.
- `.pi/skills/`: role and capability procedures. `add-card` owns the card workflow.
- `mod-repo.json`: machine-readable constants and the dependency contract.

## Rules

1. Write only inside `your_mods/<mod name>/`.
2. Use `inspect_game_api` or `inspect_game_code` before using an unfamiliar type or member. Do not guess API names.
3. Use RitsuLib for new content unless the task needs only the official loader. Declare `STS2-RitsuLib` in the manifest when the project references it.
4. Set `has_pck` only when the mod needs packaged resources. Put source assets under `assets/`. No Godot editor is needed.
5. Run `validate_mod` after a source or manifest change. A PARTIAL result is not valid.
6. Run `install_mod` only after validation passes. Installed does not mean loaded.
7. Check `mods_enabled` and the per-mod enabled state when the game does not load a mod.
8. Read `docs/traps.md` before debugging a silent failure.

The entry method for a mod is static and takes no parameters. Use `[ModInitializer]` and register the assembly with RitsuLib when the mod uses attribute registration.
