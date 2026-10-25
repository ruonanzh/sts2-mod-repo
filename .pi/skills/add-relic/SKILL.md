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

Use `mod-page` before implementation when a design choice needs player agreement. An unmentioned starting-relic addition means no addition.

For additional items in the same mod, reuse the existing project and add only new model code and assets.

## Steps

1. MUST study `reference/example_relic/` before implementation. Understand its project structure and working relic implementation.

2. Create a new project in `your_mods/<mod name>/` or adapt the reference when useful.

   Add or adapt `StartingRelicPatch.cs` only when the player requests a starting relic. Otherwise, ensure no starting-relic addition exists.

3. Change the mod identity everywhere:
   - `<AssemblyName>` in the csproj.
   - Every C# namespace and the `RegisterModAssembly` owner ID. The owner ID must equal the manifest `id`.
   - Logger and Harmony IDs.
   - The manifest file name and `id`.
   - The resource root under `assets/<ModId>/`.

4. Read `docs/ritsulib.md` before changing registration. Rename the source file and class as needed. Source file names do not affect loading. Keep references and localization IDs consistent. Change the relic definition:
   - Set `FullPublicEntry` to a unique stable entry.
   - Set rarity, pool, `CanonicalVars`, and `AssetProfile`.
   - Implement the requested trigger with game APIs.

   Check the trigger and effect with `inspect_game_api` before writing them. Do not copy a hook blindly.

5. Write both localization files:

   ```text
   assets/<ModId>/localization/eng/relics.json
   assets/<ModId>/localization/zhs/relics.json
   ```

   Use the normalized public entry for `.title` and `.description`. Keep placeholders equal to the dynamic variable names.

6. Read `docs/pck.md` before changing packaged assets. Create the icon under `assets/<ModId>/images/relics/`.

   Reference art may be used as a placeholder. Replace it when the player provides final art.

   Keep `has_pck: true`. Use the same `res://` path in `RelicAssetProfile` for each intended icon field.

7. Run `validate_mod modDir=your_mods/<mod name>`.

   Confirm compilation, localization checks, and `pckBuild` pass. If the result is PARTIAL, fix the prerequisite and run it again.

8. Read `.pi/skills/mod-installer/SKILL.md` and complete its installation and load checks. Then return to the acceptance list below.

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
