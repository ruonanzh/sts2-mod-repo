---
name: mod-installer
description: 'Use when the player says "install it into the game", "I want to try it", or "is it installed yet". Covers copying the artifact, checking the load switch, restarting the game, and checking the log for proof. Not for: a mod that is not compiled yet (see mod-creator first), or environment paths that are not recorded yet (see setup-workspace first).'
---

# Install a mod into the game

**Goal**: Make the game load the mod, and prove the load with the log. This step is not the same as a successful file copy.

## 1. Required input

One item only: which mod to install, the directory name under `your_mods/`. The paths come from the state file. Do not ask the player.

## 2. Steps

1. Run `install_mod modDir=your_mods/<name>`. It copies `<id>.json` and `<id>.dll` into their own subdirectory of the mods directory.
2. Read `mods_enabled` in the result:

   | Value | Meaning | Next step |
   |---|---|---|
   | `true` | The mod loads | Restart the game now. |
   | `false` | The master switch is off. Every mod becomes Disabled, and the game **reports no error**. | Tell the player to turn it on in Mod Settings in the game, then restart. |
   | Not readable | The player has not started the game yet, or the save path differs. | Ask the player to restart the game, then read the log. If the mod does not appear, come back and check the switch. |

   Why this gets its own report: when `PlayerAgreedToModLoading` is false, the loader sets `mod_states = Disabled` at once. The log then holds only `Skipping loading mod <id>, user has not yet seen the mods warning`. The field name in the save file is `mods_enabled`.
3. Restart the game. The game finds a new mod only at startup. A mod installed while the game runs is not loaded.
4. When you pass arguments to the game, start it through Steam: `open "steam://rungameid/2868840//-nomods"`. To run the binary inside the bundle directly is not the canonical path.

## 3. Acceptance

Read the log at `~/Library/Application Support/SlayTheSpire2/logs/godot.log`. All four lines must appear:

```
Found mod manifest file .../mods/<directory>/<id>.json
Loading assembly DLL .../mods/<directory>/<id>.dll
Calling initializer method of type <T> for <id>, Version=...
 --- RUNNING MODDED! --- Loaded N mods (M total)
```

If you see only the first line, the assembly did not load. Check `has_dll` and the file name. If you see the first two lines but not the third, the assembly loaded, but it holds no `[ModInitializer]`.

Two more points must hold before you finish. The mod list in the game shows the mod. The save uses the modded branch, with this log line: `Profile-scoped data path initialized: user://steam/<id>/modded/profileN`.

## 4. Common errors

| Symptom | Cause | Action |
|---|---|---|
| The game does not show the mod after the install | The master load switch is off | See the table above. |
| The log does not hold even the first line after the install | The mods directory is in the wrong place | Recheck modInstallDir with `check_game_paths`. |
| The directory name carries `_pimod` | Another mod holds the target directory | Normal behavior. Nothing was overwritten. Tell the player that the mods directory now holds two copies. |
| The game shows duplicate | The same mod is in the Workshop and locally at the same time | Normal behavior: the local copy wins. |
| The log says the version is not supported | The manifest `min_game_version` is higher than the installed game version | After a game version change, change the manifest in the same pass. |
| The game crashes after the install | The entry method is not static, or the load throws an exception | Read `Exception thrown when calling mod initializer` in the log. |
