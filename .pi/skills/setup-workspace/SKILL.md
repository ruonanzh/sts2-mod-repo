---
name: setup-workspace
description: 'Use on the first session in this workspace. Read it when a tool says a path is not recorded, or the SDK is not installed. Read it also when the player asks "is the environment ready". Use it after a machine change. Not for: writing a mod (see mod-creator), or installing a mod into the game (see mod-installer).'
---

# Get the workspace ready

**Goal**: Check each prerequisite for compiling and installing, one by one. Every prerequisite has its own tool. Do not skip a step. Do not ask the player a pile of questions at one time.

## 1. Required input

One item needs the player: the game directory. Find it yourself first. Ask only when the search fails.

| Item | Default |
|---|---|
| Game directory | Run `try_set_game_dir` with no arguments first. It scans the Steam libraries and checks the result. Ask the player for the path only when it fails. |
| .NET SDK | Do not ask the player. `check_runtime` checks it. |
| Mod load switch | Do not ask the player. `install_mod` reports it. |

## 2. Steps

Do the four steps in order. Go to the next step only after you see PASS.

1. Run `check_runtime` with no arguments. It requires the .NET 9 SDK. If it returns FAIL, run `install_runtime` for the install guide, then run `check_runtime` again after the install.
   Why 9: the game uses `net9.0`, and SDK 8 reports `NETSDK1045` at compile time. Source: `compile.sdkMajor` in `mod-repo.json`, and a local measurement.
   The same step also **builds the API probe that ships with this repository** (`tools/api-probe`). The decompiler is the bundled `ICSharpCode.Decompiler.dll` (see `THIRD_PARTY_LICENSES.md`). The csproj holds zero PackageReference, so this build **needs no network**. If the probe is not built, `inspect_api` behaves as if the tool were broken.
2. Run `try_set_game_dir` with no arguments. It does three things: it finds the game directory, it derives the mod directory and the data directory, and it writes them into `.gamer-agent.local.json`.
3. Run `check_game_paths` with no arguments. It only checks the paths recorded in the previous step, and it writes nothing. The workspace is ready only when all of them return PASS.
4. Only when you need to compile: check that `validate_mod` runs (see mod-creator).

`install_runtime` gives the guide only. It does not run the install. Use it only when the player must decide.

## 3. Acceptance

- `check_runtime` returns PASS and reports the dotnet version.
- `try_set_game_dir` reports two paths, gameDir and modInstallDir.
- `check_game_paths` returns PASS for both gameDir and modInstallDir.

On macOS, modInstallDir looks like `.../SlayTheSpire2.app/Contents/MacOS/mods`. It is inside the `.app` bundle, as the game requires. This is not a configuration error. Source: the decompiled `ModManager.Initialize` takes `Path.GetDirectoryName(OS.GetExecutablePath())` and joins `mods` to it.

## 4. Common errors

| Symptom | Cause | Action |
|---|---|---|
| `check_runtime` reports an old SDK | The local machine has SDK 8, and the game needs 9 | Run `install_runtime`, install .NET 9 as the guide says, then run `check_runtime` again. |
| `try_set_game_dir` finds no game | The Steam library is on a non-default disk, or the game is not installed | Ask the player for the install directory, then record it with `set_game_dir`. |
| `try_set_game_dir` warns that the mod directory does not exist yet | The game never creates its own mods directory, and a machine that has never had a mod does not have it | Normal. `install_mod` creates it on the first install and says so. `check_game_paths` does not check existence, so it never reports this. |
| `check_game_paths` reports that the Workshop directory is not recorded | The player subscribes to no mod | Normal. It is an optional reference path. It does not affect mod creation. |
| The paths return PASS, but the game does not show the mod | The master load switch is off | See the Acceptance section of mod-installer. |
| The line `API probe built` does not appear | The `tools/api-probe` build failed | The tool writes a WARN and gives the first error line. `inspect_api` is not usable then, but compilation and installation are not affected. |
