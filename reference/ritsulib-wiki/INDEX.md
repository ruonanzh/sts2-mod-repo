# RitsuLib guide task map

Start mod research here. Match the player's request to a page. Read only the selected pages. Use the key topics to decide whether a page covers the requested behavior.

This directory contains the English sections of the RitsuLib v0.6.10 guide. [`SOURCE.md`](SOURCE.md) records the commit and extraction method. Check API signatures against `inspect_game_api` or the dump before copying an example.

## Start

| Page | Key topics |
|---|---|
| [`getting-started.md`](getting-started.md) | Install the package, initialize the framework, register the assembly, and register content. |
| [`terminology.md`](terminology.md) | Core terms and naming rules. |
| [`framework-design.md`](framework-design.md) | Entry points, user API layers, and recommended reading order. |
| [`content-authoring-toolkit.md`](content-authoring-toolkit.md) | Registration styles, attributes, content packs, model templates, card type text, and entry IDs. |
| [`content-packs-and-registries.md`](content-packs-and-registries.md) | Builder surface, attribute surface, direct registries, manifests, and registration timing. |

## Content

| Page | Key topics |
|---|---|
| [`card-dynamic-var-toolkit.md`](card-dynamic-var-toolkit.md) | Variables, context factories, damage and block wrappers, energy, star, and power icon counts, tooltips, safe reads, and preview logic. |
| [`character-and-unlock-scaffolding.md`](character-and-unlock-scaffolding.md) | Character templates, starter deck, relic, and potion ordering, visibility, vanilla progression, and unlock rules. |
| [`custom-events.md`](custom-events.md) | Event models, option keys, relic options, existing Ancient options, Trash Heap candidate pools, and Ancient dialogue. |
| [`timeline-and-unlocks.md`](timeline-and-unlocks.md) | Story and Epoch models, content gates, Epoch unlocks, and character unlocks. |
| [`asset-profiles-and-fallbacks.md`](asset-profiles-and-fallbacks.md) | Profile-first assets, supported profiles, character profiles, and missing paths. |
| [`godot-scene-authoring.md`](godot-scene-authoring.md) | C# script registration, scene loading through profiles, scene path checks, and factory selection. |
| [`creature-visuals-and-animation.md`](creature-visuals-and-animation.md) | Minimal hooks, visual cues, state machines, and practical constraints. |

## Runtime APIs

| Page | Key topics |
|---|---|
| [`persistence-guide.md`](persistence-guide.md) | Data registration, scopes, cloud sync, run data, reads and writes, cached access, migrations, and attached state. |
| [`secondary-resources.md`](secondary-resources.md) | Resource registration, runtime state, card costs, hooks, UI, and text. |
| [`mod-settings.md`](mod-settings.md) | Settings pages, controls, bindings, visibility, host surfaces, and in-game entry points. |
| [`localization-and-keywords.md`](localization-and-keywords.md) | Two text systems, entry keys, event keys, Ancient dialogue, keywords, and I18N. |
| [`loc-string-placeholder-resolution.md`](loc-string-placeholder-resolution.md) | The game text pipeline, placeholder sources, SmartFormat extensions, and release checks. |
| [`lifecycle-events.md`](lifecycle-events.md) | Event subscriptions, common events, and version notes. |
| [`patching-guide.md`](patching-guide.md) | Patchers, patch classes, private access, dynamic patches, transpilers, async helpers, IL inspection, and release checks. |
| [`fmod-and-audio.md`](fmod-and-audio.md) | Audio playback, loops and music, audio files, bank and GUID mappings, lifecycle, and routing. |
| [`shell-theme.md`](shell-theme.md) | Settings themes, toasts, runtime hotkeys, top-bar buttons, and card piles. |
| [`debug-log-viewer.md`](debug-log-viewer.md) | Enable and open the viewer, when to use it, LAN access and tokens, visible logs, and practical notes. |
| [`update-checks.md`](update-checks.md) | Manifest hosting rules, scheduled checks, Steam Workshop mods, manifest schema, and toast behavior. |
| [`telemetry-backend.md`](telemetry-backend.md) | Scope, endpoints, payloads, and backend checks. |
| [`diagnostics-and-compatibility.md`](diagnostics-and-compatibility.md) | Warnings, compatibility mode, browser logs, missing character saves, game source notes, and release checks. |

## Local acceptance boundary

The upstream guide explains available APIs. It does not prove that this repository has accepted every capability.

Study the accepted reference that matches the request:

- [`../example_card/`](../example_card/): registration, art, localization, starting-deck insertion, discovery, damage, and upgrades.
- [`../example_relic/`](../example_relic/): relic registration, art, localization, starting relics, and combat-start behavior.
- [`../example_power/`](../example_power/): power registration, application, stacking, art, localization, and combat triggers.
- [`../example_potion/`](../example_potion/): potion registration, targeted use, starting potions, art, localization, and consumption.
