using HarmonyLib;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Nodes.Screens.CardLibrary;
using MegaCrit.Sts2.Core.Saves;

namespace RitsuR0Probe;

[HarmonyPatch(typeof(NCardLibraryGrid), "RefreshVisibility")]
internal static class UnlockCard
{
    private static bool _logged;

    [HarmonyPrefix]
    private static void MarkAsSeen()
    {
        var card = ModelDb.Card<FocusedStrike>();
        var added = SaveManager.Instance.Progress.MarkCardAsSeen(card.Id);
        if (_logged) return;
        _logged = true;
        var seen = SaveManager.Instance.Progress.DiscoveredCards.Contains(card.Id);
        Log.Info($"[RitsuR0Probe] library newlyMarked={added} discovered={seen} id={card.Id}");
    }
}
