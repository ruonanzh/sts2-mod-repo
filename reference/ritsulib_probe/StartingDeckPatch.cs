using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Characters;

namespace RitsuR0Probe;

[HarmonyPatch(typeof(Ironclad), nameof(Ironclad.StartingDeck), MethodType.Getter)]
internal static class StartingDeckPatch
{
    private static bool _logged;

    private static void Postfix(ref IEnumerable<CardModel> __result)
    {
        __result = __result.Append(ModelDb.Card<FocusedStrike>());
        if (_logged) return;
        _logged = true;
        var card = ModelDb.Card<FocusedStrike>();
        var portrait = card.Portrait;
        Log.Info($"[RitsuR0Probe] starting deck={__result.Count()} id={card.Id} publicEntry={FocusedStrike.PublicEntry}");
        var upgraded = (CardModel)card.MutableClone();
        upgraded.UpgradeInternal();
        Log.Info($"[RitsuR0Probe] title={card.Title} raw={card.Description.GetRawText()} portrait={portrait.GetWidth()}x{portrait.GetHeight()} damage={card.DynamicVars.Damage.BaseValue} upgraded={upgraded.DynamicVars.Damage.BaseValue}");
        LocManager.Instance.StartOverridingLanguageAsEnglish();
        Log.Info($"[RitsuR0Probe] englishTitle={card.Title} englishRaw={card.Description.GetRawText()}");
        LocManager.Instance.StopOverridingLanguageAsEnglish();
    }
}
