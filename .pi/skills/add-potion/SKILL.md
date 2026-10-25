---
name: add-potion
description: 'Use when the player wants to add a potion. Covers pools, usage, targets, effects, starting potions, localization, icons, PCK, and in-game acceptance. Not for cards, relics, powers, or environment setup.'
---

# Add a potion

**Goal**: Produce one RitsuLib potion and prove its effect in the game.

## Required input

| Input | Example |
|---|---|
| Rarity | Common |
| Pool | IroncladPotionPool |
| Usage | Combat only |
| Target | Any player |
| Effect and value | Gain 6 Block |
| Starting potions | No addition, or a chosen character and count |
| English and Chinese text | Aegis Draught and its Chinese translation |
| Icon | One 8-bit RGB or RGBA PNG |

Use `mod-page` before implementation when a design choice needs player agreement. An unmentioned starting-potion addition means no addition.

For additional items in the same mod, reuse the existing project and add only new model code and assets.

## Steps

1. MUST study `reference/example_potion/` before implementation. Understand its project structure and working potion implementation.

2. Create a new project in `your_mods/<mod name>/` or adapt the reference when useful.

3. Change the mod identity everywhere:
   - `<AssemblyName>` in the csproj.
   - Every C# namespace and the `RegisterModAssembly` owner ID. The owner ID must equal the manifest `id`.
   - Logger and Harmony IDs.
   - The manifest file name and `id`.
   - The resource root under `assets/<ModId>/`.

4. Read `docs/ritsulib.md` before changing registration. Rename the source file and class as needed. Source file names do not affect loading. Keep references and localization IDs consistent. Implement the potion:
   - Set a unique `FullPublicEntry`, rarity, pool, `Usage`, `TargetType`, `CanonicalVars`, and `AssetProfile`.
   - Implement the requested effect in `OnUse`.
   - Use the game's target validation for a targeted potion.
   - Add `RegisterCharacterStarterPotion` only when the player requests starting potions. Otherwise, ensure no starting-potion addition exists.

   Check usage, targeting, and effect APIs with `inspect_game_api` before writing them.

5. Write both localization files:

   ```text
   assets/<ModId>/localization/eng/potions.json
   assets/<ModId>/localization/zhs/potions.json
   ```

   Use the normalized public entry for `.title` and `.description`. Add `.selectionScreenPrompt` when the potion needs a target prompt. Keep placeholders equal to the dynamic variable names.

6. Read `docs/pck.md` before changing packaged assets. Create the icon under `assets/<ModId>/images/potions/`.

   Reference art may be used as a placeholder. Replace it when the player provides final art.

   Keep `has_pck: true`. Match `PotionAssetProfile.ImagePath` and `OutlinePath` to real packaged assets.

7. Run `validate_mod modDir=your_mods/<mod name>`.

   Confirm compilation, potion localization, and `pckBuild` pass. If the result is PARTIAL, fix the prerequisite and run it again.

8. Read `.pi/skills/mod-installer/SKILL.md` and complete its installation and load checks. Then return to the acceptance list below.

   Start a new run with the chosen character when starting potions were requested. Otherwise, obtain the potion through its normal acquisition path. Use it in an allowed context and select the intended target when required.

## Acceptance

- The potion registers exactly once in the intended pool.
- The requested character has the requested number of starting potions when requested.
- No starting-potion addition exists when the player did not request one.
- The title, description, and target prompt render correctly in English and Chinese.
- The intended icon and outline render correctly.
- The potion can be used only in the requested contexts.
- The effect applies to the intended target with the requested value.
- The potion is consumed once after use.
- Inventory and behavior remain correct after save and reload.
- The log contains no duplicate registration, missing resource, or patch failure.

Read `docs/traps.md` when a symptom remains. A successful build does not prove registration, rendering, targeting, or potion behavior.
