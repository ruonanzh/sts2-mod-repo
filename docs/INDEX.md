# docs/ index

Up: [`AGENTS.md`](../AGENTS.md). This directory holds the mechanics, paths, and traps of **the game
itself** only.

| File | What it covers |
|---|---|
| [`game.md`](game.md) | Load flow, the 10 keys of the manifest, the entry point contract, the path table, the global load switch, assets and art. BaseLib content extension (`[Pool]` required, two localization options, where the wiki snapshot is) |
| [`traps.md`](traps.md) | **The 14 traps hit most easily**: most of them fail silently. Read this page first when you debug |
| [`prompt-standard.md`](prompt-standard.md) | The English writing rules for every text an agent reads: the two modes, the sentence rules, the term table. Read it before you write a skill or a tool description |

The official BaseLib wiki has a verbatim snapshot in
[`../reference/base-lib-wiki/`](../reference/base-lib-wiki/INDEX.md). Read that `INDEX.md` first,
and pick the page from what the player needs. Then use `inspect_api` to find the real name. The
source and the version are in that `SOURCE.md`.
