---
name: mod-creator
description: 'Use when the player wants to make a mod, add a piece of gameplay, change a card value, or add a new card. Covers the whole span from copying the sample to a successful compile. Not for: installing an existing mod into the game (see mod-installer), or when the environment is not ready (see setup-workspace).'
---

# Make a mod

**Goal**: Produce a mod directory that compiles and passes `validate_mod`. Gameplay is not the concern here, only correct structure.

## 1. Required input

| Question | Default |
|---|---|
| What to make | You must get one clear sentence from the player, for example "add a 2-cost attack card" |
| How to name the mod | The directory name the player gives. It sets the directory only, not the name in the game. |
| Whether to use BaseLib | Use it when you add content: cards, relics, events, or characters. A patch-only mod may leave it out. |

## 2. Steps

1. Read `reference/base-lib-wiki/INDEX.md` first. Compare the player's request with the table of
   tasks, and read the one or two pages that it names. Do not page through the snapshot.

   The wiki is a snapshot of the upstream documentation. It shows how the author expects the code
   to look, and it lists the topics that it does not cover at all. Step 5 queries the real names.

2. Copy a sample directory, then **change all three places that carry the name in one pass**.
   Use `reference/example_mod/` for a mod that only patches the game. Use `reference/example_card/`
   for a mod that adds content: that sample already carries `[Pool]`, the in-code localisation, and
   the patch that puts the card into the starting deck.

   ```
   cp -r reference/example_mod/. your_mods/<your name>/      # or reference/example_card/
   ```

   The `/.` matters. `cp -r reference/example_mod your_mods/<name>` copies the directory
   **into** the target when the target already exists, which gives
   `your_mods/<name>/example_mod/`. `validate_mod` then reports no manifest.

   | Where to change | New value |
   |---|---|
   | `<AssemblyName>` in the `.csproj` | Your mod id |
   | The `namespace` in `Entry.cs` | The same |
   | The file name of `<name>.json` and its `id` field | The same |

   The three places must match exactly. The loader reads the assembly as `<id>.dll`. If the file name and the id differ, it does not load the mod, and it reports no error.

3. Write or change the entry point. The entry method is static and takes no parameters:

   ```csharp
   [ModInitializer(nameof(Init))]
   public static class Entry
   {
       public static void Init() { /* your mod */ }
   }
   ```

4. Write the manifest. The manifest accepts only these 10 keys: `id`, `name`, `author`, `description`, `version`, `has_pck`, `has_dll`, `dependencies`, `affects_gameplay`, `min_game_version`.

   | Key | The rule in this repository |
   |---|---|
   | `has_dll` | Must be `true` |
   | `has_pck` | v1 must be `false`. If you write `true` and the build produces no `.pck`, the loader logs an error and loads the mod without its assets. The mod then looks installed but its resources are absent. |
   | `version` | Must be `x.y.z`. If parsing fails, every mod that depends on it fails. |
   | `min_game_version` | Write the local version (currently `0.107.1`). If you leave it out, you get a WARN only. |
   | `affects_gameplay` | Write `true` when you change game logic, and `false` for appearance only. A wrong value causes a multiplayer desync. |
   | `dependencies` | When you use BaseLib, write `[{"id":"BaseLib","min_version":"3.4.7"}]`. This is the version in `vendor/baselib`. A lower number works only when your code calls nothing new. |

   **The directory must hold one `.json` file only.** The loader reads every `.json` file as a manifest.

5. Before you use a game API, query the name first. Do not work from memory. Run `inspect_game_api action=search target=<substring>`, then read the source with `action=decompile target=<full name>`. The wiki gives the shape of the code. It does not prove a type or a member name.

   For a whole-tree question ("who calls X"), use `inspect_game_code`: `action=search target=<substring>` returns `file:line`, `action=type target=<name>` returns one file, and `action=body target=<name> member=<member>` returns only that member (overloads included). The tree is `~/.gamer-agent-pi/decompiled/sts2-mod-repo/` and covers `sts2` and `baselib`. To add another assembly, edit `decompile.json` and run `action=dump`. Nested types live inside the enclosing type's file, and compiler-generated `<>` types are not exported, so do not grep for those names.
6. Compile and validate: `validate_mod modDir=your_mods/<your name>`.

## 3. Acceptance

- `validate_mod` returns PASS, and its text contains the word `compiled`.
- A PARTIAL return **does not pass**. It means the build did not compile. Resolve the precondition that the NEXT line names, then run it again.
- To prove that the artifact is really your code, run `strings -a <id>.dll | grep ModInitializerAttribute`. You must see output.

## 4. Common errors

| Symptom | Cause | Action |
|---|---|---|
| `manifest file is X.json but its id is Y` | The file name and the id differ | Change both places together. Do not change only one. |
| `found N .json files at the top` | The directory holds a second json file | Delete the extra one. A config file needs another extension or a subdirectory. |
| `AssemblyName is "A" but the manifest id is "B"` | You did not change the csproj | Change `<AssemblyName>`. |
| `missing <id>.dll after a successful build` | The output name and the id differ | The same as above. |
| `dll looks like an empty stub` | The csproj points the output directory at the project root. The SDK then excludes the source files. | Delete the custom `OutputPath`. Use the default `bin/Release`. |
| `NETSDK1045` | The SDK is older than 9 | See setup-workspace. |
| `min_game_version is X but the installed game is Y` | The manifest version is higher than the local game | Change it to a version no higher than the local one. |
| The build reports a type it cannot find | The type name is wrong, or the assembly is not referenced | Query the real name with `inspect_game_api`. The reference list is `compile.references` in `mod-repo.json`. |
