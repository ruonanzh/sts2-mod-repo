## Choose A Registration Style

RitsuLib offers two normal registration styles. Treat them as peers:

| Style | Best fit |
| --- | --- |
| CLR attributes | Content classes owned by your mod. The registration sits next to the model class. |
| Content pack | Generated content, conditional setup, placeholders, or a reviewable list in one initializer. |

Attribute registration requires the mod assembly to be registered once:

```csharp
ModTypeDiscoveryHub.RegisterModAssembly("MyMod", Assembly.GetExecutingAssembly());
```

On STS2 versions that expose game-side assembly association, this also associates the assembly with your mod for the
game's own content classification.

If the annotated class lives in a helper assembly that the game does not map to your manifest id, add
`[RitsuLibOwnedBy("MyMod")]` to the class or register that assembly with `ModTypeDiscoveryHub.RegisterModAssembly(...)`.


## Attribute Registration

Put the attribute on the concrete model type. Abstract classes are skipped.

```csharp
[RegisterCard(typeof(MyCardPool))]
public sealed class MyStrike
    : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
}

[RegisterRelic(typeof(MyRelicPool))]
public sealed class MyStarterRelic : ModRelicTemplate
{
}

[RegisterCharacter]
public sealed class MyCharacter
    : ModCharacterTemplate<MyCardPool, MyRelicPool, MyPotionPool>
{
}
```

Pool-backed model attributes support stable entry overrides:

```csharp
[RegisterCard(typeof(MyCardPool), StableEntryStem = "my_strike")]
public sealed class RenamedStrike : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
}
```

Use `FullPublicEntry` only for compatibility with an already published full entry. Do not set `StableEntryStem` and
`FullPublicEntry` together.

Common content attributes:

| Attribute | Registers |
| --- | --- |
| `RegisterCard(typeof(pool))` | Card in a card pool |
| `RegisterRelic(typeof(pool))` | Relic in a relic pool |
| `RegisterPotion(typeof(pool))` | Potion in a potion pool |
| `RegisterCharacter` | Character model |
| `RegisterPower`, `RegisterOrb` | Combat models |
| `RegisterAct`, `RegisterMonster`, `RegisterGlobalEncounter` | Act, monster, global encounter |
| `RegisterActEncounter(typeof(act))` | Encounter for an act |
| `RegisterSharedEvent`, `RegisterActEvent(typeof(act))` | Event content |
| `RegisterSharedAncient`, `RegisterActAncient(typeof(act))` | Ancient event content |
| `RegisterTrashHeapCard`, `RegisterTrashHeapRelic` | Trash Heap event candidates |
| `RegisterAchievement`, `RegisterEnchantment`, `RegisterAffliction` | Metadata or card-state models |
| `RegisterGoodModifier`, `RegisterBadModifier` | Daily modifiers |
| `RegisterSharedCardPool`, `RegisterSharedRelicPool`, `RegisterSharedPotionPool` | Shared pools |

Every auto-registration attribute has `Order`. Lower values run earlier within the same phase. For starter cards, relics,
and potions, the same `Order` is also stored on the starter entry; starter lists are resolved by `Order`, then by
registration order.

Starter example:

```csharp
[RegisterCard(typeof(MyCardPool))]
[RegisterCharacterStarterCard(typeof(MyCharacter), 4, Order = 10)]
public sealed class MyStrike : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
}
```

Use abstract base class attributes only with `Inherit = true`. The base class itself is not registered; each concrete
derived type receives the inherited registration unless a nearer type declares the same logical registration slot.
A concrete `RegisterCard` therefore replaces the inherited card-pool registration even when it selects another pool.
The same nearest-declaration rule applies to configurable slots such as starter counts, node attachments, timeline
placement, and unlock thresholds. Distinct targets remain additive.

```csharp
[RegisterCard(typeof(MyCardPool), Inherit = true)]
public abstract class MySkillCardBase
    : ModCardTemplate(1, CardType.Skill, CardRarity.Common, TargetType.Self)
{
}

public sealed class MyBlock : MySkillCardBase
{
}
```

To move one derived card to another pool, declare the replacement directly:

```csharp
[RegisterCard(typeof(MyOtherCardPool))]
public sealed class MyOtherBlock : MySkillCardBase
{
}
```

`MyOtherBlock` is registered only in `MyOtherCardPool`, not in both pools. Declaring the same logical slot more than once
on one class is an error.

Do not put `StableEntryStem` or `FullPublicEntry` on an inherited base attribute unless every derived type is intended to
share the same public entry. That is almost always wrong. Put stable entry overrides on the concrete class instead.


## Content Packs

Use a content pack when a batch is more readable than scattered attributes.

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .Card<MyCardPool, MyStrike>()
    .Relic<MyRelicPool, MyStarterRelic>()
    .Potion<MyPotionPool, MyPotion>()
    .Power<MyPower>()
    .ActEvent<MyAct, MyEvent>()
    .CardKeywordOwnedByLocNamespace("bleeding")
    .Apply();
```

Important pack methods:

| Area | Methods |
| --- | --- |
| Pool content | `.Card<TPool,TCard>()`, `.Relic<TPool,TRelic>()`, `.Potion<TPool,TPotion>()` |
| Stable entries | overloads taking `ModelPublicEntryOptions.FromStem(...)` or `FromFullPublicEntry(...)` |
| Placeholders | `.PlaceholderCard<TPool>(stem)`, `.PlaceholderRelic<TPool>(stem)`, `.PlaceholderPotion<TPool>(stem)` |
| Characters | `.Character<T>()`, `.Character<T>(entry => ...)`, `.CharacterStarterCard<TCharacter,TCard>()`, starter relic / potion helpers |
| World content | `.Act<T>()`, `.Monster<T>()`, `.ActEncounter<TAct,TEncounter>()`, `.SharedEvent<T>()`, `.ActEvent<TAct,TEvent>()` |
| Ancients | `.SharedAncient<T>()`, `.ActAncient<TAct,TAncient>()`, `.AncientOption<TAncient>(rule)` |
| Event candidates | `.TrashHeapCard<T>()`, `.TrashHeapRelic<T>()` |
| Keywords and ids | `.CardKeywordOwnedByLocNamespace(...)`, `.KeywordOwned(...)`, `.CardTagOwned(...)` |
| UI | `.CardPileOwned(...)`, `.TopBarButtonOwned(...)` |
| Timeline and unlocks | `.Story<T>()`, `.Epoch<T>()`, `.StoryEpoch<TStory,TEpoch>()`, `.RequireEpoch<TModel,TEpoch>()`, unlock helpers |
| Batch input | `.ContentManifest(...)`, `.KeywordManifest(...)`, `.PackManifest(...)`, `.Manifest(...)` |
| Custom logic | `.Custom(ctx => ...)` |

Do not register the same model through attributes and a content pack unless you intentionally want idempotent duplicate
handling. Pick one source of truth for each content family.


## Model Templates

Templates are optional base classes that provide RitsuLib conventions and hooks:

| Model | Template |
| --- | --- |
| Card | `ModCardTemplate` |
| Relic | `ModRelicTemplate` |
| Potion | `ModPotionTemplate` |
| Power | `ModPowerTemplate` |
| Character | `ModCharacterTemplate<TCardPool, TRelicPool, TPotionPool>` |
| Event | `ModEventTemplate` |
| Ancient event | `ModAncientEventTemplate` |
| Encounter / monster / act | `ModEncounterTemplate`, `ModMonsterTemplate`, `ModActTemplate` |
| Story / epoch | `ModStoryTemplate`, `ModEpochTemplate` |

Most display text still belongs in localization JSON. Do not add fake `Title` or `Description` overrides to models whose
base game class already reads `LocString` from its table.


## Card Type Text

The API mirrors BaseLib's type-text contracts and composition behavior. Implement `ICustomTypeTextCard` on a card when
it modifies its own type plaque:

```csharp
IEnumerable<LocString> ICustomTypeTextCard.GetTypeModifiers()
{
    return
    [
        new LocString("my_mod_ui", "card_type.cursed"),
    ];
}
```

Implement `ICardTypeTextModifier.GetTypeModifiers(CardModel)` on a card capability, relic, power, or other model-owned
effect. RitsuLib discovers model and capability implementations through the normal run/combat hook-listener order.
Only genuinely process-wide effects should use `RitsuLibFramework.RegisterCardTypeTextModifier(...)`.

Composition is intentionally identical to BaseLib:

- A localized string containing `{Type}` wraps the selected base text.
- A localized string without `{Type}` replaces the base text; the last replacement wins.
- All replacements are selected before wrappers are applied. Wrappers retain their original source order.

For example, `"Cursed {Type}"` turns `Attack` into `Cursed Attack`. When BaseLib is installed, its modifiers compose
first, RitsuLib modifiers compose second, and the resulting `LocString` is formatted only once.


## Entry Ids

RitsuLib-owned pool content gets a fixed public entry:

```text
<MODID>_<CATEGORY>_<TYPENAME>
```

`MyMod` + card + `MyStrike` becomes:

```text
MY_MOD_CARD_MY_STRIKE
```

The entry is used by saves, model ids, localization keys, asset defaults, unlock rules, and cross-mod references. Treat it
as stable after release.

Use `StableEntryStem` / `ModelPublicEntryOptions.FromStem(...)` when a type was renamed but the published entry must stay
the same:

```csharp
[RegisterCard(typeof(MyCardPool), StableEntryStem = "my_strike")]
public sealed class RenamedStrike : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
}
```

Avoid all-uppercase CLR type names such as `TESTCARD`. Vanilla entry parsing can split those names incorrectly; in current
0.105.x behavior, `TESTCARD` can become `T_ES_TC_AR_D`. Prefer `TestCard`, and prefer `UrlParser` over `URLParser`.
