## Pick The Smallest Hook

Choose the lightest visual hook that matches the job:

| Need | Use |
| --- | --- |
| Swap a packaged visuals scene | `CharacterAssetProfile.Scenes.VisualsPath` or `MonsterAssetProfile.VisualsScenePath` |
| Use static frame cues | `VisualCueSet` on `CharacterAssetProfile` |
| Build the node tree in code | Override `TryCreateCreatureVisuals()` |
| Drive combat animations yourself | Override `SetupCustomCombatAnimationStateMachine(...)` |
| Drive merchant / rest-site visuals | Override `SetupCustomMerchantAnimationStateMachine(...)`, `SetupCustomRestSiteAnimationStateMachine(...)`, or use `WorldProceduralVisuals` |

Start with paths and profiles. Move to factories only when static resources cannot express the behavior.


## Visual Cues

`VisualCueSet` is useful for non-Spine characters that can be described by named stills or frame sequences.

```csharp
public override CharacterAssetProfile AssetProfile => new()
{
    VisualCues = new VisualCueSet(
        texturePathByCue: new Dictionary<string, string>
        {
            ["idle"] = "res://MyMod/images/character/idle.png",
            ["hit"] = "res://MyMod/images/character/hit.png",
        })
};
```

For a still frame that should hold briefly and then let the state machine return to idle, use the builder:

```csharp
public override CharacterAssetProfile AssetProfile => new()
{
    VisualCues = VisualCueSetBuilder.Create()
        .Single("idle", "res://MyMod/images/character/idle.png")
        .Single("attack", "res://MyMod/images/character/attack.png", 0.5f)
        .Build()
};
```

Keep cue names aligned with the animation states your model or state machine will request.


## State Machines

Use `ModAnimStateMachines` or `ModAnimStateMachineBuilder` when you need explicit animation state transitions.

```csharp
protected override ModAnimStateMachine? SetupCustomCombatAnimationStateMachine(
    Node visualsRoot,
    CharacterModel character)
{
    return ModAnimStateMachines.Standard(
        CompositeBackendFactory.FromNode(visualsRoot));
}
```

Return `null` when the normal vanilla animation path should run.

Merchant and rest-site state machines receive the same trigger names as combat (`Idle`, `Dead`, `Hit`, `Attack`,
`Cast`, `Relaxed`, `Revive`). World animation names such as `relaxed_loop`, `die`, `overgrowth_loop`, `hive_loop`,
and `glory_loop` are normalized before they reach the state machine. Use `ModAnimStateMachines.StandardMerchantCue`
or `ModAnimStateMachines.StandardRestSiteCue` when your world visuals are backed by `WorldProceduralVisuals` cue sets.


## Practical Notes

- Keep visual resources in the mod PCK and reference them with `res://`.
- Register Godot scripts before any scene is instantiated.
- Use one visible fallback pose for every non-Spine creature.
- Test death, hit, attack, cast, idle, and relaxed states before release.
- For merchant and rest-site visuals, verify both normal UI entry and reload-from-save paths.
