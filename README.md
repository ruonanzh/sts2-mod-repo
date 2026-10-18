# Slay the Spire 2 mod workspace

You can write Slay the Spire 2 mods directly in this environment. Read `docs/` to learn the format. Write the mod under `your_mods/<mod name>/`. Validate it with `validate_mod`. Install it with `install_mod`.

- `AGENTS.md` holds the structure and the environment facts.
- `docs/game.md` holds the game mechanics, the manifest format, and the mod loading switch.
- **`docs/traps.md` holds the trap list.** If something fails, read that page first. Almost every failure here reports no error.

## What kind of mod this is

`modType: godot-csharp`. The game is Godot 4.5.1 plus C# (`net9.0`). A mod produces:

```
<id>.json   the manifest (the file name must equal the id)
<id>.dll    the assembly (the file name must equal the id)
```

v1 ships **no asset pack** (`compile.pck: false`). To add a `.pck`, you must first make the Godot export chain work.

## Tools

| Tool | Purpose |
|---|---|
| `check_runtime` | Whether the .NET 9 SDK is ready |
| `try_set_game_dir` / `set_game_dir` / `check_game_paths` | Locate, record, and check three paths |
| `validate_mod` | Validate the manifest, compile the code, and check the products |
| `inspect_api` | Find a game type by name, then decompile it and read the source (do not guess class names) |
| `install_mod` | Copy the mod into the game's mods directory, then report the state of the mod loading switch |

The paths and the criteria are in `.pi/lib/`. `mod-repo.json` holds constants only.

## Third-party components

`tools/` holds third-party binaries that the repository tracks. They are the decompiler that ships with this repository. The inventory, the versions, and the full MIT license text are in
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md). These three files are byte-identical to upstream, and you must not change them.

`vendor/baselib/` is a different case. **BaseLib** is a content mod that the game loads on the player's machine, and the other mods depend on it (MIT, see
[`vendor/baselib/README.md`](vendor/baselib/README.md)). `install_mod` places it only when the player has
**no copy at all**. If a copy already exists, `install_mod` leaves it alone. An install over that copy would overwrite the Workshop subscription and silently pin the version
(item 9 of [`docs/traps.md`](docs/traps.md)).
