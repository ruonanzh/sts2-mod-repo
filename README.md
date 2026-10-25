# Slay the Spire 2 mod workspace

Create Slay the Spire 2 mods under `your_mods/`. Use `validate_mod` before `install_mod`.

- `AGENTS.md` is the product-side workspace map.
- `docs/INDEX.md` maps game, RitsuLib, PCK, decompilation, and failure documents.
- `reference/ritsulib-wiki/INDEX.md` maps tasks to the English RitsuLib guide.
- `reference/example_card/`, `reference/example_relic/`, `reference/example_power/`, and `reference/example_potion/` are accepted RitsuLib examples.

## Mod form

The repository uses `modType: godot-csharp`. A mod can produce:

```text
<id>.json
<id>.dll
<id>.pck    when has_pck is true
```

The PCK is optional. `tools/pck-pack` builds it from `assets/` without a Godot editor.

## Agent tools

| Tool | Purpose |
|---|---|
| `check_runtime` | Check the .NET 9 SDK and build the API probe |
| `try_set_game_dir` / `set_game_dir` / `check_game_paths` | Locate, record, and check game paths |
| `validate_mod` | Check the manifest and dependencies, compile, and build PCK |
| `inspect_game_api` | Read exact game and RitsuLib types, members, C#, IL, and strings |
| `inspect_game_code` | Search and read the managed-code dump |
| `install_mod` | Install mod artifacts and missing dependencies |

Shared criteria live in `.pi/lib/`. `mod-repo.json` holds the static contract.

## RitsuLib runtime

`vendor/ritsulib/` contains the official RitsuLib 0.6.10 runtime for game 0.107.1. Its `mod_manifest.json`, `shared/`, `compat/`, and `assets.zip` must remain intact.

`install_mod` places the runtime only when no copy exists. It never replaces an existing dependency. See [`vendor/ritsulib/README.md`](vendor/ritsulib/README.md) and [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

## Capability guides

Use `.pi/skills/mod-creator/` for the general workflow. Use `add-card`, `add-relic`, `add-power`, or `add-potion` for its accepted capability. More capability guides will be added only after their examples pass runtime acceptance.
