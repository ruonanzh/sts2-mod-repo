using System.Collections.Generic;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Powers;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.HoverTips;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.ValueProps;
using STS2RitsuLib.Interop.AutoRegistration;
using STS2RitsuLib.Scaffolding.Content;

namespace ExamplePower;

[RegisterPower]
public sealed class Momentum : ModPowerTemplate
{
    public override PowerType Type => PowerType.Buff;

    public override PowerStackType StackType => PowerStackType.Counter;

    protected override IEnumerable<IHoverTip> AdditionalHoverTips => [HoverTipFactory.Static(StaticHoverTip.Block)];

    public override PowerAssetProfile AssetProfile => new(
        "res://ExamplePower/images/powers/momentum.png",
        "res://ExamplePower/images/powers/momentum.png");

    public override async Task AfterCardPlayed(PlayerChoiceContext choiceContext, CardPlay cardPlay)
    {
        if (cardPlay.Card.Owner != Owner.Player || cardPlay.Card.Type != CardType.Attack) return;
        var before = Owner.Block;
        await CreatureCmd.GainBlock(Owner, Amount, ValueProp.Unpowered, null);
        Log.Info($"[ExamplePower] attack played={cardPlay.Card.Id.Entry} power={Id.Entry} stacks={Amount} block={before}->{Owner.Block}");
    }
}
