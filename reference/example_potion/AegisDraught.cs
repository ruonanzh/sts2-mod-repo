using System.Collections.Generic;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Entities.Potions;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.HoverTips;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Characters;
using MegaCrit.Sts2.Core.Models.PotionPools;
using MegaCrit.Sts2.Core.ValueProps;
using STS2RitsuLib.Interop.AutoRegistration;
using STS2RitsuLib.Scaffolding.Content;

namespace ExamplePotion;

[RegisterPotion(typeof(IroncladPotionPool), FullPublicEntry = PublicEntry)]
[RegisterCharacterStarterPotion(typeof(Ironclad), 1)]
public sealed class AegisDraught : ModPotionTemplate
{
    public const string PublicEntry = "EXAMPLE_POTION_AEGIS_DRAUGHT";

    public override PotionRarity Rarity => PotionRarity.Common;

    public override PotionUsage Usage => PotionUsage.CombatOnly;

    public override TargetType TargetType => TargetType.AnyPlayer;

    protected override IEnumerable<DynamicVar> CanonicalVars => [new BlockVar(6m, ValueProp.Unpowered)];

    protected override IEnumerable<IHoverTip> AdditionalHoverTips => [HoverTipFactory.Static(StaticHoverTip.Block)];

    public override PotionAssetProfile AssetProfile => new(
        "res://ExamplePotion/images/potions/aegis_draught.png",
        "res://ExamplePotion/images/potions/aegis_draught.png");

    protected override async Task OnUse(PlayerChoiceContext choiceContext, Creature? target)
    {
        PotionModel.AssertValidForTargetedPotion(target);
        var before = target.Block;
        await CreatureCmd.GainBlock(target, DynamicVars.Block, null);
        Log.Info($"[ExamplePotion] potion block={before}->{target.Block} added={DynamicVars.Block.BaseValue}");
    }
}
