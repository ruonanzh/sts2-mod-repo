using System.Reflection;
using MegaCrit.Sts2.Core.Modding;
using STS2RitsuLib;
using STS2RitsuLib.Interop;

namespace ExamplePower;

[ModInitializer(nameof(Init))]
public static class Entry
{
    public static void Init()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var logger = RitsuLibFramework.CreateLogger("ExamplePower");
        ModTypeDiscoveryHub.RegisterModAssembly("ExamplePower", assembly);
        new HarmonyLib.Harmony("ExamplePower").PatchAll(assembly);
        logger.Info("ExamplePower initialized; assembly registered for RitsuLib discovery");
    }
}
