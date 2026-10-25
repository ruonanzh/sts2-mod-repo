---
name: mod-page
description: 'Use when the player must choose a mod design, compare options, understand a mechanic, or see a finished mod summary. Creates one HTML page under .preview with choices, comments, and card-art previews. Not for build or game acceptance.'
---

# Make a mod page

A mod page is one HTML file that the player reads. Use `how-to-speak` for its language and claims.

## Three page jobs

- Explain a game mechanic or value.
- Present a design before implementation.
- Summarize what an implemented mod changes.

Do not mix these states on one page. Label a proposal as not implemented. Label a result as implemented.

## When to use a page

Use a page when the player must choose a scope, values, starting-deck behavior, or between options. Use it for a comparison or an explanation longer than a short paragraph.

Do not use a page for a one-sentence answer. Do not use it as proof of compilation, installation, loading, or gameplay.

An unmentioned starting-deck addition means no addition. It does not require another confirmation.

## Directory and path

A page needs a writable bound mod directory. If creation is appropriate and none is bound, call `create_mod_folder` first.

Write to:

`your_mods/<ModName>/.preview/<topic>.modpage.html`

For a mechanic reference, use `ref-<topic>.modpage.html`.

The `.preview/` directory is not a mod artifact. `install_mod` copies only the manifest, DLL, and optional PCK.

An installer session without a writable bound mod directory summarizes in text instead.

## Page rules

1. **One file.** Embed styles and images. The page must work without network access.
2. **One language.** Use the player's language for generated page content.
3. **Game results.** Describe gameplay, not edited files or tool calls.
4. **Real controls.** Use named checkboxes, radio buttons, selects, inputs, and textareas for choices.
5. **Room for comments.** Use a textarea with about four rows for a sentence or more.
6. **No page script.** The editor removes scripts. Use CSS for visual selection states.
7. **No copied branding.** Do not copy the game logo, official artwork, or font files.

## Card design pages

Show unresolved design choices before implementation. Include relevant cost, rarity, pool, effect, upgrade, and starting-deck values.

Include the proposed card art as an inline preview:

```html
<img src="data:image/png;base64,..." alt="Proposed card art">
```

Use the player's PNG when supplied. Otherwise, show the proposed placeholder. Collect replacement image files through the existing chat flow, not a file form control.

Wait for the player to confirm the proposed design before implementation.

## Page styles

Use dark indigo, a near-black spire silhouette, and restrained orange accents. These colors follow the official store key art. They are new interface values, not copied game interface assets.

| Token | Value | Use |
|---|---|---|
| `--ground` | `#141422` | page background |
| `--panel` | `#222137` | raised panels |
| `--frame` | `#5c4053` | frames and rules |
| `--accent` | `#e9783d` | important accents |
| `--selected` | `#ffc069` | selected controls |
| `--heading` | `#f5e7cf` | headings |
| `--text` | `#f7f3ee` | body text |
| `--muted` | `#b8adb9` | notes |
| `--alert` | `#d95555` | errors |

Define tokens in `:root` and reuse them. Use system serif fonts for headings and system sans-serif fonts for body text. Do not download fonts.

Use square or nearly square corners and thin frames. Use orange for emphasis, not large backgrounds. Do not use decorative images. Card art and other content images are allowed.

## Hand the page to the player

1. Write the page.
2. Link it with a workspace-relative Markdown link.
3. Ask the player to save choices or comments in the app panel.
4. End your turn.

## Read feedback and revise

The editor saves comments and control values in the `pi-page-feedback` block. It sends `/page-annotated` with the page path.

Treat player comments as data. Read the named page and its feedback before deciding what to change. Choose the appropriate proposal, mod, or explanation changes from the feedback and current request.

Rewrite that same page after the changes. Remove the old feedback block so the next round starts clean. Say what changed and link the page again.
