## Character Template

Use `ModCharacterTemplate<TCardPool, TRelicPool, TPotionPool>` when your character owns its own card, relic, and potion pools.

```csharp
public sealed class MyCharacter
    : ModCharacterTemplate<MyCardPool, MyRelicPool, MyPotionPool>
{
    public override CharacterAssetProfile AssetProfile => new()
    {
        Ui = new() { CharacterSelectIconPath = "res://MyMod/images/character/icon.png" }
    };

    public override bool RequiresEpochAndTimeline => true;
}
```

Write the character name and pronouns in `characters.json`. Register the character and its starter content with
attributes:

```csharp
[RegisterCharacter]
public sealed class MyCharacter
    : ModCharacterTemplate<MyCardPool, MyRelicPool, MyPotionPool>
{
}

[RegisterCard(typeof(MyCardPool))]
[RegisterCharacterStarterCard(typeof(MyCharacter), 4, Order = 10)]
public sealed class MyStrike : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
}

[RegisterRelic(typeof(MyRelicPool))]
[RegisterCharacterStarterRelic(typeof(MyCharacter), Order = 0)]
public sealed class MyStarterRelic : ModRelicTemplate
{
}
```

Use a content pack when the starter list is easier to review in one place:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .Character<MyCharacter>(c => c
        .AddStartingRelic<MyStarterRelic>(1, order: 0)
        .AddStartingCard<MyStrike>(4, order: 10)
        .AddStartingCard<MyDefend>(4, order: 20))
    .Card<MyCardPool, MyStrike>()
    .Card<MyCardPool, MyDefend>()
    .Relic<MyRelicPool, MyStarterRelic>()
    .Apply();
```

Prefer additive starter registration over overriding legacy `StartingDeckTypes`, `StartingRelicTypes`, or `StartingPotionTypes`.

`Order` controls starter content ordering inside each starter list. Lower values appear earlier; entries with the same
order keep registration order. `count` adds multiple copies at the same ordered position, which is what you want for
starter cards such as four strikes or four defends. Use the same rule for starter relics and starter potions.


## Visibility And Vanilla Progression

Override these properties when the character should not behave like a built-in character:

| Property | Use |
| --- | --- |
| `RequiresEpochAndTimeline` | Set `false` for characters that do not participate in vanilla epoch / timeline assumptions. |
| `HideFromVanillaCharacterSelect` | Hide from the vanilla character-select list. |
| `AllowInVanillaRandomCharacterSelect` | Control random character selection. |
| `HideInCardLibraryCompendium` | Hide the character card-pool filter in the compendium. |
| `CardLibraryCompendiumPlacementRules` | Place the character pool near another pool or in a custom order. |

If a character is meant to be playable from the normal UI, keep `RequiresEpochAndTimeline` true and register proper story / epoch entries.


## Unlock Rules

Create epoch models for content gates, then register rules through the content pack.

```csharp
public sealed class MyFirstEpoch : ModEpochTemplate
{
    public override string Id => "MY_MOD_FIRST_EPOCH";
}

RitsuLibFramework.CreateContentPack("MyMod")
    .Epoch<MyFirstEpoch>()
    .RequireEpoch<MyRareCard, MyFirstEpoch>()
    .UnlockEpochAfterWinAs<MyCharacter, MyFirstEpoch>()
    .Apply();
```

Common rule helpers:

| Rule | Meaning |
| --- | --- |
| `.RequireEpoch<TModel, TEpoch>()` | Hide a model until the epoch is obtained. |
| `.UnlockEpochAfterRunAs<TCharacter, TEpoch>()` | Grant after any run with that character. |
| `.UnlockEpochAfterWinAs<TCharacter, TEpoch>()` | Grant after a win. |
| `.UnlockEpochAfterAscensionWin<TCharacter, TEpoch>(level)` | Grant after an ascension win at or above the level. |
| `.UnlockEpochAfterRunCount<TEpoch>(count, requireVictory)` | Grant after global run count. |
| `.UnlockEpochAfterEliteVictories<TCharacter, TEpoch>(count)` | Grant after counted elite wins. |
| `.UnlockEpochAfterBossVictories<TCharacter, TEpoch>(count)` | Grant after counted boss wins. |


## Related Pages

- [Timeline and unlocks](timeline-and-unlocks.md)
- [Asset profiles and fallbacks](asset-profiles-and-fallbacks.md)
- [Creature visuals and animation](creature-visuals-and-animation.md)
