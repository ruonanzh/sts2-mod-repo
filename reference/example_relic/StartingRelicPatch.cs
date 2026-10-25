using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Characters;

namespace ExampleRelic;

[HarmonyPatch(typeof(Ironclad), nameof(Ironclad.StartingRelics), MethodType.Getter)]
internal static class StartingRelicPatch
{
    private static bool _logged;

    private static void Postfix(ref IReadOnlyList<RelicModel> __result)
    {
        __result = __result.Append(ModelDb.Relic<AegisShard>()).ToList();
        if (_logged) return;
        _logged = true;
        var relic = ModelDb.Relic<AegisShard>();
        Log.Info($"[ExampleRelic] starting relics={__result.Count} id={relic.Id} icon={relic.Icon.GetWidth()}x{relic.Icon.GetHeight()} block={relic.DynamicVars.Block.BaseValue}");
        Log.Info($"[ExampleRelic] title={relic.Title.GetRawText()} raw={relic.DynamicDescription.GetRawText()}");
        LocManager.Instance.StartOverridingLanguageAsEnglish();
        Log.Info($"[ExampleRelic] englishTitle={relic.Title.GetRawText()} englishRaw={relic.DynamicDescription.GetRawText()}");
        LocManager.Instance.StopOverridingLanguageAsEnglish();
    }
}
