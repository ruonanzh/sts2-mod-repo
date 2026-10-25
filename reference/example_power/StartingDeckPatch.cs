using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Characters;

namespace ExamplePower;

[HarmonyPatch(typeof(Ironclad), nameof(Ironclad.StartingDeck), MethodType.Getter)]
internal static class StartingDeckPatch
{
    private static bool _logged;

    private static void Postfix(ref IEnumerable<CardModel> __result)
    {
        __result = __result.Append(ModelDb.Card<BuildMomentum>());
        if (_logged) return;
        _logged = true;
        var card = ModelDb.Card<BuildMomentum>();
        var power = ModelDb.Power<Momentum>();
        var upgraded = (CardModel)card.MutableClone();
        upgraded.UpgradeInternal();
        Log.Info($"[ExamplePower] starting deck={__result.Count()} card={card.Id} power={power.Id} icon={power.Icon.GetWidth()}x{power.Icon.GetHeight()} amount={card.DynamicVars["Power"].BaseValue} upgraded={upgraded.DynamicVars["Power"].BaseValue}");
        Log.Info($"[ExamplePower] cardTitle={card.Title} powerTitle={power.Title.GetRawText()} powerRaw={power.Description.GetRawText()}");
        LocManager.Instance.StartOverridingLanguageAsEnglish();
        Log.Info($"[ExamplePower] englishCard={card.Title} englishPower={power.Title.GetRawText()} englishRaw={power.Description.GetRawText()}");
        LocManager.Instance.StopOverridingLanguageAsEnglish();
    }
}
