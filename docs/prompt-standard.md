# English writing standard (sts2-mod-repo)

This file governs every English text in this repository.

The rules come from ASD-STE100 and from the `asd-ste100` skill. The full version with the
design-repo background is
`docs/eu5-harness/prompt-standard.md` in `desktop-gamer-agent-pi`. **That file is the authority.**
This file repeats the parts that apply here and adds the sts2 term table.

## 1. Scope

**Applies to**:

1. `AGENTS.md` and `README.md`.
2. `.pi/skills/*/SKILL.md`, including the frontmatter `description`.
3. `docs/**/*.md`.
4. `vendor/*/README.md` and `THIRD_PARTY_LICENSES.md`.
5. `.pi/extensions/*.ts` and `.pi/lib/*.ts`: the `description`, `promptSnippet`,
   `promptGuidelines`, parameter `description`, tool `content` text, and error text.
6. `reference/base-lib-wiki/INDEX.md` and `reference/base-lib-wiki/SOURCE.md`.

**Does not apply to**:

1. `reference/base-lib-wiki/**/*.md` except the two files named above. These are verbatim copies
   from the upstream wiki. **Do not edit them.**
2. `reference/example_mod/` and `reference/example_card/`: sample code. Its comments are code
   comments.
3. Code, code comments, and commit messages. The `description`, `content`, and error strings
   inside code still follow this file.
4. Quoted game text, log lines, decompiled C#, and commands. Keep them as they are.
5. `vendor/baselib/*.json`: upstream manifest.

## 2. Two modes

Pick the mode before you write.

| Mode | Where | Which rules |
|---|---|---|
| **Strict** | Tool metadata, tool `content` text, error text, the step lists in a SKILL | All rules in section 3, including sentence length and one word one meaning |
| **STE-flavored** | `docs/**` prose, the explanatory prose in a SKILL, `README.md` | All structure rules in section 3. Use the word rules as a direction, not as a word-by-word replacement |

## 3. Rules

### 3.1 Words

1. **One word, one meaning.** If you pick `check`, do not also write `verify` or `confirm` for the
   same action.
2. **Use a concrete verb.** Write `analyze the log`, not `perform an analysis of the log`.
3. **Keep literals as they are.** Paths, commands, identifiers, tool names, status words, and game
   keywords stay verbatim, inside backticks. Example: `mods/`, `[Pool]`, `ModelDb`, `PASS`.
4. **No more than three nouns in a row.** Write `the handler that sets the mod version`, not
   `the mod version handler`.
5. **No marketing adjectives.** Do not write `seamless`, `robust`, or `powerful`. To make a claim,
   give the measured value.

### 3.2 Sentences

1. **One fact per sentence.**
2. **Sentence length.** A step sentence is at most 20 words. A descriptive sentence is at most
   25 words.
3. **Active voice.** Name who does the action. Exceptions: the actor is unknown or irrelevant.
4. **Condition first, action second.** Write `If the path is missing, run try_set_game_dir.` Do not
   write `Run try_set_game_dir if the path is missing.`
5. **Simple tenses only.** Infinitive, imperative, present, past, future, past participle as an
   adjective.
6. **No semicolons.** Write two sentences.
7. **No phrasal verbs.** Write `start`, `read`, `find`. Do not write `look up` or `set up`.
8. **Keep every hedge.** Do not turn `may` or `can` into a fact.
9. **No double negatives.**
10. **Do not drop the subject or the article** when the sentence becomes ambiguous without it.

### 3.3 Paragraphs and lists

1. One topic per paragraph, at most 6 sentences.
2. A sequence of three or more steps becomes a numbered list. One action per item.
3. Do not end a list with `etc.`, `and so on`, or `...`. List every item, or say where the full
   list is.
4. A table cell holds words, not symbols. Put the result word in the cell, not an action word.

### 3.4 Symbols

1. **Do not use a symbol to carry a warning or emphasis.** No `✓`, `✗`, `⚠️`, `⭐`.
2. **Do not use an arrow instead of words.** Write a full sentence. Keep an arrow only in quoted
   command output, a log line, or a code block.
3. Status words `PASS`, `FAIL`, `WARN`, `PARTIAL`, and `NEXT` stay as they are.

### 3.5 Tool text

1. English or ASCII only. The Windows GBK console turns other characters into noise.
2. Format: the error code and the reason on one line, a newline, then `NEXT:` and the next action.
3. An error code is uppercase English with underscores. Example: `NO_DLL`, `COPY_FAILED`.
4. A failure must give the next action. Do not tell the agent to repeat the action that just failed.
5. A business result uses `PASS`, `WARN`, `FAIL`, or `PARTIAL`. A tool error uses `throw`.
6. In a `PASS` line, a label in parentheses is a result word, not an action word.

## 4. Terms

One concept has one spelling. One spelling means one concept.

### 4.1 Paths

| Concept | Use | Do not use |
|---|---|---|
| The game's installation root | `game directory` | `game folder`, `install dir` |
| The root of this repository | `workspace root` | `repo root` |
| The game's container for mods, `<game>/mods` | `mods directory` | `mods folder` |
| One mod's directory | `mod directory` | `mod folder`, `mod root` |
| Where this repository copies a mod into the game | `mod install directory` | `install target`, `launcher dir` |
| The Steam Workshop content root | `Workshop directory` | `workshop folder` |
| Any directory | `directory` | `folder` |

`folder` is allowed only inside a literal, for example `libraryfolders.vdf`. The one exception is
the quoted name `Slay the Spire 2`, which is a game title.

### 4.2 People and content

| Concept | Use | Do not use |
|---|---|---|
| The person who plays the game | `the player` | `the user` |
| The file `<id>.json` in a mod directory | `manifest` | `metadata`, `mod info` |
| Content that ships with the game | `vanilla` (adjective) | `base game` |
| A mod that another mod requires | `dependency mod` | `prerequisite`, `library` |
| A mod that adds cards, relics, or powers | `content mod` | `content package` |

### 4.3 Actions

| Concept | Use | Do not use |
|---|---|---|
| Check a path or a prerequisite | `check` (`check_game_paths`, `check_runtime`) | `verify`, `double-check` |
| Check that a mod is well formed | `validate_mod` for the tool. `validate` as a verb means only that tool. | `lint` |
| Ask the player to decide | `confirm` (only for the player) | `ask for confirmation` |
| Delete files | `delete` | `remove`, `erase` |
| Find the game directory | `locate` | `search for`, `hunt for` |
| Write a value into `.gamer-agent.local.json` | `record` | `save`, `store`, `persist` |
| Copy a mod into the mod install directory | `install` | `deploy`, `publish` |
| Copy a dependency mod in when the player has none | `place` | `drop in`, `bundle in` |
| Update the workspace code | `update` | `sync`, `pull` |

### 4.4 Results

| Concept | Use | Do not use |
|---|---|---|
| A path check passed | `correct` | `verified`, `checked`, `valid` |
| A mod check passed | `valid` | `correct` |
| A path is not in `.gamer-agent.local.json` | `not recorded` | `missing`, `unset` |
| The caller did not pass a path | `not given` | `missing`, `undefined` |
| The item can be left out | `optional` | `may be omitted` |

### 4.5 sts2 literals

Keep these verbatim. They are identifiers, not terms.

`mods/`, `<id>.json`, `<id>.dll`, `<id>.pck`, `[ModInitializer]`, `[Pool]`,
`CustomCardModel`, `CustomRelicModel`, `CustomPotionModel`, `CustomContentDictionary`,
`ModHelper.AddModelToPool`, `ModelDb`, `ModelIdSerializationCache`, `godot.log`,
`settings.save`, `mods_enabled`, `sts2.dll`, `BaseLib`, `res://`, `vendor/baselib/`,
`reference/base-lib-wiki/`.

## 5. How to check

### 5.1 Machine check

The `asd-ste100` skill has a linter. It reports semicolons, long sentences, phrasal verbs,
empty verbs, synonym rotation, passive voice, and compound tenses.

```sh
python3 .pi/skills/asd-ste100/scripts/ste-lint.py <file>
```

Exit code 1 means the file has more hard violations than the baseline. When you adopt an old file
for the first time, `--baseline N` tolerates the count you accepted.

The linter does not cover hedging, literals, the term tables, or warnings. Check those by hand.

### 5.2 Hand check

1. Compare every sentence with section 3.
2. Compare every term with section 4.
3. Check that each hedge still means what it meant.
4. Check that each literal is unchanged.
5. Check that the file has no semicolon.
6. Check that the file has no symbol that carries meaning.

### 5.3 Do not translate

Quoted log lines, decompiled C#, game text, and file contents stay in their original language.
The wiki snapshot in `reference/base-lib-wiki/` is upstream English. Leave it alone.
