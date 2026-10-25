# PCK and packaged resources

This page covers the lightweight packaging workflow. A Godot editor is not required.

## Configuration

`compile.pck` in `mod-repo.json` enables the packer for this repository. `has_pck` in a mod manifest enables it for one mod.

| `compile.pck` | `has_pck` | Result |
|---|---|---|
| false | false | DLL-only mod |
| false | true | Validation failure |
| true | false | DLL-only mod |
| true | true | Build `<id>.pck` from `assets/` |

Only a mod with `has_pck: true` needs a nonempty `assets/` directory. Do not require assets for DLL-only mods.

## Build and install

`validate_mod` compiles the assembly and then runs `tools/pck-pack`. It deletes an old PCK before rebuilding. A failed build cannot reuse a stale artifact.

`install_mod` copies `<id>.json`, `<id>.dll`, and `<id>.pck` when the manifest declares a PCK. Missing PCK output stops installation.

## Resource layout

Put source assets below `assets/` and keep the mod id as the first path segment:

```text
assets/
└─ ExampleCard/
   ├─ images/cards/focused_strike.png
   └─ localization/
      ├─ eng/cards.json
      └─ zhs/cards.json
```

Inside the PCK, the same paths become `res://ExampleCard/...` paths.

## Why a raw PNG is not enough

An exported game does not run the editor importer. A raw PNG in a PCK can therefore be absent to `ResourceLoader`.

Each PNG needs two generated entries:

1. `<source>.png.import`, which maps the source path to a CTEX.
2. `.godot/imported/<filename>-<md5(res://source-path)>.ctex`.

The packer writes CTEX version 1 with `DATA_FORMAT_PNG`. The embedded payload uses Godot's `PNG ` prefix. The path hash is MD5 of the full `res://` source path.

R0 measured a missing portrait with a raw PNG. The same PNG loaded at 512×384 after the import pair was added.

## Current packer limits

The current PNG importer accepts 8-bit RGB and RGBA source images. It does not accept generated `.import` files or a source `.godot/` directory as input. Keep generated files out of the source assets directory.

The packer currently targets PCK format 3 and Godot 4.5.1. Test other resource types before claiming support for them.

## Sources

- `tools/pck-pack/`
- R0 and R2 runtime measurements on 2026-10-25.
