using System.Collections.Generic;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models.CardPools;
using STS2RitsuLib.Interop.AutoRegistration;
using STS2RitsuLib.Scaffolding.Content;

namespace ExamplePower;

[RegisterCard(typeof(IroncladCardPool), FullPublicEntry = PublicEntry)]
public sealed class BuildMomentum()
    : ModCardTemplate(0, CardType.Skill, CardRarity.Uncommon, TargetType.Self)
{
    public const string PublicEntry = "EXAMPLE_POWER_BUILD_MOMENTUM";

    protected override IEnumerable<DynamicVar> CanonicalVars => [new DynamicVar("Power", 1m)];

    public override CardAssetProfile AssetProfile => new()
    {
        PortraitPath = "res://ExamplePower/images/cards/build_momentum.png",
    };

    protected override async Task OnPlay(PlayerChoiceContext choiceContext, CardPlay cardPlay)
    {
        var power = await PowerCmd.Apply<Momentum>(choiceContext, Owner.Creature, DynamicVars["Power"].BaseValue, Owner.Creature, this);
        Log.Info($"[ExamplePower] applied={Id.Entry} amount={power?.Amount ?? 0}");
    }

    protected override void OnUpgrade() => DynamicVars["Power"].UpgradeValueBy(1m);
}
