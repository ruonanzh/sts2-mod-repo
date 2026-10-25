## Register A Resource

Use `RitsuLibFramework.GetSecondaryResourceRegistry(modId)` to declare combat resources such as mod-defined energy, ammunition, stance counters, or other card-payment state.

```csharp
var resources = RitsuLibFramework.GetSecondaryResourceRegistry("MyMod");

var charge = resources.Register("charge", new SecondaryResourceDefinition(
    defaultAmount: 0,
    baseMaxAmount: 3,
    turnStartPolicy: SecondaryResourceTurnStartPolicy.ResetToMax,
    persistencePolicy: SecondaryResourcePersistencePolicy.Combat,
    smallIconPath: "res://MyMod/assets/ui/charge_small.png",
    largeIconPath: "res://MyMod/assets/ui/charge_large.png")
{
    ClampToMaxAmount = true,
});
```

The registry expands the mod-local ID into a stable full resource ID. Use the returned `charge.Id` whenever another API needs that full ID. Registering the same ID again returns the definition registered first.

`baseMaxAmount` is optional. Leave it `null` for resources without a max concept.

Set `ClampToMaxAmount` when every amount write must respect the current hook-adjusted maximum. This option requires
`baseMaxAmount`; the default amount must not exceed the unmodified maximum.

By default, each resource uses the following localization layout:

- localization table: `static_hover_tips`
- title key: `{resourceId}.title`
- description key: `{resourceId}.description`

Only pass `locTable`, `titleKey`, or `descriptionKey` when you need to override that layout. Surrounding whitespace in these values and the icon paths is ignored.


## Mutate Runtime State

Use `SecondaryResourceCmd` to read and change values during combat:

```csharp
var current = SecondaryResourceCmd.Get(player, charge.Id);
var max = SecondaryResourceCmd.GetMax(player, charge.Id);

await SecondaryResourceCmd.Gain(player, charge.Id, 1, source: card);
await SecondaryResourceCmd.Lose(player, charge.Id, 1, source: relic);
await SecondaryResourceCmd.Set(player, charge.Id, 2, source: power);
await SecondaryResourceCmd.ClampToMax(player, charge.Id, source: relic);

var spent = await SecondaryResourceCmd.Spend(player, charge.Id, 2, card, source: card);
await SecondaryResourceCmd.Reset(player, charge.Id, toMax: true);
```

When an effect changes state used by `ModifyMaxSecondaryResource`, call `ClampToMax` immediately afterward if the new
maximum may be lower. Maximum calculation is side-effect-free, so RitsuLib cannot otherwise observe when arbitrary
modifier dependencies change. With `ClampToMaxAmount` enabled, later gains, sets, resets, and persistence restores are
also clamped at the shared state-write boundary.

Built-in turn-start behavior is selected with `SecondaryResourceTurnStartPolicy`:

| Policy | Effect |
| --- | --- |
| `None` | Keep the current amount |
| `ResetToMax` | Set the current amount to the hook-adjusted maximum |
| `AddMaxToCurrent` | Add the hook-adjusted maximum to the current amount |
| `Clear` | Set current amount to the resource minimum |

Persistence is separate:

| Policy | Saved scope |
| --- | --- |
| `None` | Runtime only |
| `Combat` | Included only in explicitly requested combat snapshots; excluded from normal run-save synchronization |
| `Run` | Persist across combats in the same run |


## Attach Card Costs

Secondary resources integrate with `CardModel.CanPlay`, `SpendResources`, auto-play bookkeeping, and end-of-turn cleanup. Fixed and X costs can be attached directly to a card:

```csharp
card.SecondaryCosts()
    .Set(charge.Id, 1)
    .Set(
        charge.Id,
        SecondaryResourceCost.X(),
        SecondaryResourceCostDuration.UntilPlayed);
```

Use `SecondaryResourceCostDuration` to scope temporary modifiers:

| Duration | Cleared when |
| --- | --- |
| `Permanent` | Replaced or cleared explicitly |
| `UntilPlayed` | After the card is next played successfully |
| `ThisTurn` | End of turn cleanup runs |
| `ThisCombat` | The card's combat instance is discarded |

When a required secondary-resource cost cannot be paid and its insufficient-payment policy does not allow a shortfall, `CanPlay` fails automatically.

For optional payments that enable an additional effect, use named card-play uses instead of hard costs:

```csharp
card.SecondaryResourceUses()
    .SpendIfAvailable("bonus_charge", charge.Id, 2);
```

Optional payments never block `CanPlay`. If enough resource remains after required payments, RitsuLib spends it during
`SpendResources` and marks the named line as active in the play ledger:

```csharp
var ledger = cardPlay.SecondaryResources();
if (ledger.Activated("bonus_charge"))
{
    // extra effect
}
```

You can also declare required costs through the same use collection when one card needs multiple named entries:

```csharp
card.SecondaryResourceUses()
    .Require("entry_fee", charge.Id, 1)
    .SpendIfAvailable("bonus_charge", charge.Id, 2);
```

Required uses reserve resources before extra and optional payments, so later entries cannot consume resources needed by
hard costs. For compatibility, each `SecondaryCosts()` entry becomes a required use whose ID is the resource ID.

Use IDs must be unique across `SecondaryCosts()`, `SecondaryResourceUses()`, and capability-contributed uses on the same
card. RitsuLib rejects duplicate IDs before committing any payment.

For a repeatable payment that buys as many full stacks as possible, use `SpendExtra(...)`. It is resolved after required
payments and shortfall replacement, but before ordinary optional payments:

```csharp
card.SecondaryResourceUses()
    .Require("seven_stars", stars.Id, 7)
    .SpendExtra(
        "seven_stars_bonus",
        stars.Id,
        perStackAmount: 2,
        maxStacks: null);
```

`perStackAmount` must be positive, and repeatable payments cannot use an X cost. `maxStacks: null` means no explicit cap;
RitsuLib pays for as many full stacks as the remaining resource allows. A remainder that cannot complete one stack is
not spent.

```csharp
var ledger = cardPlay.SecondaryResources();
var extraSpent = ledger.ExtraSpentByUse("seven_stars_bonus");
var stacks = ledger.ExtraStacksByUse("seven_stars_bonus");
var totalStarsSpent = ledger.Spent(stars.Id);

if (stacks > 0)
{
    // one effect per extra stack
}

if (totalStarsSpent >= 20)
{
    // effect for spending at least 20 stars in total
}
```

Required costs normally block play when the resource is insufficient. To allow a required cost to pass with an unpaid
amount, attach an explicit insufficient-payment policy:

```csharp
card.SecondaryResourceUses()
    .RequireAllowingShortfall(
        "seven_stars",
        stars.Id,
        7,
        onShortfall: async ctx =>
        {
            // Runs once during SpendResources, after available stars are spent.
            await ApplyShortfallPenalty(ctx.Card, ctx.Shortfall);
        });
```

`ctx.Shortfall` is the remaining unpaid amount. By default, RitsuLib spends the available resource first; pass
`spendAvailable: false` when the resource itself should remain untouched.

When another payment source can replace the missing resource, add a side-effect-free resolver. The resolver may inspect
state during `CanPlay`, but must not mutate it. Return a commit callback that pays the replacement source later:

```csharp
card.SecondaryResourceUses()
    .RequireAllowingShortfall(
        "seven_stars",
        stars.Id,
        7,
        resolveShortfall: ctx =>
        {
            var backup = SecondaryResourceCmd.Get(ctx.Player, backupStars.Id);
            if (backup < ctx.Shortfall)
                return SecondaryResourceShortfallResolution.None;

            return SecondaryResourceShortfallResolution.Cover(
                ctx.Shortfall,
                async commit =>
                {
                    await SecondaryResourceCmd.Spend(
                        commit.Player,
                        backupStars.Id,
                        commit.CoveredShortfall,
                        commit.Card,
                        commit.Source);
                });
        },
        onShortfall: async ctx =>
        {
            // Runs only for any remaining amount not covered by the replacement payment.
            await ApplyShortfallPenalty(ctx.Card, ctx.Shortfall);
        });
```

If replacement payments cover the entire original shortfall, the entry is playable without a remaining-shortfall
callback. The ledger records the original, covered, and remaining amounts:

```csharp
var ledger = cardPlay.SecondaryResources();
var original = ledger.OriginalShortfallByUse("seven_stars");
var covered = ledger.CoveredShortfallByUse("seven_stars");
var remaining = ledger.ShortfallByUse("seven_stars");
```

Models, capabilities, and global listeners can also participate in the same pre-commit planning step by implementing
`ResolveSecondaryResourceShortfall(...)`. The hook receives the current resolution and must return a non-null,
side-effect-free replacement resolution without mutating gameplay state.

When permission to leave an amount unpaid is dynamic, implement
`ModifySecondaryResourceInsufficientPayment(...)`. For example, a relic can keep normal cards blocked by default and
return `SecondaryResourceInsufficientPayment.AllowPlayWithReplacement(...)` only while the relic is active. This hook
also runs during `CanPlay`, so it may only inspect state and must return a non-null policy.


## Hooks, UI, And Text

Implement `ISecondaryResourceHookListener` on a model or capability when secondary-resource behavior must react to gameplay:

- Modify gains, maximum amounts, costs, or secondary X values captured for a card play
- Dynamically decide whether an unpaid required amount blocks play, is allowed, or can be replaced
- Use `ModifySecondaryResourceCostLate(...)` when a cost modifier should run after normal secondary cost modifiers,
  mirroring the game's late energy-cost pass
- Prevent gains, payments, or calls to `SecondaryResourceCmd.Reset(...)`; this includes the `ResetToMax` turn-start policy,
  but not `AddMaxToCurrent` or `Clear`
- `ShouldSpendSecondaryResource(...)` blocks `CanPlay` for required card costs; optional spend lines simply become
  inactive when vetoed
- React after an amount change, payment, remaining-shortfall payment, or reset

For process-wide behavior, register a global listener through `SecondaryResourceHook.RegisterGlobalListener(...)`.

For the game's energy and Stars resources, use `IPlayerResourceHookListener` on a model or capability, or register a global listener
through `PlayerResourceHook.RegisterGlobalListener(...)`. `AfterPlayerEnergyGained(...)` and
`AfterPlayerStarsGained(...)` run after successful `PlayerCmd.GainEnergy(...)` / `PlayerCmd.GainStars(...)` calls and
receive the actual gained amount plus old and new totals.

For combat presentation:

- `AlwaysShowInCombatUi(...)` and `AlwaysShowInCombatUiForCharacter(...)` keep a resource visible before it is gained
- `RegisterCombatUi(...)`, `RegisterCardUi(...)`, and `RegisterMultiplayerPlayerStateUi(...)` attach custom Godot nodes through the node-attachment system
- custom `RegisterCombatUi(...)` updates should use `ctx.VisibleDefinitions` or `definition.IsVisibleInCombatUi(ctx.Player)` to decide whether their nodes are visible
- the `RegisterCombatUi(...)` overload with `SecondaryResourceCombatUiChangedHandler` receives formal UI change
  notifications after the combat UI refreshes. Use `ctx.Definition`, `ctx.OldAmount`, `ctx.NewAmount`, `ctx.Delta`,
  `ctx.Reason`, and `ctx.Source` to play presentation-only feedback such as particles or pulses
- registered UI callbacks are isolated: a callback failure is logged once and does not abort the rest of the UI refresh
- `NSecondaryResourceCardCostUi` is a single-entry card-cost node for `RegisterCardUi(...)`; bind one resource or one
  named use per node and place each node explicitly
- When a card-cost node is deliberately placed in the game's Stars-cost slot, set `SecondaryResourceCardCostUiStyle.ReserveVanillaStarCostSlot = true` so enchanted cards retain the game's Stars-cost enchantment-tab layout. For custom grouped cost UI, call `SecondaryResourceCardUiLayout.ReserveVanillaStarCostSlot(ctx.Parent)` from the card UI updater when the visible group occupies that slot.
- Built-in `NSecondaryResourceIcon` / `NSecondaryResourceCounter` hover tips always use the resource title and description. Pass a `SecondaryResourceIconStyle` with `HoverTip = SecondaryResourceHoverTipStyle.Default with { ResolveGlobalPosition = ... }` when you need custom placement. Hover-tip title and description receive `Amount`, `HasMaxAmount`, and `MaxAmount` `LocString` variables so localization can decide how to show dynamic amounts.

```csharp
resources.RegisterCombatUi(
    "charge_feedback",
    parent => new MyChargeFeedbackNode(),
    update: ctx => ctx.Node.Refresh(ctx.Player, ctx.VisibleDefinitions),
    changed: ctx =>
    {
        if (ctx.Definition.Id == charge.Id && ctx.Delta > 0)
            ctx.Node.PlayGainFeedback(ctx.Delta, ctx.Source);
    });
```

For text:

- `SecondaryResourceText.GetIconTag(...)` returns a rich-text `[img]...[/img]` icon tag
- `SecondaryResourceVars.For(...)` and `SecondaryResourceVars.ForLocal(...)` create SmartFormat-friendly dynamic variables
- `{secondaryResource:secondaryResourceIcons(charge,1)}` renders a fixed amount from a registered resource ID or an
  unambiguous mod-local ID
- `{Cost:secondaryResourceIcons(charge)}` renders a dynamic variable using a registered resource ID or an unambiguous
  mod-local ID
- titles and descriptions come from the resource's localization table and keys
