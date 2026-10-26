---
name: 2d-art
description: 'Use when a mod needs a generated, resized, or checked PNG. Covers player-owned style, previews, card art, transparent icons, fitting, manifest records, PCK, and in-game image acceptance. Not for 3D models or Unity assets.'
---

# Create 2D art

**Goal**: Produce a player-approved PNG that meets the asset contract and displays correctly in the game.

## Player input

- The subject and style.
- Optional reference images.
- The asset type and intended mod.
- Any composition or background preference.

The player owns the style. Do not add style wording or a house style. Use the tool's fixed model and do not add a model parameter.

## Generate a preview

1. Choose a preview path under `your_mods/<mod>/.preview/`. Use a new file name for each attempt. Existing files are never overwritten.
2. Use `generate_2d_asset` with `action=generate`.
3. Use `background=opaque` for default card art and `background=transparent` for icons.
4. Use only `opaque` or `transparent` for these workflows. Do not pass a color value to generation.
5. Keep the approved prompt unchanged. Technical constraints about transparency, framing, and completeness are allowed.

The tool downloads the result immediately and records the attempt in `asset_manifest.jsonl`. Do not move the manifest into `assets/`. It is not installed with the mod.

## Inspect and fit

Inspect the image before using it. Check the complete subject, margins, and readability at the final size. An alpha channel alone does not prove transparency. Check for actual transparent pixels.

Use these defaults:

| Asset | Final image | Default alpha |
|---|---|---|
| Card | 1000x760 | Solid RGB |
| Relic | 128x128 and 256x256 | Transparent RGBA |
| Power | 128x128 and 256x256 | Transparent RGBA |
| Potion | 128x128 | Transparent RGBA |

Use `action=fit` with the target dimensions. Use `outputAlpha=opaque` for solid card art and `outputAlpha=preserve` for transparent icons. A fit background is a six-digit color when compositing is needed.

Use `cover` only when the whole subject remains visible. Use `contain` when cover would crop the subject. Contain may add side bands. Prefer a source with the target aspect ratio when full-bleed art is required.

Run `action=check` with `alpha=avoid` for card art and `alpha=prefer` for icons. Prefer solid card art and transparent Relic, Power, and Potion icons. Other valid alpha forms produce a warning, not a build failure. Check their actual appearance in the game.

## Install and accept

1. After the player approves a preview, place the final PNG under `assets/<ModId>/images/<kind>/`.
2. Match every `res://` path in code to the final asset.
3. Run `validate_mod`, then follow `mod-installer`.
4. Re-run `validate_mod` after changing art so the PCK is rebuilt, then reinstall.
5. Check image scale, margins, transparency, and text layout in the game.
6. For card art, check both hand and collection views. For icons, check their intended small and large displays.

A successful API call or PNG file does not prove that the final game asset is correct.
