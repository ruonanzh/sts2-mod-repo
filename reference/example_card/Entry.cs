using MegaCrit.Sts2.Core.Modding;

namespace ExampleCard;

[ModInitializer(nameof(Init))]
public static class Entry
{
    public static void Init()
    {
        // 本 mod 带 [ModInitializer]，所以加载器**不会**自动 Harmony.PatchAll，得自己打。
        // 少了这一行，补丁类只是普通类，什么也不做，而且不报错。
        new HarmonyLib.Harmony("ExampleCard").PatchAll(typeof(Entry).Assembly);
        MegaCrit.Sts2.Core.Logging.Log.Info("[ExampleCard] loaded");
    }
}
