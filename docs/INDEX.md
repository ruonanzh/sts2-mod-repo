# docs/ index

Up: [`AGENTS.md`](../AGENTS.md).

Each file has one role. Keep game facts, framework facts, packaging, and symptoms separate.

| File | Role |
|---|---|
| [`game.md`](game.md) | The official loader, install paths, manifests, the mod switch, and save behavior |
| [`ritsulib.md`](ritsulib.md) | RitsuLib versions, initialization, registration, IDs, localization, assets, and runtime layout |
| [`pck.md`](pck.md) | PCK, CTEX, import remaps, resource paths, and the lightweight packer |
| [`traps.md`](traps.md) | Symptoms, causes, checks, and what each symptom does not prove |
| [`decompile.md`](decompile.md) | The managed-code dump, freshness, rebuilds, and source citations |

## Reading order

1. Start with `game.md` for the official loader and installation rules.
2. Read `ritsulib.md` before using framework registration or assets.
3. Read `pck.md` when the mod contains images, localization, scenes, or other packaged resources.
4. Use the task map in [`../reference/ritsulib-wiki/INDEX.md`](../reference/ritsulib-wiki/INDEX.md) for the upstream guide.
5. When something fails, use the symptom table in `traps.md`.

Every claim needs a source. Cite a decompiled file, an upstream page, or a measured result. Do not turn an untested assumption into a rule.

The RitsuLib guide contains only English prose. Localized strings remain inside code examples because they are data.
