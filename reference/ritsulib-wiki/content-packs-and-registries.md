## Builder Surface

`CreateContentPack(modId)` returns a chainable builder. Call `Apply()` once after adding every step.

| Category | Builder methods |
| --- | --- |
| Core models | `.Card<TPool,TCard>()`, `.Relic<TPool,TRelic>()`, `.Potion<TPool,TPotion>()`, `.Power<TPower>()`, `.Orb<TOrb>()` |
| Characters | `.Character<TCharacter>()`, `.Character<TCharacter>(entry => ...)`, starter card / relic / potion helpers |
| World content | `.Act<TAct>()`, `.Monster<TMonster>()`, `.ActEncounter<TAct,TEncounter>()`, `.GlobalEncounter<TEncounter>()`, `.SharedEvent<TEvent>()`, `.ActEvent<TAct,TEvent>()`, `.SharedAncient<TAncient>()`, `.ActAncient<TAct,TAncient>()` |
| Metadata | `.Achievement<T>()`, `.Enchantment<T>()`, `.Affliction<T>()`, `.Badge<T>()`, `.Singleton<T>()`, modifiers |
| Text and ids | `.CardKeywordOwnedByLocNamespace(...)`, `.KeywordOwned(...)`, `.CardTagOwned(...)` |
| UI and piles | `.CardPileOwned(...)`, `.TopBarButtonOwned(...)` |
| Timeline | `.Story<T>()`, `.Epoch<T>()`, `.StoryEpoch<TStory,TEpoch>()`, timeline slot helpers |
| Unlocks | `.RequireEpoch<TModel,TEpoch>()`, `.UnlockEpochAfterWinAs<TCharacter,TEpoch>()`, and related count / boss / elite helpers |
| Batch input | `.ContentManifest(...)`, `.KeywordManifest(...)`, `.PackManifest(...)`, `.Manifest(...)` |
| Escape hatch | `.Custom(ctx => ...)` |

The builder applies steps in the order you added them. Keep model registration before unlock rules that reference those models.


## Attribute Surface

Use attributes when the registration belongs next to the model type. Register the assembly first with
`ModTypeDiscoveryHub.RegisterModAssembly(modId, assembly)`.

| Category | Attributes |
| --- | --- |
| Pool content | `RegisterCard`, `RegisterRelic`, `RegisterPotion` |
| Standalone models | `RegisterCharacter`, `RegisterPower`, `RegisterOrb`, `RegisterAchievement`, `RegisterSingleton` |
| World content | `RegisterAct`, `RegisterMonster`, `RegisterGlobalEncounter`, `RegisterActEncounter` |
| Events | `RegisterSharedEvent`, `RegisterActEvent`, `RegisterSharedAncient`, `RegisterActAncient`, `RegisterTrashHeapCard`, `RegisterTrashHeapRelic` |
| Pools | `RegisterSharedCardPool`, `RegisterSharedRelicPool`, `RegisterSharedPotionPool` |
| Keywords and ids | `RegisterOwnedKeyword`, `RegisterOwnedCardKeyword`, `RegisterOwnedCardTag` |
| Timeline | `RegisterStory`, `RegisterEpoch`, `RegisterStoryEpoch`, `AutoTimelineSlot*` |
| Unlocks | `RequireEpoch`, `RequireAllCardsInPool`, `RegisterEpochCards`, `RegisterEpochRelicsFromPool`, `UnlockEpochAfter*` |
| UI | `RegisterOwnedCardPile`, `RegisterOwnedTopBarButton` |
| Special mappings | `RegisterArchaicToothTranscendence`, `RegisterTouchOfOrobasRefinement` |

Attributes also support `Order`, and pool-backed model attributes support `StableEntryStem` / `FullPublicEntry`.
`RegisterCharacterStarterCard`, `RegisterCharacterStarterRelic`, and `RegisterCharacterStarterPotion` use `Order` for the
final starter list order as well as operation ordering.

When an attribute is placed on an abstract base class, it is inherited only if `Inherit = true` is set. Inheritance is
resolved by logical registration slot, with the nearest declaration winning. For example, a direct `RegisterCard` on a
concrete card replaces an inherited `RegisterCard` even when it names a different pool; the card is not added to both
pools. Configuration-only changes likewise replace inherited starter counts, node-attachment paths, timeline placement,
and unlock thresholds. Registrations with distinct target ids or scopes remain additive, such as `RequireEpoch` entries
for different epochs. Declaring the same logical slot more than once on one class is an error.


## Direct Registries

Every builder method maps to a registry call. Direct registries are useful for shared helper libraries and conditional setup.

```csharp
var content = RitsuLibFramework.GetContentRegistry("MyMod");
content.RegisterCard<MyCardPool, MyStrike>();

var keywords = RitsuLibFramework.GetKeywordRegistry("MyMod");
keywords.RegisterCardKeywordOwnedByLocNamespace("bleeding");
```

| Registry | Access |
| --- | --- |
| Content | `RitsuLibFramework.GetContentRegistry(modId)` |
| Keywords | `RitsuLibFramework.GetKeywordRegistry(modId)` |
| Timeline | `RitsuLibFramework.GetTimelineRegistry(modId)` |
| Unlocks | `RitsuLibFramework.GetUnlockRegistry(modId)` |
| Card tags | `RitsuLibFramework.GetCardTagRegistry(modId)` |
| Card piles | `RitsuLibFramework.GetCardPileRegistry(modId)` |
| Top-bar buttons | `RitsuLibFramework.GetTopBarButtonRegistry(modId)` |
| SmartFormat | `RitsuLibFramework.GetSmartFormatRegistry(modId)` |


## Manifests

Manifest arrays are useful when content is generated or split across files.

```csharp
IContentRegistrationEntry[] content =
[
    new CardRegistrationEntry<MyCardPool, MyStrike>(),
    new RelicRegistrationEntry<MyRelicPool, MyRelic>(),
];

RitsuLibFramework.CreateContentPack("MyMod")
    .ContentManifest(content)
    .KeywordManifest(keywordEntries)
    .PackManifest(timelineAndUnlockEntries)
    .Apply();
```

Use separate manifest methods when possible. It keeps ModelDb content, keyword ids, and timeline / unlock rules easy to review.


## Registration Timing

Run content registration from your mod initializer. RitsuLib freezes content registration before the game finishes model initialization. After the freeze, adding models is invalid.

Subscribe to `ContentRegistrationClosedEvent` only for diagnostics. Do not wait for it to register content.
