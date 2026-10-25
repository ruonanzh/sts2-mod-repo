## Use Profiles First

When a template exposes `AssetProfile`, put paths there instead of patching UI nodes.

```csharp
public sealed class MyCard : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
    public override CardAssetProfile AssetProfile => new()
    {
        PortraitPath = "res://MyMod/images/cards/my_card.png",
        EnergyIconPath = "res://MyMod/images/ui/energy_orange.png",
        FrameMaterialPath = "res://MyMod/materials/card_frame_orange.tres",
    };
}
```

RitsuLib reads only non-empty fields. Missing fields keep the base game value or the template fallback.

For cards, texture fields cover portrait, beta portrait, frame, portrait border, energy icon, banner, overlay scene, and
ancient-only border/title banner/text background. Material fields are available for portrait, frame, portrait border,
energy icon, banner, ancient border, ancient title banner, and ancient text background; direct `Material` instance fields
can be used when a material should be created in code instead of loaded from a resource path. Set
`VisualStyle = CardVisualStyle.Ancient` to force the ancient card layout without changing gameplay rarity, or
`CardVisualStyle.Standard` to force the normal layout for an ancient-rarity card. `ContentAssetProfiles.AncientCard(...)`
sets `CardVisualStyle.Ancient` for you.


## Supported Profiles

| Content | Profile |
| --- | --- |
| Card | `CardAssetProfile` |
| Relic | `RelicAssetProfile` |
| Power | `PowerAssetProfile` |
| Orb | `OrbAssetProfile` |
| Potion | `PotionAssetProfile` |
| Affliction | `AfflictionAssetProfile` |
| Enchantment | `EnchantmentAssetProfile` |
| Act | `ActAssetProfile` |
| Monster | `MonsterAssetProfile` |
| Encounter | `EncounterAssetProfile` |
| Event / ancient event layout | `EventAssetProfile` |
| Ancient map / run-history presentation | `AncientEventPresentationAssetProfile` |
| Rest site option | `RestSiteOptionAssetProfile` |
| Epoch portrait | `EpochAssetProfile` |
| Character | `CharacterAssetProfile` |

Use `ContentAssetProfiles.*(...)` only when you intentionally borrow a base-game path convention. For mod art, explicit `res://MyMod/...` paths are easier to review.


## Character Profiles

Character assets are grouped by purpose:

```csharp
public override CharacterAssetProfile AssetProfile => new()
{
    Scenes = new()
    {
        VisualsPath = "res://MyMod/scenes/characters/my_character_visuals.tscn",
        EnergyCounterPath = "res://MyMod/scenes/ui/my_energy_counter.tscn",
    },
    Ui = new()
    {
        CharacterSelectIconPath = "res://MyMod/images/character/select_icon.png",
        MapMarkerPath = "res://MyMod/images/character/map_marker.png",
    },
    Audio = new()
    {
        AttackSfx = "event:/MyMod/character_attack",
    },
};
```

`PlaceholderCharacterId` lets a partial profile borrow missing fields from a vanilla character. Use it as a temporary scaffold, then replace important visible assets before release.


## Missing Paths

Check resource paths before release. If a path is missing, RitsuLib logs a warning and keeps a fallback where one exists. Character visuals have fewer safe base-game fallbacks than cards or relics, so treat character path warnings as release blockers.
