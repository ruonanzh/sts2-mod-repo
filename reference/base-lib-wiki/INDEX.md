# BaseLib wiki snapshot: index

Upstream: [`Alchyr/BaseLib-Wiki`](https://github.com/Alchyr/BaseLib-Wiki) (MIT).
The pages in this directory are **verbatim snapshots**. Their source and version are in [`SOURCE.md`](SOURCE.md). Do **not** edit them by hand.

## How to use this page

**There are two steps and you must not skip the first one.**

1. **Find the page from what the player wants to do.** Read the table "Find a page by what you want to do" below. If a row matches, read that page. Read the pages that match only and do not read the whole set.
2. **Then check the real names.** The class names, the method names, and the parameters in the wiki may differ from this version on your machine. Before you write code, always run `inspect_api`. Use `action=search` to find a type name, `action=members` to read a signature, and `action=source` to read the implementation.

**Why the wiki is not the only source**: the wiki addresses people who want to learn modding. It leaves out the differences between versions and some pages have code snippets without the preconditions. The rule of this repository is that we never guess a class name. The wiki gives a direction and `inspect_api` gives the fact.

**Do not invent what the wiki does not state.** Read the gap list below. The only source for those items is decompilation.

## Find a page by what you want to do

| What the player wants to do | Read these pages first |
|---|---|
| Add a card | [`models/custom-card.md`](models/custom-card.md) first, then [`models/index.md`](models/index.md) for the general model rules and the ID prefix |
| Change an existing card | The same pages. Also read [`mechanics.md`](mechanics.md) for dynamic variables and target types |
| Add a relic | [`models/custom-relic.md`](models/custom-relic.md) |
| Add a potion | **The wiki has no page for this.** Read the general rules in [`models/index.md`](models/index.md), then decompile `BaseLib.Abstracts.CustomPotionModel` |
| Add a power or a buff | [`models/custom-temporary-power.md`](models/custom-temporary-power.md) |
| Add an event | [`models/custom-event.md`](models/custom-event.md) |
| Add an encounter, which is a set of enemies | [`models/custom-encounter.md`](models/custom-encounter.md) |
| Add a character | [`models/custom-character.md`](models/custom-character.md) first, which is **mostly a stub**, then [`scenes/creature-visuals.md`](scenes/creature-visuals.md) |
| Change the art and the animation of a character or an enemy | [`scenes/creature-visuals.md`](scenes/creature-visuals.md) |
| Make a string work in both Chinese and English | [`localization/code-loc.md`](localization/code-loc.md), [`localization/simplified-loc.md`](localization/simplified-loc.md), and [`localization/var-loc.md`](localization/var-loc.md) |
| Put a value that you calculate into the text of a card | [`utilities/custom-calc-vars.md`](utilities/custom-calc-vars.md) and [`localization/display-var.md`](localization/display-var.md) |
| Add a keyword or a custom enum | [`utilities/enums.md`](utilities/enums.md) |
| Add a settings screen to the mod | [`utilities/config.md`](utilities/config.md) first, then [`utilities/config-advanced.md`](utilities/config-advanced.md) |
| Add a sound effect | [`utilities/mod-audio.md`](utilities/mod-audio.md) |
| Let another mod call the interface of this mod | [`utilities/mod-interop.md`](utilities/mod-interop.md) |
| Add a field to a class of another mod | [`utilities/spirefield.md`](utilities/spirefield.md) |
| Add a node to a vanilla scene | [`scenes/add-nodes.md`](scenes/add-nodes.md) |
| Change the look of the energy counter | [`scenes/energy-counter.md`](scenes/energy-counter.md) |
| See all the capabilities that BaseLib has | [`Features.md`](Features.md), which also lists the items that have no documentation yet |

## All pages

| Page | Topic | Status |
|---|---|---|
| [`Features.md`](Features.md) | The full feature list: the capabilities worth a look, the undocumented items, and the small features such as relic image overrides and description hooks | complete |
| [`mechanics.md`](mechanics.md) | The hook interfaces that BaseLib adds, keywords, dynamic variables (Persist/Exhaustive/Refund), and custom target types | complete |
| [`models/index.md`](models/index.md) | The general rules for a custom model. ModelDb loads the model automatically, and **an ID gets a prefix automatically**. `Custom*Model` is mandatory in some cases. | complete |
| [`models/custom-card.md`](models/custom-card.md) | Cards: `[Pool]` is mandatory and a subclass inherits it, the `ConstructedCardModel` alternative, and the frame and banner overrides | **The `CardModel` section is a TODO** |
| [`models/custom-relic.md`](models/custom-relic.md) | Relics: `[Pool]`, `GetUpgradeReplacement`, and the three icon paths with their default locations | complete |
| [`models/custom-character.md`](models/custom-character.md) | Characters: the pool section and the visual section are both stubs and only `Extra` has content | **stub** |
| [`models/custom-ancient.md`](models/custom-ancient.md) | The Ancient: the relic pool, generation, localization, and resources | complete |
| [`models/custom-encounter.md`](models/custom-encounter.md) | An encounter: which enemies a fight has and how the game arranges them | complete |
| [`models/custom-event.md`](models/custom-event.md) | An event: the condition that triggers it, the options, and the results | complete |
| [`models/custom-orbs.md`](models/custom-orbs.md) | Orbs: the icon and the sprite, the sound effect, the random pool, and the key points of `OrbModel` | complete |
| [`models/custom-temporary-power.md`](models/custom-temporary-power.md) | A temporary power, which is a buff that expires at the end of the turn, and its wrapper | complete |
| [`models/custom-singleton.md`](models/custom-singleton.md) | A singleton model: it receives the combat and run hooks, and it implements a mechanic or tracks state | complete (short) |
| [`models/custom-act.md`](models/custom-act.md) | An Act: one comment and one link to the source code | **stub** |
| [`scenes/creature-visuals.md`](scenes/creature-visuals.md) | Creature visuals: the table of the mandatory nodes, how a still image becomes a creature, and how Godot plays an animation automatically | **The Spine section is empty** |
| [`scenes/add-nodes.md`](scenes/add-nodes.md) | Add a node to a vanilla scene, as a variant of `AddedNode` or `SpireField` | complete |
| [`scenes/energy-counter.md`](scenes/energy-counter.md) | A custom energy counter: the scene requirements of `NEnergyCounter` | complete |
| [`scenes/merchant-character.md`](scenes/merchant-character.md) | The visuals of the merchant character (Spine) | complete (short) |
| [`scenes/index.md`](scenes/index.md) | The general rules for the scene tools, and why you need them | overview |
| [`localization/index.md`](localization/index.md) | The general rules for localization: `DefaultLoc.Set` sets the fallback language | overview |
| [`localization/code-loc.md`](localization/code-loc.md) | Strings that live in C#: `ILocalizationProvider`, the record types such as `CardLoc`, and a branch per language | complete |
| [`localization/simplified-loc.md`](localization/simplified-loc.md) | The simplified syntax: `!D!`, `*gold*`, `(plural)`, `-old-+new+`, and `[E?]` | complete |
| [`localization/var-loc.md`](localization/var-loc.md) | The tooltip text for a dynamic variable | complete |
| [`localization/display-var.md`](localization/display-var.md) | `DisplayVar`: put arbitrary processed text into a description | complete (short) |
| [`localization/ancient-dialogue.md`](localization/ancient-dialogue.md) | The dialogue text format of the Ancient | complete |
| [`utilities/config.md`](utilities/config.md) | The mod settings screen: it is declarative, and this page covers each control | complete |
| [`utilities/config-advanced.md`](utilities/config-advanced.md) | Advanced settings: manual read and write, buttons, conditional display, and collapsible groups | complete |
| [`utilities/custom-calc-vars.md`](utilities/custom-calc-vars.md) | Custom calculated variables: they avoid the vanilla limit that a variable has a fixed name and works on a card only | complete |
| [`utilities/enums.md`](utilities/enums.md) | Custom enums and keywords, static tooltips, and card piles | complete |
| [`utilities/pooling.md`](utilities/pooling.md) | `GeneratedNodePool`: put a node that code generates into the object pool | complete (short) |
| [`utilities/spirefield.md`](utilities/spirefield.md) | `SpireField`: add a field to an existing class. `SavedSpireField` also saves the value to disk | complete |
| [`utilities/mod-audio.md`](utilities/mod-audio.md) | The audio tools | complete (short) |
| [`utilities/mod-interop.md`](utilities/mod-interop.md) | Let another mod call the interface of this mod | complete |
| [`utilities/ancient-upgrades.md`](utilities/ancient-upgrades.md) | Ancient upgrades | complete (short) |
| [`utilities/index.md`](utilities/index.md) | Empty | **empty** |
| [`extras/index.md`](extras/index.md) | Empty | **empty** |

## Gap list (only decompilation covers these items)

These items are absent upstream or only half written. **Do not infer them from the wiki. Run `inspect_api action=source` instead.**

| Gap | Current state | Where to look |
|---|---|---|
| How to change the portrait of a card | `models/custom-card.md` covers the frame and the banner only. The `CardModel` section is a TODO | Decompile `MegaCrit.Sts2.Core.Models.CardModel` and find `PortraitPath` |
| How to replace a Spine creature animation | The `## Spine` section of `scenes/creature-visuals.md` is empty | Decompile `NCreatureVisuals` and the `.tscn` of a vanilla creature |
| Potions | **The wiki has no page for this** | Decompile `BaseLib.Abstracts.CustomPotionModel`. It holds the embedded patches `Image`, `LargeImagePatch`, and `OutlinePatch` |
| Custom characters | The pool section and the visual section of `models/custom-character.md` are both stubs | Decompile `BaseLib.Abstracts.CustomCharacterModel` |

## Source and update

- The commit and the BaseLib version of this snapshot are in [`SOURCE.md`](SOURCE.md).
- If upstream changes, get the pages again with `node scripts/sync-base-lib-wiki.mjs`. Add `--check` to compare only.
- **Do not edit a wiki page in this directory by hand.** To add a conclusion of ours, write it into `docs/game.md` or the matching SKILL.
