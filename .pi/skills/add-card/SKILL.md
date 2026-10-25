---
name: add-card
description: 'Use when the player wants to add a card. Covers registration, values, upgrade, localization, portrait, PCK, and in-game acceptance. Not for relics, creatures, or environment setup.'
---

# Add a card

**Goal**: Produce one RitsuLib card and prove its behavior in the game.

## Required input

| Input | Example |
|---|---|
| Cost | 1 |
| Rarity | Common |
| Pool | IroncladCardPool |
| Card type and target | Attack and AnyEnemy |
| Base value and upgrade | 6 damage and 9 after upgrade |
| English and Chinese text | Focused Strike and its Chinese translation |
| Portrait | One 8-bit RGB or RGBA PNG |

Use `reference/example_card/` as the accepted reference. Read `docs/ritsulib.md` and `docs/pck.md` for the rules.

## Steps

1. Copy `reference/example_card/` into `your_mods/<mod name>/`.

2. Change the mod identity everywhere:
   - `<AssemblyName>` in the csproj.
   - The namespace in `Entry.cs`.
   - The manifest file name and `id`.
   - The resource root under `assets/<ModId>/`.

3. Change the card definition in `FocusedStrike.cs`:
   - Set `FullPublicEntry` to a unique stable entry.
   - Set cost, rarity, type, target, and pool.
   - Set `CanonicalVars` and `CanonicalTags`.
   - Implement `OnPlay` with game APIs.
   - Implement `OnUpgrade` when the card upgrades.

   Use `DamageCmd.Attack` for the reference attack. Check another effect with `inspect_game_api` before writing it.

4. Update both localization files:

   ```text
   assets/<ModId>/localization/eng/cards.json
   assets/<ModId>/localization/zhs/cards.json
   ```

   Use the normalized public entry for `.title` and `.description`. Keep `{Damage}` equal to the dynamic variable name.

5. Replace the portrait under `assets/<ModId>/images/cards/`. Set `CardAssetProfile.PortraitPath` to the same `res://` path.

   Keep `has_pck: true`. The packer generates the required CTEX and import remap. Do not add a runtime portrait patch.

6. Run `validate_mod modDir=your_mods/<mod name>`.

   Confirm that compilation and `pckBuild` both pass. If the result is PARTIAL, fix the prerequisite and run it again.

7. Follow `mod-installer` for installation, restart, and load checks. Then return to the acceptance list below.

   Enable the mod in Mod Settings if it is grey or skipped. Start a new Ironclad run for the reference card. Another pool can require a different character or encounter.

## Acceptance

- The card registers exactly once in the intended pool.
- The starting deck contains the expected number of cards when the reference patch is used.
- The title and description render in English and Chinese.
- The intended portrait renders in the library, inspection, hand, and combat.
- The library discovery patch reports `discovered=True` when used.
- The unupgraded card deals the expected damage.
- The upgraded card deals the expected upgraded damage.
- The log contains no duplicate registration, missing resource, or patch failure.

Read `docs/traps.md` when a symptom remains. A successful build does not prove registration, rendering, or combat behavior.
