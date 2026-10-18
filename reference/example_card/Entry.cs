using MegaCrit.Sts2.Core.Modding;

namespace ExampleCard;

[ModInitializer(nameof(Init))]
public static class Entry
{
    public static void Init() => MegaCrit.Sts2.Core.Logging.Log.Info("[ExampleCard] loaded");
}
