# Game mechanics

This page covers the official game behavior. RitsuLib behavior belongs to `ritsulib.md`.

## Runtime

The local game is v0.107.1, commit 59260271. It uses Godot 4.5.1 and C# `net9.0`. Build mods with the .NET 9 SDK.

The macOS data directory is `SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64`. The Windows data directory is `data_sts2_windows_x86_64`.

## Mod directories

| Source | macOS | Windows |
|---|---|---|
| Local mods | `SlayTheSpire2.app/Contents/MacOS/mods/` | `<game directory>/mods/` |
| Workshop | `<Steam>/steamapps/workshop/content/2868840/<publishedFileId>/` | The same layout |

The game does not create the local mods directory. `install_mod` creates it when needed.

## Manifest and loading

`ModManager` scans mod directories recursively. It treats every top-level `.json` as a manifest. A consumer mod should therefore have exactly one top-level JSON file.

The repository convention is `<id>.json` for a consumer mod. Official dependency packages can use `mod_manifest.json`. The loader reads the assembly and PCK from the manifest `id`, not from the directory name.

A mod uses these ten keys:

`id`, `name`, `author`, `description`, `version`, `has_pck`, `has_dll`, `dependencies`, `affects_gameplay`, `min_game_version`.

Unknown keys are ignored. Missing `id` prevents loading. `<id>.dll` must match the `id` when `has_dll` is true. `<id>.pck` must exist when `has_pck` is true.

The initializer attribute is `MegaCrit.Sts2.Core.Modding.ModInitializerAttribute`. The initializer method must be static and take no parameters. Without an initializer, the loader applies `Harmony.PatchAll` to the assembly.

Dependencies load before their consumers through topological sorting. A local copy and a Workshop copy with the same id are duplicates. The local copy wins and can hide Workshop updates.

## PCK mounting

The loader mounts `<id>.pck` through `ProjectSettings.LoadResourcePack`. The one-argument call uses `replaceFiles: true` in this game build. A later pack can replace the same `res://` path from an earlier pack.

Packaging resources is a separate step from compiling the assembly. `validate_mod` builds both when `has_pck` is true.

## Enabled states

The global switch is `mod_settings.mods_enabled` in `settings.save`. When it is false, every mod is disabled. The log can mention only that the player has not accepted mod loading.

Each mod also has an enabled state in Mod Settings. A mod can be present and still be skipped because it is disabled. Enable the mod and restart the game. Do not edit `settings.save` to work around this state.

Use `-nomods` only as a control. It skips all mod initialization and cannot prove that a mod works.

## Saves and startup

Modded and vanilla saves use separate branches. The modded profile path contains `user://steam/<steam-id>/modded/profileN`.

On macOS, start the game through Steam when arguments are needed:

```sh
open "steam://rungameid/2868840//-nomods"
```

## Sources

- `~/.gamer-agent-pi/decompiled/sts2-mod-repo/cs/sts2/MegaCrit/Sts2/Core/Modding/ModManager.cs`
- `~/.gamer-agent-pi/decompiled/sts2-mod-repo/cs/sts2/MegaCrit/Sts2/Core/Modding/ModManifest.cs`
- Local measurements on 2026-10-18 and R0 through R2 on 2026-10-25.
