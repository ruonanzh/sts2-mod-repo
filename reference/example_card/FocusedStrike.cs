using System.Collections.Generic;
using System.Threading.Tasks;
using BaseLib.Abstracts;
using BaseLib.Utils;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Helpers;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Models.CardPools;
using MegaCrit.Sts2.Core.ValueProps;

namespace ExampleCard;

[Pool(typeof(IroncladCardPool))]
public class FocusedStrike() : CustomCardModel(1, CardType.Attack, CardRarity.Common, TargetType.AnyEnemy)
{
    protected override HashSet<CardTag> CanonicalTags => [CardTag.Strike];

    // 本地化写在 C# 里，不走 localization/*.json。
    // 原因（反编译确认）：游戏的 ModManager.GetModdedLocTables 只查
    // res://<mod.id>/localization/...，而 res:// 里没有这个 mod 就是没有——DLL-only 的 mod
    // 带不了 json 本地化。BaseLib 的 ILocalizationProvider 因此提供了 C# 这条路。
    public override List<(string, string)> Localization =>
        new CardLoc("Focused Strike", "Deal {Damage} damage.");

    protected override IEnumerable<DynamicVar> CanonicalVars => [new DamageVar(6, ValueProp.Move)];

    protected override async Task OnPlay(PlayerChoiceContext choiceContext, CardPlay cardPlay)
    {
        await CommonActions.CardAttack(this, cardPlay, 1, "vfx/vfx_attack_slash", null, null)
            .Execute(choiceContext);
    }

    protected override void OnUpgrade() => DynamicVars.Damage.UpgradeValueBy(3m);

    // 卡面：**临时借原版一张图的立绘**。
    //
    // 默认路径是 ImageHelper.GetImagePath(
    //   "atlases/card_atlas.sprites/<池子>/<modid>-<类名小写>.tres")，
    // 我们没有这个资源，于是游戏打一条 Missing sprite 的 WARN、画占位图。
    // 卡本身照常能看见、能打 —— 缺图不会让卡隐形。
    //
    // 真正的做法是把图片放进 mod 自己的 res:// 命名空间，那要 PCK（wiki 里所有美术
    // 例子写的都是 `res://<ModRoot>/images/...`）。美术方向暂缓，所以先指一张原版
    // 卡图：`PortraitPath` 是 virtual，`Portrait` 不是 —— 能覆写的只有路径。
    // 卡面由 PortraitPatch 在运行期顶掉 Portrait 的返回值（见那个文件开头的说明）。
    // PortraitPath 保持原版默认：它指向我们带的 .tres，没有就 null，反正会被顶掉。
}
