using System.Collections.Generic;
using System.Threading.Tasks;
using BaseLib.Abstracts;
using BaseLib.Utils;
using MegaCrit.Sts2.Core.Entities.Cards;
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
}
