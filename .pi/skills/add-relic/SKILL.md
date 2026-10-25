---
name: add-relic
description: 'Use when the player wants to add a relic. Covers pools, triggers, values, starting relics, localization, icons, PCK, and in-game acceptance. Not for cards, powers, or environment setup.'
---

# Add a relic

**Goal**: Produce one RitsuLib relic and prove its trigger in the game.

## Required input

| Input | Example |
|---|---|
| Rarity | Common |
| Pool | IroncladRelicPool |
| Trigger | Before combat starts |
| Effect and value | Gain 4 Block |
| Starting relics | No addition, or add to a chosen character |
| English and Chinese text | Aegis Shard and its Chinese translation |
| Icon | One 8-bit RGB or RGBA PNG |

Use `mod-page` before copying the reference when a design choice needs player agreement. An unmentioned starting-relic addition means no addition.

Use `reference/example_relic/` as the accepted reference.

## Steps

1. Copy `reference/example_relic/` into `your_mods/<mod name>/`.

   Keep and adapt `StartingRelicPatch.cs` only when the player requests a starting relic. Otherwise, delete it.

2. Change the mod identity everywhere:
   - `<AssemblyName>` in the csproj.
   - The namespace in `Entry.cs`.
   - The manifest file name and `id`.
   - The resource root under `assets/<ModId>/`.

3. Read `docs/ritsulib.md` before changing registration. Change `AegisShard.cs`:
   - Set `FullPublicEntry` to a unique stable entry.
   - Set rarity, pool, `CanonicalVars`, and `AssetProfile`.
   - Implement the requested trigger with game APIs.

   Check the trigger and effect with `inspect_game_api` before writing them. Do not copy a hook blindly.

4. Update both localization files:

   ```text
   assets/<ModId>/localization/eng/relics.json
   assets/<ModId>/localization/zhs/relics.json
   ```

   Use the normalized public entry for `.title` and `.description`. Keep placeholders equal to the dynamic variable names.

5. Read `docs/pck.md` before changing packaged assets. Replace the icon under `assets/<ModId>/images/relics/`.

   Keep `has_pck: true`. Use the same `res://` path in `RelicAssetProfile` for each intended icon field.

6. Run `validate_mod modDir=your_mods/<mod name>`.

   Confirm compilation, localization checks, and `pckBuild` pass. If the result is PARTIAL, fix the prerequisite and run it again.

7. Read `.pi/skills/mod-installer/SKILL.md` and complete its installation and load checks. Then return to the acceptance list below.

   If a starting relic was requested, start a new run with that character. Otherwise, obtain the relic through its normal acquisition path.

## Acceptance

- The relic registers exactly once in the intended pool.
- The requested character has the starting relic when requested.
- No starting-relic addition exists when the player did not request one.
- The title and description render in English and Chinese.
- The intended icon renders at its small and large sizes.
- The trigger produces the requested effect and value.
- The relic and its behavior remain correct after save and reload.
- The log contains no duplicate registration, missing resource, or patch failure.

Read `docs/traps.md` when a symptom remains. A successful build does not prove registration, rendering, or trigger behavior.
