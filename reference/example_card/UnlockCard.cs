using HarmonyLib;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Nodes.Screens.CardLibrary;
using MegaCrit.Sts2.Core.Saves;

namespace ExampleCard;

/// <summary>
/// 让这张卡在百科（card library）里直接是「已发现」，不再显示成问号/锁定。
///
/// 百科的判定在 `NCardLibraryGrid.RefreshVisibility`：
/// <code>
/// _seenCards     = SaveManager.Instance.Progress.DiscoveredCards.ToHashSet();
/// _unlockedCards = ModelDb.AllCardPools.Select(p => p.GetUnlockedCards(...)).SelectMany(...)
/// </code>
/// 也就是两道门：**解锁**（靠 epoch 过滤，我们的卡没有 epoch，本来就算解锁）、
/// **发现**（`DiscoveredCards` 里有没有这个 id，只有真在局里遇到过才会写进去）。
///
/// BaseLib 自己也做这件事，但只对 `CustomCardPoolModel`（自定义卡池）生效：
/// `CustomCardPoolMarkAsSeenPatch` 里 `if (allCardPool is CustomCardPoolModel { SeenByDefault: not false })`。
/// 我们把卡放进原版的 `IroncladCardPool`，所以那条路管不到。
///
/// 这里照样打 `RefreshVisibility` 的 prefix：在百科读取 `Progress` **之前**把 id 写进去。
/// 不放在 mod 初始化里，是为了只在玩家真的翻开百科时才动存档。
/// </summary>
[HarmonyPatch(typeof(NCardLibraryGrid), "RefreshVisibility")]
internal static class UnlockCard
{
    private static bool _logged;

    [HarmonyPrefix]
    private static void MarkAsSeen()
    {
        var card = ModelDb.Card<FocusedStrike>();

        // 用 Progress 这一层，不用 SaveManager.MarkCardAsSeen：后者要求 card.Owner 是本地玩家，
        // 而卡池里拿到的是规范模型（canonical），Owner 不一定在。
        bool added = SaveManager.Instance.Progress.MarkCardAsSeen(card.Id);

        if (_logged) return;
        _logged = true;
        var seen = SaveManager.Instance.Progress.DiscoveredCards.Contains(card.Id);
        Log.Info($"[ExampleCard] card library: {card.Id} newly marked = {added}, in DiscoveredCards = {seen}");
    }
}
