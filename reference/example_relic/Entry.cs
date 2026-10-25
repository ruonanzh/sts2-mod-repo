using System.Reflection;
using MegaCrit.Sts2.Core.Modding;
using STS2RitsuLib;
using STS2RitsuLib.Interop;

namespace ExampleRelic;

[ModInitializer(nameof(Init))]
public static class Entry
{
    public static void Init()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var logger = RitsuLibFramework.CreateLogger("ExampleRelic");
        ModTypeDiscoveryHub.RegisterModAssembly("ExampleRelic", assembly);
        new HarmonyLib.Harmony("ExampleRelic").PatchAll(assembly);
        logger.Info("ExampleRelic initialized; assembly registered for RitsuLib discovery");
    }
}
