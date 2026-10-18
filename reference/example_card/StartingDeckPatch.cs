using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Characters;

namespace ExampleCard;

/// <summary>
/// 把这张卡放进铁甲战士的起始牌组，这样一进战斗就能看到、能打。
///
/// 为什么需要这一手：进了卡池不等于出现在牌桌上。
/// 卡池（<see cref="MegaCrit.Sts2.Core.Models.CardPools.IroncladCardPool"/>）只决定
/// 「能不能作为奖励/商品牌出现」；起始牌组是 <see cref="Ironclad"/> 里写死的 10 张
/// （5 Strike + 4 Defend + 1 Bash）。两者互不相干。
///
/// 这也是给玩家看「我的 mod 真的生效了」最短的路：不用等随机奖励。
/// 反编译 `Ironclad.StartingDeck` 确认它返回 `IEnumerable&lt;CardModel&gt;`，
/// 所以这里用 postfix 追加一张，不动原版那 10 张。
/// </summary>
[HarmonyPatch(typeof(Ironclad), nameof(Ironclad.StartingDeck), MethodType.Getter)]
internal static class StartingDeckPatch
{
    private static bool _logged;

    private static void Postfix(ref IEnumerable<CardModel> __result)
    {
        __result = __result.Append(ModelDb.Card<FocusedStrike>());

        if (_logged) return;
        _logged = true;
        Log.Info($"[ExampleCard] Ironclad starting deck now has {__result.Count()} cards");
    }
}
