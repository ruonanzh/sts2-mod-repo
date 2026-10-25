# RitsuLib

This page covers the pinned RitsuLib contract. Use `reference/ritsulib-wiki/INDEX.md` for the full upstream guide.

## Research before implementation

The accepted references cover only their demonstrated behavior. For another behavior:

1. Read the relevant page through `reference/ritsulib-wiki/INDEX.md`.
2. Use `inspect_game_api dll=game` for vanilla types and signatures.
3. Use `inspect_game_api dll=ritsulib` for framework types and signatures.
4. Use `inspect_game_code` for implementations and call sites.
5. Read results under `cs/sts2/` for game code and `cs/ritsulib-*` for framework code.

Use the pinned assemblies when the Wiki and code disagree. Do not copy a signature without checking how it is used.

## Version and dependencies

The current targets are game 0.107.1 and RitsuLib 0.6.10.

```xml
<PackageReference Include="STS2.RitsuLib.Compat.0.107.1" Version="0.6.10" />
```

A consumer manifest declares:

```json
{ "id": "STS2-RitsuLib", "min_version": "0.6.10" }
```

NuGet supplies compile-time modules. The separate runtime mod supplies the game integration. Do not copy framework assemblies into each consumer mod.

The runtime directory must remain complete:

```text
STS2-RitsuLib/
├─ STS2-RitsuLib.dll
├─ mod_manifest.json
├─ assets.zip
├─ RitsuLib.References.props
├─ shared/
└─ compat/0.107.1/
```

`install_mod` preserves these files and directories. It does not replace an existing dependency.

## Initialization and registration

Register the assembly before using attribute registration:

```csharp
var assembly = Assembly.GetExecutingAssembly();
var logger = RitsuLibFramework.CreateLogger("ExampleCard");
ModTypeDiscoveryHub.RegisterModAssembly("ExampleCard", assembly);
```

`EnsureGodotScriptsRegistered` is needed only when a `.tscn` scene uses C# scripts from the mod.

Use attributes or one content pack. Do not register the same model through both routes. Registration closes during model initialization.

The reference card uses:

```csharp
[RegisterCard(typeof(IroncladCardPool), FullPublicEntry = PublicEntry)]
public sealed class FocusedStrike : ModCardTemplate
{
    public const string PublicEntry = "EXAMPLE_CARD_FOCUSED_STRIKE";
}
```

Use `ModCardTemplate`, `CanonicalVars`, `OnPlay`, and `OnUpgrade` for this card pattern. Check the pinned assembly before using another pattern. The getting-started snippet and downstream mods do not always use the same shape.

## Public IDs and saves

RitsuLib derives IDs from registration data. `FullPublicEntry` fixes the entry stem, but normalization still applies.

Measured on 2026-10-25: `EXAMPLECARD-FOCUSEDSTRIKE` became `EXAMPLECARD_FOCUSEDSTRIKE`. The hyphen became an underscore. Existing saves that require the old ID need a dedicated migration layer. New RitsuLib content should use a new run unless that layer exists.

Standalone models can use different registration metadata. `RegisterPower` in RitsuLib 0.6.10 does not support `FullPublicEntry`.

Measured in `ExamplePower`: the type `Momentum` registered as `EXAMPLE_POWER_POWER_MOMENTUM`. Read the registration log for the full ID. Use that full ID in `powers.json`.

`RegisterPotion` supports `FullPublicEntry`. The reference potion uses `ModPotionTemplate`, `CanonicalVars`, and `OnUse`. Set `PotionUsage` and `TargetType` explicitly. Use the game's target validation before applying an effect to a targeted creature.

`RegisterCharacterStarterPotion` adds starting inventory for a character. Add it only when the player requests starting potions. The reference uses it to make runtime acceptance direct.

## Localization

Game model text uses the game localization tables inside the consumer PCK:

```text
ExampleCard/localization/eng/cards.json
ExampleCard/localization/zhs/cards.json
```

The keys use the normalized public entry:

```json
{
  "EXAMPLE_CARD_FOCUSED_STRIKE.title": "Focused Strike",
  "EXAMPLE_CARD_FOCUSED_STRIKE.description": "Deal {Damage} damage."
}
```

Potion text uses `potions.json`. A targeted potion can also define `.selectionScreenPrompt` beside `.title` and `.description`.

The RitsuLib I18N system serves mod UI strings. Embedded I18N resources do not automatically populate the game model tables.

## Asset profiles

Use `CardAssetProfile` for card art instead of a UI patch:

```csharp
public override CardAssetProfile AssetProfile => new()
{
    PortraitPath = "res://ExampleCard/images/cards/focused_strike.png",
};
```

The path must exist in the consumer PCK. RitsuLib can provide a fallback when the resource is missing, but a fallback does not prove that the intended asset loaded.

`PotionAssetProfile` has `ImagePath` and `OutlinePath`. Match both paths to packaged assets.

Profiles also cover characters, relics, powers, orbs, monsters, encounters, and events. Use the upstream asset guide for the exact fields.

## Gameplay APIs

RitsuLib also provides templates and registration for relics, potions, powers, characters, monsters, encounters, events, acts, orbs, and ancients. A type's presence does not prove that this repository has an accepted example for that capability.

Use `DamageCmd.Attack` for the reference attack. The old helper `CommonActions.CardAttack` is not part of the game or RitsuLib.

## Sources

- `reference/example_card/`
- `reference/example_potion/`
- `reference/ritsulib-wiki/getting-started.md`
- `reference/ritsulib-wiki/content-authoring-toolkit.md`
- `reference/ritsulib-wiki/localization-and-keywords.md`
- `reference/ritsulib-wiki/asset-profiles-and-fallbacks.md`
- R0 through R2 runtime measurements on 2026-10-25.
