---
name: add-power
description: 'Use when the player wants to add a combat power. Covers application, stacking, triggers, icons, localization, PCK, and in-game acceptance. Not for cards, relics, or environment setup.'
---

# Add a power

**Goal**: Produce one RitsuLib power and prove its application and trigger in the game.

## Required input

| Input | Example |
|---|---|
| Power type | Buff |
| Stack behavior | Counter, with each stack granting the effect |
| Application | A 0-cost skill applies 1 stack, or 2 after upgrade |
| Trigger and effect | After an Attack, gain Block equal to the stacks |
| Applying card in starting deck | No addition, or a chosen character and card count |
| English and Chinese text | Momentum and its Chinese translation |
| Icon | One 8-bit RGB or RGBA PNG |

Use `mod-page` before copying the reference when a design choice needs player agreement. An unmentioned applying-card starting-deck addition means no addition.

Use `reference/example_power/` as the accepted reference. For additional items in the same mod, reuse the existing project and add only new model code and assets.

## Steps

1. Copy `reference/example_power/` into `your_mods/<mod name>/`.

2. Change the mod identity everywhere:
   - `<AssemblyName>` in the csproj.
   - Every C# namespace and the `RegisterModAssembly` owner ID. The owner ID must equal the manifest `id`.
   - Logger and Harmony IDs.
   - The manifest file name and `id`.
   - The resource root under `assets/<ModId>/`.

3. Read `docs/ritsulib.md` before changing registration. Rename source files and classes as needed. Source file names do not affect loading. Keep references and localization IDs consistent. Change the power definition:
   - Set `Type`, `StackType`, and `AssetProfile`.
   - Implement the requested trigger with game APIs.
   - Use `Amount` when each stack changes the effect.

   `RegisterPower` does not accept `FullPublicEntry` in this version. Use the full generated ID in `powers.json`.

4. Change `BuildMomentum.cs` or replace it with the requested application source:
   - Set what applies the power and the applied amount.
   - Implement any source upgrade behavior.
   - Keep `StartingDeckPatch.cs` only when the player requests an applying card in the starting deck. Otherwise, delete it.

   Check application and trigger APIs with `inspect_game_api`.

5. Update both localization files:

   ```text
   assets/<ModId>/localization/eng/powers.json
   assets/<ModId>/localization/zhs/powers.json
   ```

   Use the full generated ID for `.title` and `.description`. Use `{Amount}` for the current stack count.

   Update `cards.json` as well when the source is a card.

6. Read `docs/pck.md` before changing packaged assets. Replace the power icon and any source-card art.

   Keep `has_pck: true`. Match every `res://` path to a real source asset.

7. Run `validate_mod modDir=your_mods/<mod name>`.

   Confirm compilation, localization checks, and `pckBuild` pass. If the result is PARTIAL, fix the prerequisite and run it again.

8. Read `.pi/skills/mod-installer/SKILL.md` and complete its installation and load checks. Then return to the acceptance list below.

   Apply the power through its intended source. Trigger it more than once and check stacking.

## Acceptance

- The power and its application source register exactly once.
- The source applies the requested amount.
- The requested character has the requested number of applying cards when a starting-deck addition is requested.
- No starting-deck addition exists when the player did not request one.
- The title and description render in English and Chinese.
- The intended icon and stack count render correctly.
- Each trigger produces the requested behavior.
- Stacking or duration follows the request.
- Any source upgrade changes the applied amount as requested.
- The power and its behavior remain correct after save and reload.
- The log contains no duplicate registration, missing resource, or patch failure.

Read `docs/traps.md` when a symptom remains. A successful build does not prove application, rendering, or trigger behavior.
