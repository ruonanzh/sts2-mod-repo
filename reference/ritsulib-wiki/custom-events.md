## Event Models

Use `ModEventTemplate` for normal events and `ModAncientEventTemplate` for ancient events.

```csharp
public sealed class MyEvent : ModEventTemplate
{
    public override EventAssetProfile AssetProfile => new()
    {
        LayoutScenePath = "res://MyMod/scenes/events/quiet_door.tscn",
        BackgroundScenePath = "res://MyMod/scenes/events/quiet_door_bg.tscn",
    };
}
```

Register the event globally or under a specific act. Attribute style:

```csharp
[RegisterActEvent(typeof(MyAct))]
public sealed class MyEvent : ModEventTemplate
{
}

[RegisterSharedAncient]
public sealed class MyAncient : ModAncientEventTemplate
{
}
```

Content pack style:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .ActEvent<MyAct, MyEvent>()
    .SharedEvent<MySharedEvent>()
    .ActAncient<MyAct, MyAncient>()
    .Apply();
```


## Option Keys

Templates provide namespaced option keys:

```csharp
protected override IReadOnlyList<EventOption> GenerateInitialOptions()
{
    return
    [
        new EventOption(this, OpenDoor, InitialOptionKey("OPEN"))
    ];
}
```

For custom pages, call `ModOptionKey(pageName, optionName)`. Keep page and option names stable after release, because they are part of the localization contract.


## Relic Options

Use the template helper for options that grant a relic:

```csharp
yield return CreateModRelicOption<MyRelic>(
    onChosen: async () => await GoToPage("REWARD_TAKEN"));
```

For ancient events, `CreateModRelicOption<T>()` also completes the ancient flow by default.


## Add Options To Existing Ancients

Use `AncientOption<TAncient>(rule)` when you want to append options to an existing ancient without replacing the event class.

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .AncientOption<TheArchitect>(ModAncientOptionRule.Single(ancient =>
        new EventOption("MY_MOD_ARCHITECT_OPTION", async () => await DoSomething())))
    .Apply();
```

Use `Condition`, `Priority`, and `SkipDuplicateTextKeys` on `ModAncientOptionRule` when multiple mods can add similar options.


## Extend The Trash Heap Candidate Pools

After registering a card or relic as ModelDb content, add it to the corresponding Trash Heap option with the content-pack builder:

```csharp
[RegisterCard(typeof(MyCardPool))]
[RegisterTrashHeapCard]
public sealed class MyTrashHeapCard : ModCardTemplate
{
}

[RegisterRelic(typeof(MyRelicPool))]
[RegisterTrashHeapRelic]
public sealed class MyTrashHeapRelic : ModRelicTemplate
{
}
```

Or use the content-pack builder:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .TrashHeapCard<MyTrashHeapCard>()
    .TrashHeapRelic<MyTrashHeapRelic>()
    .Apply();
```

Registered cards are appended to the `Grab` candidate pool, and registered relics are appended to the `Dive In` candidate pool. The event chooses uniformly from the combined vanilla and registered candidates. RitsuLib removes duplicate model ids but does not apply rarity or unlock filters.

For direct registration, use `RitsuLibFramework.RegisterTrashHeapCard<T>(modId)`, `RegisterTrashHeapRelic<T>(modId)`, or the matching methods on `ModContentRegistry`.


## Ancient Dialogue

`ModAncientEventTemplate` loads dialogue from the `ancients` localization table by default. Override `DefineDialogues()` only when the dialogue structure cannot be expressed with localization data.

For normal mod ancient dialogue, write keys like:

```json
{
  "MY_MOD_ANCIENT_MIRROR.talk.MY_MOD_CHARACTER_SEER.0-0.ancient": "You brought a future with you.",
  "MY_MOD_ANCIENT_MIRROR.talk.MY_MOD_CHARACTER_SEER.0-1.char": "Then I should spend it carefully."
}
```

For The Architect, add character-specific keys under `THE_ARCHITECT.talk.<CHARACTER_ENTRY>.*`.
See [Localization and keywords](/guide/localization-and-keywords#ancient-dialogue) for the full key shape.
