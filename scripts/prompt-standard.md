# English writing standard for maintainers

This file is a maintainer rulebook. It is not part of the product guide. Use it before changing AGENTS, docs, SKILL, tool metadata, or tool text.

## 1. Scope

Applies to:

1. `AGENTS.md` and `README.md`.
2. `.pi/skills/*/SKILL.md` and frontmatter descriptions.
3. `docs/**/*.md`.
4. `vendor/*/README.md` and `THIRD_PARTY_LICENSES.md`.
5. Tool descriptions, prompt snippets, prompt guidelines, parameter descriptions, content, and errors.
6. `reference/ritsulib-wiki/INDEX.md` and `SOURCE.md`.

All hand-written product text must be English. Upstream guide snapshots contain only extracted English prose. Localized strings in code examples are data and can remain in their original language.

Does not apply to code comments, commit messages, generated build output, quoted logs, decompiled source, or localized game data. Tool text still follows the ASCII rule.

## 2. File roles

- `AGENTS.md`: product-side boundaries, environment facts, and maps. No maintainer paths.
- `docs/game.md`: official game behavior.
- `docs/ritsulib.md`: framework behavior.
- `docs/pck.md`: packaging behavior.
- `docs/traps.md`: symptoms and checks.
- `docs/decompile.md`: dump evidence.
- Capability SKILL: task inputs and procedures.
- `scripts/`: maintainer rules, sync tools, and tests.

One fact has one home. Do not repeat a complete rule in a SKILL when the owning document already holds it.

## 3. Language rules

1. Use one word for one concept.
2. Use one fact per sentence.
3. Use active voice and name the actor.
4. Put the condition before the action.
5. Keep steps at 20 words or fewer and descriptions at 25 words or fewer.
6. Use numbered steps for procedures.
7. Do not use semicolons in prose.
8. Do not use arrows or symbols instead of words.
9. Do not end a list with an open enumeration.
10. Keep paths, identifiers, commands, and log text inside backticks.

## 4. Tool text

1. Use English or ASCII. Quoted game text can keep its original encoding.
2. Use `PASS`, `WARN`, `FAIL`, or `PARTIAL` for business results.
3. Use `NEXT:` for a failure or partial result.
4. Do not put a full procedure in metadata or a result.
5. Use `throw` for an invalid call or an internal error.
6. Keep output within the context limit and preserve the `NEXT:` line.

## 5. Terms

| Concept | Use | Avoid |
|---|---|---|
| Repository root | `workspace root` | `repo root` |
| Any directory | `directory` | `folder` |
| Check a path or prerequisite | `check` | `verify` |
| Validate a mod with the tool | `validate_mod` | `lint` |
| Copy a mod into the game | `install` | `deploy` |
| Remove a file | `delete` | `remove` |
| Record a path in state | `record` | `save` |
| Framework | `RitsuLib` | any other current default |
| Packaged resource format | `PCK` | `asset pack` |
| Player content directory | `your_mods/` | `mods/` |

Keep literals such as `STS2-RitsuLib`, `ModCardTemplate`, `RegisterCard`, `CardAssetProfile`, `res://`, and `mod_manifest.json` verbatim.

## 6. Checks

Run:

```sh
node scripts/check-doc-refs.mjs
node scripts/check-prompt-standard-en.mjs
node scripts/sync-ritsulib-wiki.mjs --check
```

The machine check covers only part of the standard. Check terms, factual sources, and document roles by hand.
