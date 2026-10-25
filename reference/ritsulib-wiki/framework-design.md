## Choose An Entry Point

Most mods only need five entry points.

| Need | Use |
| --- | --- |
| Register models, keywords, epochs, card piles, and top-bar buttons | `RitsuLibFramework.CreateContentPack(modId)` |
| Patch game methods | `RitsuLibFramework.CreatePatcher(modId, patcherName)` |
| React to game timing | `RitsuLibFramework.SubscribeLifecycle<TEvent>(...)` |
| Store JSON data | `RitsuLibFramework.BeginModDataRegistration(modId)` and `GetDataStore(modId)` |
| Add settings UI | `RitsuLibFramework.RegisterModSettings(modId, configure)` |

Use lower-level registries only when you need conditional registration, manifest-style arrays, or integration code shared across several mods.


## User API Layers

RitsuLib's public API is split by the work a mod author is doing:

- `Scaffolding.Content` supplies templates and builder methods for game content.
- `Content`, `Keywords`, `CardTags`, `CardPiles`, `Timeline`, `Unlocks`, and `TopBar` hold registries.
- `Data` and `Utils.Persistence` handle mod data.
- `Settings.ModSettings` and `Settings.ModSettingsUi` build player-facing settings pages.
- `Patching` wraps Harmony registration and diagnostics.
- `Audio`, `RuntimeInput`, and `Ui` provide runtime helpers.


## Recommended Reading Order

1. [Getting started](/guide/getting-started)
2. [Content authoring](/guide/content-authoring-toolkit)
3. One feature page: character, settings, persistence, audio, or patching
4. [Diagnostics and compatibility](/guide/diagnostics-and-compatibility) before release
