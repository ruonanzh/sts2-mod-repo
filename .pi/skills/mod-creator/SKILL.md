---
name: mod-creator
description: 'Use when the player wants to make or change a mod. Covers requirement selection, implementation, and validation. Use add-card for a new card. Not for installation or environment setup.'
---

# Make a mod

**Goal**: Produce a mod that passes `validate_mod`. Use a capability procedure for the content instead of repeating its rules here.

## 1. Confirm the request

Get one clear sentence from the player. Identify the content type, gameplay behavior, languages, and assets.

Choose the reference:

- Use `reference/example_mod/` for an official-loader patch without RitsuLib.
- Use `reference/example_card/` for a RitsuLib card.
- For another capability, first check whether a working reference and capability SKILL exist.

Do not invent a supported capability from a template name alone.

## 2. Read the capability procedure

For a card, stop here and complete `.pi/skills/add-card/SKILL.md`.

For a relic, stop here and complete `.pi/skills/add-relic/SKILL.md`.

For a power, stop here and complete `.pi/skills/add-power/SKILL.md`.

The remaining steps are for other mods.

For another task, read `reference/ritsulib-wiki/INDEX.md`. Choose only the relevant upstream pages. Check the pinned API with `inspect_game_api` before writing code.

For a non-card mod, use `mod-page` before implementation when the player must choose a scope, values, or between options.

Read `docs/ritsulib.md` for framework rules and `docs/pck.md` for packaged resources.

## 3. Create the mod

Copy the chosen reference into `your_mods/<mod name>/`. Change the assembly name, namespace, manifest file name, and manifest id together.

Keep exactly one top-level JSON file. Use `<id>.json`, `<id>.dll`, and `<id>.pck` when a PCK is needed.

Declare the runtime dependency when the project references RitsuLib:

```json
{ "id": "STS2-RitsuLib", "min_version": "0.6.10" }
```

Use `has_pck: true` only when the mod has packaged resources. Put source assets under `assets/`.

## 4. Implement the behavior

Register the assembly with `ModTypeDiscoveryHub` when using attribute registration. Use attributes or one content pack, not both for the same model.

Check every unfamiliar type or member with `inspect_game_api`. Use `inspect_game_code` for call sites across the dump.

Keep game-only patches separate from framework registration. Do not register the same model twice.

## 5. Validate

Run `validate_mod modDir=your_mods/<mod name>`.

The tool compiles the assembly and builds a PCK when required. PARTIAL is not valid. Fix the named prerequisite and run it again.

## Acceptance

- `validate_mod` returns PASS and `compiled`.
- The DLL exists and matches the manifest id.
- A declared PCK exists and contains the intended resources.
- The manifest declares every required runtime dependency.
- Installation and gameplay remain for `mod-installer` and the capability acceptance steps.

## Failure map

Use `docs/traps.md` for disabled mods, missing runtime files, localization keys, raw PNG resources, normalized IDs, incomplete dumps, and missing PCK artifacts.
