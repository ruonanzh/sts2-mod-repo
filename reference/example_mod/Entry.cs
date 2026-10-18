using MegaCrit.Sts2.Core.Modding;

namespace TemplateMod;

/// <summary>
/// Entry point. The loader finds the type carrying <see cref="ModInitializerAttribute"/>,
/// looks up the named method with BindingFlags.Static, and invokes it with no arguments.
/// So the method must be static and parameterless. If no type carries the attribute at all,
/// the loader falls back to <c>Harmony.PatchAll(assembly)</c> with no setup of your own.
/// </summary>
[ModInitializer(nameof(Init))]
public static class Entry
{
    public static void Init()
    {
        // Replace this with your mod: Harmony patches, content registration, reading config.
        // Log.Info lines show up in the game's godot.log, which is the fastest way to check
        // that a build actually loaded.
        MegaCrit.Sts2.Core.Logging.Log.Info($"[{typeof(Entry).Assembly.GetName().Name}] loaded");
    }
}
