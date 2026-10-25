using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Characters;

namespace ExampleCard;

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
        var upgraded = (CardModel)card.MutableClone();
        upgraded.UpgradeInternal();
        Log.Info($"[ExampleCard] starting deck={__result.Count()} id={card.Id} portrait={portrait.GetWidth()}x{portrait.GetHeight()} damage={card.DynamicVars.Damage.BaseValue} upgraded={upgraded.DynamicVars.Damage.BaseValue}");
        Log.Info($"[ExampleCard] title={card.Title} raw={card.Description.GetRawText()}");
        LocManager.Instance.StartOverridingLanguageAsEnglish();
        Log.Info($"[ExampleCard] englishTitle={card.Title} englishRaw={card.Description.GetRawText()}");
        LocManager.Instance.StopOverridingLanguageAsEnglish();
    }
}
