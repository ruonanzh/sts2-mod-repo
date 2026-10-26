using System.Collections.Generic;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Relics;
using MegaCrit.Sts2.Core.HoverTips;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.RelicPools;
using MegaCrit.Sts2.Core.ValueProps;
using STS2RitsuLib.Interop.AutoRegistration;
using STS2RitsuLib.Scaffolding.Content;

namespace ExampleRelic;

[RegisterRelic(typeof(IroncladRelicPool), FullPublicEntry = PublicEntry)]
public sealed class AegisShard : ModRelicTemplate
{
    public const string PublicEntry = "EXAMPLE_RELIC_AEGIS_SHARD";

    public override RelicRarity Rarity => RelicRarity.Common;

    protected override IEnumerable<DynamicVar> CanonicalVars => [new BlockVar(4m, ValueProp.Unpowered)];

    protected override IEnumerable<IHoverTip> AdditionalHoverTips => [HoverTipFactory.Static(StaticHoverTip.Block)];

    public override RelicAssetProfile AssetProfile => new(
        "res://ExampleRelic/images/relics/aegis_shard.png",
        "res://ExampleRelic/images/relics/aegis_shard.png",
        "res://ExampleRelic/images/relics/aegis_shard_big.png");

    public override async Task BeforeCombatStart()
    {
        Flash();
        var before = Owner.Creature.Block;
        await CreatureCmd.GainBlock(Owner.Creature, DynamicVars.Block, null);
        Log.Info($"[ExampleRelic] combat start block={before}->{Owner.Creature.Block} added={DynamicVars.Block.BaseValue}");
    }
}
