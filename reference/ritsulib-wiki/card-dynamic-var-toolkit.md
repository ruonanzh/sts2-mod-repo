## Add A Variable

Use `ModCardVars` when a card needs values in its description that can change at runtime.

```csharp
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using STS2RitsuLib.Cards.DynamicVars;

public sealed class MyStrike : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
    public override DynamicVarSet DynamicVars => new()
    {
        ModCardVars.Int("damage", Damage),
        ModCardVars.Computed("block", 3, card => card?.Upgraded == true ? 5 : 3),
    };
}
```

Then use those variable names in `cards.json`, for example `Deal {damage} damage. Gain {block} block.`

Use a normal `IntVar` for values that already live on the card. Use `ComputedDynamicVar` when the display value depends on target, upgrade state, or preview mode.

`ModCardVars` also provides typed shortcuts for common vanilla variables: `Bool`, `Cards`, `Damage`, `OstyDamage`, `Block`, `Gold`, `Heal`, `HpLoss`, `MaxHp`, `Repeat`, `Forge`, `Summon`, `Energy`, `Stars`, and `Power<T>`. Each variable with a vanilla default name also has a named overload.


## Context Factories

Use the context overload when one value depends on several pieces of card, run, combat, preview, or target state:

```csharp
public override DynamicVarSet DynamicVars => new()
{
    ModCardVars.Int("Heat", Heat),
    ModCardVars.ComputedDamage(
        "Damage",
        static ctx =>
        {
            var heat = ctx.GetCardIntOrDefault("Heat");
            var targetBonus = ctx.HasTarget && ctx.IsInCombat
                ? ResolveTargetBonus(ctx.CombatState, ctx.Target)
                : 0m;

            return ctx.BaseValue + heat + targetBonus + (ctx.IsUpgraded ? 3m : 0m);
        },
        baseValue: 6),
};
```

The same `ComputedDynamicVarContext` is used for live values and previews. Its convenience members avoid repeatedly rebuilding guarded state checks:

- Evaluation: `IsCurrentValue`, `IsPreview`, `IsNormalPreview`, `IsUpgradePreview`, `IsMultiTargetPreview`, `ShouldRunGlobalHooks`.
- Card: `Card`, `ModelOwner`, `IsMutableCard`, `IsCanonicalCard`, `IsUpgraded`, `IsEnchantmentPreview`.
- Ownership and scope: `Player`, `SourceCreature`, `RunState`, `CombatState`, `CardScope`, plus matching `Has...` properties.
- Location: `IsInRun`, `IsInCombat`, and `IsCardInCombat`. `IsInCombat` falls back to the owner's active combat; `IsCardInCombat` is only true when the card itself reports combat scope.
- Variables: `TryGetCardVar<T>`, `GetRequiredCardVar<T>`, `GetCardBaseValueOrDefault`, `GetCardIntOrDefault`, and `EvaluateCardVarOrDefault`.

Context overloads are available directly on `Computed`, `ComputedEnergy`, `ComputedStars`, `ComputedPower<T>`, `ComputedPowerAmountGiven<T>`, `ComputedDamage`, `ComputedOstyDamage`, and `ComputedBlock`. Their factory is the second argument so existing `Computed(name, baseValue, card => ...)` calls remain unambiguous.

Prefer `static` factories. Dynamic vars are cloned with their cards; a static factory cannot accidentally retain the card instance from which the variable was created.


## Damage And Block Wrappers

Use `ComputedDamage` and `ComputedBlock` for computed values that should still match normal card preview rules for Strength, Dexterity, Vulnerable, Frail, and card enchantments:

```csharp
public override DynamicVarSet DynamicVars => new()
{
    ModCardVars.ComputedDamage("damage", 6, (card, target) => BaseDamage + BonusDamage(card, target)),
    ModCardVars.ComputedBlock("block", 5, card => card?.IsUpgraded == true ? 8 : 5),
};
```

For Osty attacks, use `ComputedOstyDamage` so damage preview modifiers see Osty as the dealer:

```csharp
ModCardVars.ComputedOstyDamage("damage", 7, (card, target) => ResolveOstyDamage(card, target));
```

When the preview base amount differs from the live amount, pass a preview base factory. The result still goes through normal damage or block hooks:

```csharp
ModCardVars.ComputedDamage(
    "damage",
    6,
    (card, target) => ResolveDamage(card, target),
    (card, mode, target, runGlobalHooks) => ResolvePreviewDamageBase(card, mode, target));
```

Use plain `Computed` when the value should not pass through damage or block hooks.

The context overload keeps the same behavior without requiring a separate preview delegate:

```csharp
ModCardVars.ComputedDamage(
    "damage",
    static ctx => ctx.BaseValue + ResolveBonus(ctx.Player, ctx.Target),
    baseValue: 6);
```


## Energy, Star, And Power Icon Counts

Use the concrete icon variable helpers when a description needs a dynamic amount rendered through the game's icon formatters:

```csharp
public override DynamicVarSet DynamicVars => new()
{
    ModCardVars.ComputedEnergy("EnergyGain", 1, card => ResolveEnergyGain(card)),
    ModCardVars.ComputedStars("StarGain", 1, card => ResolveStarGain(card)),
    ModCardVars.ComputedPower<StrengthPower>("StrengthPower", 2, card => ResolveStrength(card)),
};
```

`ComputedPower<T>` keeps the typed `PowerVar<T>` shape for naming and display, and does not run power-amount hooks by default. For a computed amount that represents power being applied by the card and should use the same preview hook path as vanilla `PowerVar<T>`, use `ComputedPowerAmountGiven<T>`.

Then keep the formatter in localization:

```json
{
  "MY_CARD.description": "Gain {EnergyGain:energyIcons()}.\nGain {StarGain:starIcons()}.\nGain {StrengthPower:diff()} Strength."
}
```

For a literal single energy icon that follows the card pool color, use the vanilla extra argument:

```json
{
  "MY_CARD.description": "The next card costs 0{energyPrefix:energyIcons(1)}."
}
```


## Add A Tooltip

Attach hover tips directly to a dynamic variable.

```csharp
ModCardVars.Int("heat", Heat)
    .WithSharedTooltip("MY_MOD_HEAT", "res://MyMod/images/ui/heat.png");
```

This reads `static_hover_tips` keys:

```json
{
  "MY_MOD_HEAT.title": "Heat",
  "MY_MOD_HEAT.description": "Some cards care about the current Heat value."
}
```

For custom layouts, pass a factory to `.WithTooltip(var => new HoverTip(...))`.


## Read Values Safely

Use extension helpers when a card or effect reads dynamic variables from another card:

```csharp
var amount = card.DynamicVars.GetIntOrDefault("damage");
var hasHeat = card.DynamicVars.HasPositiveValue("heat");
var damageVar = card.DynamicVars.GetRequired<DamageVar>("Damage");
var displayedValue = card.DynamicVars.EvaluateValueOrDefault("ComputedDamage", target: target);
```

Use `TryGet<T>` for optional typed access, `GetRequired<T>` when absence is a content error, `TryComputeValue` or `GetComputedValue` for any RitsuLib computed-var subtype, and `EvaluateValueOrDefault` when callers should transparently accept either a fixed or computed variable.

The `...OrDefault` and `Try...` helpers do not throw for missing keys. Required helpers throw a descriptive exception for missing or mismatched variables.


## Preview Logic

`ComputedDynamicVar` accepts a preview factory:

```csharp
ModCardVars.Computed(
    "damage",
    Damage,
    (card, target) => ResolveDamage(card, target),
    (card, mode, target, runGlobalHooks) => ResolvePreviewDamage(card, mode, target));
```

Use preview logic when card preview, target preview, or upgrade preview should show a value different from the current live card value.
