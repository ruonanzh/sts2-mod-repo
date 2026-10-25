## Core Terms

| Term | Meaning |
| --- | --- |
| Mod id | The manifest id of the owning mod, for example `MyMod`. It is used when RitsuLib builds stable ids. |
| Model | A game `AbstractModel` subtype: card, relic, potion, character, event, act, power, orb, and similar content. |
| Pool | A game pool model such as `CardPoolModel`, `RelicPoolModel`, or `PotionPoolModel`. Register cards, relics, and potions into a pool. |
| Content pack | A fluent batch created by `RitsuLibFramework.CreateContentPack(modId)`. It is the preferred registration entry point. |
| Registry | A per-mod API surface such as `ModContentRegistry`, `ModKeywordRegistry`, or `ModUnlockRegistry`. Use registries directly only when the builder does not fit. |
| Public entry | The stable `ModelId.Entry` string generated for RitsuLib-owned models. It is also the stem for most model localization keys. |
| Owned id | An id qualified with the mod id, for example `MY_MOD_KEYWORD_BURNING`. Prefer owned ids over flat global ids. |
| Lifecycle event | A typed event published through `RitsuLibFramework.SubscribeLifecycle<TEvent>(...)`. |
| Replayable event | A lifecycle event sent immediately to late subscribers when the event has already happened. |
| Scope | Persistence location: `Global`, `Profile`, or `InMemory`. Run-scoped save data uses `RunSavedData`. |


## Naming Rules

RitsuLib normalizes public stems to uppercase snake case. Non-alphanumeric separators collapse to `_`, and camel-case names are split.

| Input | Normalized |
| --- | --- |
| `MyMod` | `MY_MOD` |
| `com.example.my-mod` | `COM_EXAMPLE_MY_MOD` |
| `StarterRelic` | `STARTER_RELIC` |

Use readable PascalCase for CLR model type names. Avoid all-uppercase names such as `TESTCARD`: the vanilla game regex can
split that name as `T_ES_TC_AR_D` in paths that do not use RitsuLib's fixed-entry override. Prefer `TestCard`, and prefer
`UrlParser` over `URLParser` when an acronym is part of the name.

Default model entry:

```text
<MODID>_<CATEGORY>_<TYPENAME>
```

Owned keyword, card tag, card pile, and top-bar button ids use the same pattern with a fixed middle segment such as `KEYWORD`, `CARDTAG`, `CARDPILE`, or `TOPBARBUTTON`.
