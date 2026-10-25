# RitsuLib guide task map

This directory contains the English sections of the RitsuLib v0.6.10 guide. [`SOURCE.md`](SOURCE.md) records the commit and extraction method.

Use this index to choose a page. Do not read the whole snapshot. Check API signatures against `inspect_game_api` or the dump before copying an example.

## Common tasks

| Task | Pages |
|---|---|
| Add RitsuLib to a project | [`getting-started.md`](getting-started.md) |
| Register content and stable IDs | [`content-authoring-toolkit.md`](content-authoring-toolkit.md), [`content-packs-and-registries.md`](content-packs-and-registries.md) |
| Add a card with dynamic values | [`card-dynamic-var-toolkit.md`](card-dynamic-var-toolkit.md) |
| Add localization and keywords | [`localization-and-keywords.md`](localization-and-keywords.md), [`loc-string-placeholder-resolution.md`](loc-string-placeholder-resolution.md) |
| Add card or content art | [`asset-profiles-and-fallbacks.md`](asset-profiles-and-fallbacks.md) |
| Add a character and starter loadout | [`character-and-unlock-scaffolding.md`](character-and-unlock-scaffolding.md) |
| Add events or ancient options | [`custom-events.md`](custom-events.md) |
| Add creature visuals or animation | [`creature-visuals-and-animation.md`](creature-visuals-and-animation.md), [`godot-scene-authoring.md`](godot-scene-authoring.md) |
| Add combat resources or card costs | [`secondary-resources.md`](secondary-resources.md) |
| Add settings | [`mod-settings.md`](mod-settings.md) |
| Save data and migrations | [`persistence-guide.md`](persistence-guide.md) |
| Use lifecycle events | [`lifecycle-events.md`](lifecycle-events.md) |
| Patch game methods | [`patching-guide.md`](patching-guide.md) |
| Add story and unlock progression | [`timeline-and-unlocks.md`](timeline-and-unlocks.md) |
| Add audio | [`fmod-and-audio.md`](fmod-and-audio.md) |
| Diagnose compatibility problems | [`diagnostics-and-compatibility.md`](diagnostics-and-compatibility.md) |
| Inspect logs in a browser | [`debug-log-viewer.md`](debug-log-viewer.md) |

## Architecture and optional systems

- [`framework-design.md`](framework-design.md): framework modules and dependency direction.
- [`terminology.md`](terminology.md): names used by the guide.
- [`shell-theme.md`](shell-theme.md): runtime UI helpers.
- [`update-checks.md`](update-checks.md): update notifications.
- [`telemetry-backend.md`](telemetry-backend.md): telemetry behavior.

## Local acceptance boundary

The upstream guide explains available APIs. It does not prove that this repository has accepted every capability.

For a card, use [`../example_card/`](../example_card/) as the accepted reference. Its build and runtime checks cover registration, art, English and Chinese text, starting-deck insertion, discovery, damage, and upgrade behavior.
