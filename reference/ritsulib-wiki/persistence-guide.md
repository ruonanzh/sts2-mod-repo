## Register Data

Register each saved concept as a class. Do it inside `BeginModDataRegistration` so initialization happens after the batch is complete.

```csharp
public sealed class MySettings
{
    public bool Enabled { get; set; } = true;
    public int Volume { get; set; } = 80;
}

using (RitsuLibFramework.BeginModDataRegistration("MyMod"))
{
    var store = RitsuLibFramework.GetDataStore("MyMod");
    store.Register(
        key: "settings",
        fileName: "settings.json",
        scope: SaveScope.Global,
        defaultFactory: () => new MySettings(),
        autoCreateIfMissing: true);
}
```

Use classes rather than primitive values so you can add fields later without changing the storage slot.


## Choose A Scope

| Scope | Use for |
| --- | --- |
| `SaveScope.Global` | Mod settings, account-wide preferences, caches shared by all game profiles. |
| `SaveScope.Profile` | Progression, unlock-like data, and anything tied to the current game profile. |
| `SaveScope.InMemory` | Temporary process-local data that should use the same store API but never writes to disk. |

Use `RitsuLibFramework.GetRunSavedDataStore(modId)` for data that belongs inside a run save. Run saved data is embedded into the run snapshot and follows the run through save/load and multiplayer synchronization.


## Cloud Sync

`SaveScope.Global` and `SaveScope.Profile` slots are eligible for RitsuLib mod-data cloud sync by default when the player enables Steam Cloud sync for mod data. For local-only persisted data, pass `syncToCloud: false`.

```csharp
store.Register(
    key: "local_cache",
    fileName: "local_cache.json",
    scope: SaveScope.Global,
    syncToCloud: false,
    defaultFactory: () => new LocalCache(),
    autoCreateIfMissing: true);
```

Use `SaveScope.InMemory` only for data that should not be written to disk at all.


## Run Saved Data

Use `RunSavedData` for values that are part of a specific run: challenge settings chosen in the start-run lobby, run counters, draft state, or per-player state that must survive save/load and multiplayer rejoin. Register slots early and keep their keys stable after release.

```csharp
using MegaCrit.Sts2.Core.Runs;
using MegaCrit.Sts2.Core.Multiplayer.Game.Lobby;
using STS2RitsuLib.RunData;

public sealed class ChallengeRunState
{
    public string? ChallengeId { get; set; }
    public int ElitesKilled { get; set; }
}

public sealed class PlayerRunState
{
    public string? LoadoutId { get; set; }
}

private static RunSavedData<ChallengeRunState> ChallengeData = null!;
private static PlayerRunSavedData<PlayerRunState> PlayerData = null!;

using (RitsuLibFramework.BeginModDataRegistration("MyMod"))
{
    var runStore = RitsuLibFramework.GetRunSavedDataStore("MyMod");

    ChallengeData = runStore.Register(
        key: "challenge",
        defaultFactory: () => new ChallengeRunState(),
        options: new RunSavedDataOptions
        {
            WritePolicy = RunSavedDataWritePolicy.WhenNonDefault,
            SyncLobbyOnChange = true,
        });

    PlayerData = runStore.RegisterPerPlayer(
        key: "player",
        defaultFactory: () => new PlayerRunState(),
        options: new RunSavedDataOptions
        {
            SyncLobbyOnChange = true,
        });
}
```

The registered handles are what you keep and use later. `RunSavedData<T>` stores one shared value for the run; `PlayerRunSavedData<T>` stores one value per player net id.

```csharp
public static void RecordEliteKilled(RunState runState)
{
    ChallengeData.Modify(runState, data =>
    {
        data.ElitesKilled++;
    });
}

public static string? GetPlayerLoadout(RunState runState, ulong netId)
{
    return PlayerData.TryGet(runState, netId, out var data)
        ? data.LoadoutId
        : null;
}
```

For values chosen before the run starts, write through the slot's `Lobby` accessor. Lobby values are committed into the run snapshot when the new run begins. If `SyncLobbyOnChange` is enabled, `Set` and `Modify` also push the local contribution in multiplayer.

```csharp
public static void SetLobbyChallenge(StartRunLobby lobby, string challengeId)
{
    ChallengeData.Lobby.Modify(lobby, data =>
    {
        data.ChallengeId = challengeId;
    });
}

public static void SetLocalLoadout(StartRunLobby lobby, string loadoutId)
{
    PlayerData.Lobby.Modify(lobby, lobby.NetService.NetId, data =>
    {
        data.LoadoutId = loadoutId;
    });
}
```

Use `RunSavedDataPreparingEvent` when data should be finalized just before a new run snapshot is exported.

```csharp
RitsuLibFramework.SubscribeLifecycle<RunSavedDataPreparingEvent>(evt =>
{
    ChallengeData.Modify(evt.RunState, data =>
    {
        data.ChallengeId ??= "standard";
    });
});
```

Keep the payload types as plain JSON-serializable classes with public properties. Prefer adding nullable or defaulted properties over changing a slot key.


## Read And Write

```csharp
var store = RitsuLibFramework.GetDataStore("MyMod");

var settings = store.Get<MySettings>("settings");

store.Modify<MySettings>("settings", data =>
{
    data.Volume = 60;
});

store.Save("settings");
```

`Get<T>` returns the live object. `Modify<T>` mutates that object. Saving is explicit unless another layer, such as a settings binding, calls `Save()` for you.


## Cached Access

Do not keep a `Get<T>` result as a long-lived profile cache. Profile reloads may replace the root object. Use `CreateCache<T>` when you want a reusable accessor that invalidates itself after profile changes or data reloads.

```csharp
private static ModDataStoreCache<MySettings> Settings =
    RitsuLibFramework.GetDataStore("MyMod").CreateCache<MySettings>("settings");

var settings = Settings.Value;
```


## Migrate Formats

Add migrations before publishing a breaking data shape.

```csharp
store.Register<MySettings>(
    "settings",
    "settings.json",
    SaveScope.Global,
    defaultFactory: () => new MySettings(),
    migrationConfig: new ModDataMigrationConfig(
        currentDataVersion: 2,
        minimumSupportedDataVersion: 1),
    migrations:
    [
        new SettingsV1ToV2Migration(),
    ]);
```

Keep `fileName` and `key` stable after release. Change the schema version when the JSON shape changes in a way old files cannot deserialize directly.


## Attached State

Use `AttachedState<TKey,TValue>` for runtime-only state attached to reference objects. Use `SavedAttachedState<TKey,TValue>` only for model objects that already pass through the game's `SavedProperties` serialization.

```csharp
private static readonly SavedAttachedState<CardModel, int> BonusDamage =
    new("bonus_damage", () => 0);

BonusDamage[card] = 3;
```

For normal mod settings, progression, and feature data, prefer `ModDataStore`.
