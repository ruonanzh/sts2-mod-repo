# Managed-code decompilation

The local dump provides source evidence for game and RitsuLib APIs. It is not tracked in git.

## Location and coverage

The dump lives at:

```text
~/.gamer-agent-pi/decompiled/sts2-mod-repo/
```

The current dump covers `sts2` and these RitsuLib modules:

- `STS2-RitsuLib`
- `STS2-RitsuLib.Runtime`
- `STS2-RitsuLib.Shared`
- `STS2-RitsuLib.Ui`
- `STS2-RitsuLib.Settings`

The 2026-10-25 build contains 6069 top-level type files and uses about 30 MB. Nested types stay inside their enclosing files. Compiler-generated types are excluded.

## Configuration

`.pi/lib/decompile.json` lists the assemblies and vendor paths. `MANIFEST.json` records source hashes, the tool version, and the configuration signature.

Do not copy dump files into the repository. Cite them with paths such as:

```text
~/.gamer-agent-pi/decompiled/sts2-mod-repo/cs/<assembly>/<namespace>/<Type>.cs:<line>
```

## Reading and rebuilding

Use `inspect_game_code` for whole-tree questions:

- `action=status` checks freshness and coverage.
- `action=search` finds files and lines.
- `action=type` reads one type.
- `action=body` reads one member.
- `action=dump` rebuilds the configured dump.

Use `inspect_game_api` for one assembly without a full dump. It also reads members, IL, and string literals.

Rebuild when the game binary or RitsuLib version changes. The tool also rebuilds automatically when freshness checks fail.

## Incomplete coverage

A build with missing configured assemblies is PARTIAL. It is not a successful complete dump.

Freshness checks compare configured sources with recorded coverage. Automatic refreshes propagate the same incomplete state. A missing type or member cannot be inferred from an incomplete dump.

## Sources

- `.pi/lib/decompile.json`
- `.pi/lib/decompile.ts`
- `tools/api-probe/`
- R1 dump rebuild and incomplete-coverage tests on 2026-10-25.
