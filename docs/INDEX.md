# docs/ index

Up: [`AGENTS.md`](../AGENTS.md).

These pages answer questions about **the game itself**. Each file has one job. Put a fact in the
file that owns it, and leave the other two with a one-line pointer.

| File | One job | Holds | Does not hold |
|---|---|---|---|
| [`game.md`](game.md) | **What the game is** | Mechanism, paths, formats, and rules of the game and of BaseLib. Every claim carries its source: a decompiled location, or a measurement with a date | Numbered procedures. Player-visible symptoms. Advice about what to do next |
| `cookbook.md` (lands in the next commit) | **How to reach a state** | One section per goal. It states the goal, then the numbered steps, then the evidence, then the cost. Evidence names the dump file and line, or the command and its output | Long explanations of mechanism. One sentence plus a pointer is enough |
| [`traps.md`](traps.md) | **What a strange symptom means** | A symptom index at the top, then one entry per trap: symptom, cause, how to check, and what it does **not** prove | Procedures. When the answer is a procedure, the entry points at a cookbook section |

## Which file a question belongs to

Ask in this order. The first match decides.

1. **"How does the game work, and where is that written?"** goes to `game.md`. Example: the loader
   reads every `.json` in the mods directory, so a mod directory may hold one manifest.
2. **"I want the game to be in state X. What do I do?"** goes to `cookbook.md`. Example: a card
   needs a picture, and the mod ships no PCK.
3. **"Something is wrong and nothing crashed. What is it?"** goes to `traps.md`. Example: the model
   count went up and the card still has no name.

A question that matches two of them gets a full answer in the higher-priority file and one pointer in
the other.

## Rules for all three

1. **One fact, one home.** If two files must mention the same fact, only one explains it.
2. **Every claim names its source.** A decompiled location is
   `~/decompiled/sts2/<build>/cs/<assembly>/<file>.cs:<line>`. A measurement names the date and the
   observation. A claim with no source is a guess and does not belong in these pages.
3. **Do not keep a claim you cannot check.** A statement that the code no longer supports, or that
   nobody can measure, gets deleted. Rewriting it as "may" or "probably" is not allowed.
4. **`game.md` stays short.** When a section grows a numbered list, or the file passes roughly 120
   lines, that section is a procedure. Move it to `cookbook.md` and leave a pointer.
5. **`traps.md` stays a map.** Its first table is how a reader who only knows the symptom finds the
   entry. An entry that has no symptom is not a trap.

## Related

- The English writing rules for every one of these pages: [`prompt-standard.md`](prompt-standard.md).
- The official BaseLib wiki has a verbatim snapshot in
  [`../reference/base-lib-wiki/`](../reference/base-lib-wiki/INDEX.md). Read that `INDEX.md` first,
  and pick the page from what the player needs. Its code samples are not copy-pasteable: check every
  signature against the dump or `inspect_game_api`. The source commit and the version are in `SOURCE.md`.
