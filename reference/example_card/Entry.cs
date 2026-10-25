using System.Reflection;
using MegaCrit.Sts2.Core.Modding;
using STS2RitsuLib;
using STS2RitsuLib.Interop;

namespace ExampleCard;

[ModInitializer(nameof(Init))]
public static class Entry
{
    public static void Init()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var logger = RitsuLibFramework.CreateLogger("ExampleCard");
        ModTypeDiscoveryHub.RegisterModAssembly("ExampleCard", assembly);
        new HarmonyLib.Harmony("ExampleCard").PatchAll(assembly);
        logger.Info("ExampleCard initialized; assembly registered for RitsuLib discovery");
    }
}
