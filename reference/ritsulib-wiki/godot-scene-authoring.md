## Register C# Scripts

If your mod ships `.tscn` scenes with C# scripts, call this once from the mod initializer:

```csharp
RitsuLibFramework.EnsureGodotScriptsRegistered(
    Assembly.GetExecutingAssembly(),
    Logger);
```

Without this, Godot can load the scene file but fail to resolve the attached C# script type.


## Load Scenes From Profiles

For content visuals, prefer the model's asset profile over manual scene loading:

```csharp
public override EventAssetProfile AssetProfile => new()
{
    LayoutScenePath = "res://MyMod/scenes/events/my_event.tscn"
};
```

Use code-created scenes only when the scene must depend on runtime state or when you are intentionally avoiding a `.tscn` file.


## Scene Path Checklist

- Use `res://` paths that exist in the packaged mod.
- Keep script classes `public` and in the compiled mod assembly.
- Avoid editor-only resource paths.
- If a scene is used by a model profile, register the model early through the content pack.
- For scenes that instantiate custom nodes, register all script assemblies before any model or UI asks for the scene.


## When To Use Factories

Some templates expose protected factory methods such as `TryCreateLayoutPackedScene()` or `TryCreateCreatureVisuals()`. Override them when a static path is not enough:

```csharp
protected override PackedScene? TryCreateLayoutPackedScene()
{
    return BuildSceneForCurrentMode();
}
```

Return `null` to let the normal asset profile path load.
