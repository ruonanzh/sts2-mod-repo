using System.Reflection;
using HarmonyLib;
using MegaCrit.Sts2.Core.Modding;
using STS2RitsuLib;
using STS2RitsuLib.Interop;

namespace RitsuR0Probe;

[ModInitializer(nameof(Initialize))]
public static class Entry
{
    public const string ModId = "RitsuR0Probe";

    public static void Initialize()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var logger = RitsuLibFramework.CreateLogger(ModId);
        ModTypeDiscoveryHub.RegisterModAssembly(ModId, assembly);
        new Harmony(ModId).PatchAll(assembly);
        logger.Info("R0 probe initialized; assembly registered for RitsuLib discovery");
    }
}
