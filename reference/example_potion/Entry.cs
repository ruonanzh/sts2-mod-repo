using System.Reflection;
using MegaCrit.Sts2.Core.Modding;
using STS2RitsuLib;
using STS2RitsuLib.Interop;

namespace ExamplePotion;

[ModInitializer(nameof(Init))]
public static class Entry
{
    public static void Init()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var logger = RitsuLibFramework.CreateLogger("ExamplePotion");
        ModTypeDiscoveryHub.RegisterModAssembly("ExamplePotion", assembly);
        new HarmonyLib.Harmony("ExamplePotion").PatchAll(assembly);
        logger.Info("ExamplePotion initialized; assembly registered for RitsuLib discovery");
    }
}
