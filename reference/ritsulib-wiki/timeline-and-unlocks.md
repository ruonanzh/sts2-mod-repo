## Add Story And Epoch Models

Use `ModStoryTemplate` and `ModEpochTemplate` when the mod adds progression nodes.

```csharp
public sealed class MyStory : ModStoryTemplate
{
    protected override string StoryKey => "my_mod_story";
}

public sealed class MyEpoch : ModEpochTemplate
{
    public override string Id => "MY_MOD_FIRST_LESSON";
}
```

Write title, description, unlock text, and story title in `epochs.json`. Register them with attributes:

```csharp
[RegisterStory]
public sealed class MyStory : ModStoryTemplate
{
    protected override string StoryKey => "my_mod_story";
}

[RegisterEpoch]
[RegisterStoryEpoch(typeof(MyStory))]
[AutoTimelineSlotAfterColumn(EpochEra.Act1)]
public sealed class MyEpoch : ModEpochTemplate
{
    public override string Id => "MY_MOD_FIRST_LESSON";
}
```

Or register them with a content pack:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .Story<MyStory>()
    .Epoch<MyEpoch>()
    .StoryEpoch<MyStory, MyEpoch>()
    .ModEpochAutoTimelineSlotAfterColumn<MyEpoch>(EpochEra.Act1)
    .Apply();
```


## Gate Content

Use `.RequireEpoch<TModel, TEpoch>()` for content that should stay hidden until an epoch is obtained.

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .Card<MyCardPool, MyRareCard>()
    .Epoch<MyEpoch>()
    .RequireEpoch<MyRareCard, MyEpoch>()
    .Apply();
```

For epoch templates that list their own cards or relics, use `.BindCardUnlockEpoch<TEpoch>()` or `.BindRelicUnlockEpoch<TEpoch>()`.


## Unlock Epochs

Choose the rule that matches the player action:

| Rule | Trigger |
| --- | --- |
| `.UnlockEpochAfterRunAs<TCharacter, TEpoch>()` | A run finishes with the character. |
| `.UnlockEpochAfterWinAs<TCharacter, TEpoch>()` | A run is won with the character. |
| `.UnlockEpochAfterAscensionWin<TCharacter, TEpoch>(level)` | A qualifying ascension win. |
| `.UnlockEpochAfterRunCount<TEpoch>(count, requireVictory)` | Account-level run count. |
| `.UnlockEpochAfterEliteVictories<TCharacter, TEpoch>(count)` | Counted elite victories. |
| `.UnlockEpochAfterBossVictories<TCharacter, TEpoch>(count)` | Counted boss victories. |
| `.UnlockEpochAfterAscensionOneWin<TCharacter, TEpoch>()` | First ascension path. |
| `.RevealAscensionAfterEpoch<TCharacter, TEpoch>()` | Ascension UI reveal after an epoch. |

Keep unlock rules close to the content they gate. That makes release review much easier.


## Character Unlocks

To unlock a character from a previous character's run path, use:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .Character<MyCharacter>()
    .Epoch<MyCharacterEpoch>()
    .UnlockCharacterAfterRunAs<MyPreviousCharacter, MyCharacterEpoch>()
    .Apply();
```

Align the character's own `RequiresEpochAndTimeline` setting with the rules you register.
