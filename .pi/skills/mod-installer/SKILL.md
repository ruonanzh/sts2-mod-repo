---
name: mod-installer
description: 'Use when the player wants to install or try a mod. Covers artifacts, dependencies, enabled states, restart, and log acceptance. Use mod-creator before compilation is complete.'
---

# Install a mod into the game

**Goal**: Load the mod and prove its artifacts and behavior. A file copy alone is not acceptance.

## 1. Install

Run `install_mod modDir=your_mods/<name>` after `validate_mod` passes.

The tool copies `<id>.json` and `<id>.dll`. It also copies `<id>.pck` when declared. Missing PCK output stops installation.

The tool fills a missing RitsuLib runtime with the complete official layout. It does not replace an existing dependency.

## 2. Check enabled states

Read `mods_enabled` in the result:

| Value | Meaning | Next action |
|---|---|---|
| `true` | The global switch allows mods | Restart the game |
| `false` | Every mod is disabled | Enable mods in Mod Settings and restart |
| Not readable | No settings file or an unknown path | Restart and inspect the log |

A mod can also be grey or skipped in Mod Settings. Enable that mod and restart. Do not edit `settings.save`.

## 3. Restart

The game discovers new mods only during startup. On macOS, start through Steam:

```sh
open "steam://rungameid/2868840"
```

For a no-mods control, use:

```sh
open "steam://rungameid/2868840//-nomods"
```

## 4. Check the log

Read `~/Library/Application Support/SlayTheSpire2/logs/godot.log` on macOS. Require these entries for the consumer mod:

```text
Found mod manifest file .../<id>.json
Loading assembly DLL .../<id>.dll
Calling initializer method of type <T> for <id>, Version=...
 --- RUNNING MODDED! --- Loaded N mods (M total)
```

For a packaged mod, also require `Loading Godot PCK .../<id>.pck`.

For RitsuLib content, require successful framework initialization and content registration. A model count or registration log is stronger evidence than `RUNNING MODDED` alone.

The mod must appear in Mod Settings. The save branch must contain `modded/profileN` for a modded run.

## 5. Check capability behavior

Use the acceptance list from the capability SKILL. For a card, check registration, text, portrait, damage, and upgrade.

Use `docs/traps.md` for disabled mods, missing runtime files, missing resources, normalized IDs, incomplete dumps, dependency versions, and duplicates.

Use `mod-page` for a finished-mod summary only when the session has a writable bound mod directory. Otherwise, summarize in text.

## Common failures

| Symptom | Cause | Action |
|---|---|---|
| No manifest entry | Wrong mods directory | Check `modInstallDir` with `check_game_paths` |
| DLL does not load | Wrong assembly name or `has_dll` | Check the manifest and build output |
| PCK is missing | Empty assets or failed PCK build | Run `validate_mod` and inspect its error |
| The mod is skipped | Disabled state | Enable it and restart |
| Workshop update is ignored | A local duplicate wins | Keep one dependency source |
| The mod loads without its content | Registration or enabled-state problem | Check the content log and Mod Settings |
