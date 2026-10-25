# Traps

Use this page when a mod installs or compiles but behaves differently from the request. A symptom does not prove a cause by itself.

## Symptom index

| Symptom | Entry |
|---|---|
| A mod is grey or skipped | [Disabled state](#1-the-mod-is-disabled) |
| RitsuLib does not load | [Incomplete runtime](#2-the-ritsulib-runtime-is-incomplete) |
| A card has no title or description | [Localization path or key](#3-the-localization-path-or-key-is-wrong) |
| A portrait falls back or disappears | [Raw PNG without an import pair](#4-the-pck-contains-only-a-raw-png) |
| An old content ID changed | [ID normalization](#5-the-public-entry-was-normalized) |
| `CommonActions` does not exist | [Wrong helper owner](#6-the-helper-belongs-to-another-framework) |
| A type exists but is absent from a dump | [Incomplete dump](#7-the-dump-is-incomplete) |
| PCK is declared but not installed | [Missing build artifact](#8-the-pck-artifact-is-missing) |
| A dependency does not install | [Vendor version](#9-the-vendor-version-is-not-accepted) |
| A Workshop update never arrives | [Local duplicate](#10-a-local-copy-hides-the-workshop-copy) |
| `zh_hans_cn.json` is missing in RitsuLib logs | [Upstream settings translation](#11-the-ritsulib-settings-translation-is-missing) |

## 1. The mod is disabled

**Check**: Look for `Skipping loading mod <id>, it is set to disabled in settings`.

**Cause**: The per-mod enabled state is off. The global `mods_enabled` switch can also be off.

**Action**: Enable the mod in Mod Settings and restart. Do not edit `settings.save`.

**Not proof**: A manifest or dependency error is not required for this symptom.

## 2. The RitsuLib runtime is incomplete

**Check**: Look for loader or type-load failures. Inspect the runtime directory.

**Cause**: The installation omitted `shared/`, `compat/`, `assets.zip`, the root loader, or `mod_manifest.json`.

**Action**: Reinstall the complete runtime with `install_mod`. Do not copy only the root DLL.

**Not proof**: A successful consumer build does not prove that the runtime is installed.

## 3. The localization path or key is wrong

**Check**: Compare the normalized public entry with the keys in `localization/<lang>/cards.json`. Inspect the PCK entries.

**Cause**: The JSON is outside the PCK, the path is wrong, or the key does not match the normalized entry.

**Action**: Put the table under `assets/<ModId>/localization/` and rebuild with `validate_mod`.

**Not proof**: Registration can succeed while the title remains a key placeholder.

## 4. The PCK contains only a raw PNG

**Check**: Look for `Missing resource path` and inspect the PCK for `.import` and CTEX entries.

**Cause**: The exported game cannot import a raw PNG as an editor would.

**Action**: Build with `tools/pck-pack` through `validate_mod`. It generates the import pair.

**Not proof**: A placeholder or fallback texture does not prove that the intended portrait loaded.

## 5. The public entry was normalized

**Check**: Compare the requested entry with the ID in the registration log.

**Cause**: RitsuLib normalizes punctuation. A measured hyphen became an underscore.

**Action**: Use normalized keys and a new run. Add a dedicated migration layer if old saves must work.

**Not proof**: `FullPublicEntry` does not bypass normalization.

## 6. The helper belongs to another framework

**Check**: The compiler reports that `CommonActions` does not exist.

**Cause**: `CommonActions.CardAttack` is not a game or RitsuLib API.

**Action**: Use the game's `DamageCmd.Attack` as in `reference/example_card/FocusedStrike.cs`.

**Not proof**: The same method name in another mod does not prove that the current references provide it.

## 7. The dump is incomplete

**Check**: Run `inspect_game_code action=status`. Look for PARTIAL and missing configured assemblies.

**Cause**: A configured DLL was absent during the last rebuild.

**Action**: Restore the configured runtime and rebuild. Do not infer that a type or member is absent.

**Not proof**: A file count or a successful lookup in one module does not prove full coverage.

## 8. The PCK artifact is missing

**Check**: Look for `NO_PCK` or `has_pck is true, but assets/ is missing or empty`.

**Cause**: The manifest declares a PCK, but source assets are absent or the build did not produce the file.

**Action**: Add nonempty `assets/` and run `validate_mod` before `install_mod`.

**Not proof**: An old PCK after a failed build is not a valid artifact. The validator deletes it before rebuilding.

## 9. The vendor version is not accepted

**Check**: Look for `no readable version`, `does not match repository version`, or `older than required`.

**Cause**: The vendor manifest is unreadable, inconsistent with the repository, or too old for the consumer.

**Action**: Use the matching official runtime. Do not overwrite an existing player dependency.

**Not proof**: Files copied into a staging directory do not prove that installation succeeded.

## 10. A local copy hides the Workshop copy

**Check**: Look for duplicate local and Workshop dependencies.

**Cause**: The loader prefers the local copy. The Workshop copy cannot update while the local copy remains.

**Action**: Keep one source. `install_mod` never replaces an existing dependency.

**Not proof**: A newer Workshop version on disk does not prove that the game loads it.

## 11. The RitsuLib settings translation is missing

**Check**: Look for `Could not load translation asset 'localization/settings/zh_hans_cn.json'` before consumer registration.

**Cause**: RitsuLib 0.6.10 reports this settings resource as missing in a Chinese locale.

**Action**: Record it separately from consumer assets. Check the settings UI before assigning it to a mod.

**Not proof**: This line does not mean the consumer PCK is missing its card localization.
