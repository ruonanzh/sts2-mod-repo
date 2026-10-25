## Subscribe

Use lifecycle events when a mod needs game timing but does not need to own a Harmony patch.

```csharp
var subscription = RitsuLibFramework.SubscribeLifecycle<GameReadyEvent>(evt =>
{
    Logger.Info($"Game ready: {evt.Game.Name}");
});
```

Dispose the returned subscription when the handler is temporary.

```csharp
RitsuLibFramework.SubscribeLifecycle<CombatStartingEvent>((evt, sub) =>
{
    PrepareForCombat(evt.RunState);
    sub.Dispose();
});
```

Replayable events are delivered immediately to late subscribers by default. Pass `replayCurrentState: false` when you only want future events.


## Common Events

| Timing | Events |
| --- | --- |
| Framework boot | `FrameworkInitializingEvent`, `FrameworkInitializedEvent` |
| Model setup | `ContentRegistrationClosedEvent`, `ModelRegistryInitializedEvent`, `ModelIdsInitializedEvent`, `ModelPreloadingCompletedEvent` |
| Game node | `GameTreeEnteredEvent`, `GameReadyEvent` |
| Profiles and saves | `ProfileIdInitializedEvent`, `ProfileSwitchingEvent`, `ProfileSwitchedEvent`, `RunSavingEvent`, `RunSavedEvent`, `ProgressSavingEvent`, `ProgressSavedEvent`, `ProfileDeletingEvent`, `ProfileDeletedEvent` |
| Run flow | `RunStartedEvent`, `RunLoadedEvent`, `RunEndedEvent`, `RoomEnteringEvent`, `RoomEnteredEvent`, `RoomExitedEvent`, `ActEnteringEvent`, `ActEnteredEvent` |
| Combat | `CombatStartingEvent`, `CombatEndedEvent`, `CombatVictoryEvent`, `SideTurnStartingEvent`, `SideTurnStartedEvent`, `CardPlayingEvent`, `CardPlayedEvent` |
| Combat resources | `EnergyGainedEvent`, `EnergyResetEvent`, `EnergySpentEvent`, `StarsGainedEvent`, `StarsSpentEvent` |
| Cards | `CardMovedBetweenPilesEvent`, `CardDrawnEvent`, `CardDiscardedEvent`, `CardExhaustedEvent`, `BeforeFlushEvent`, `CardsFlushedEvent` |
| Rewards and inventory | `GoldGainedEvent`, `GoldLostEvent`, `PotionProcuredEvent`, `PotionDiscardedEvent`, `RelicObtainedEvent`, `RelicRemovedEvent`, `RewardTakenEvent` |
| Unlocks | `EpochObtainedEvent`, `EpochRevealedEvent`, `UnlockIncrementedEvent` |


## Version Notes

`CardRetainedEvent` is obsolete on newer host APIs. Use `CardsFlushedEvent` when you need retained and flushed cards together.

For game API differences that affect event availability, check [Diagnostics and compatibility](diagnostics-and-compatibility.md).
