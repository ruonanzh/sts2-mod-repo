import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runAsync } from "../lib/proc";
import { managedDirFor, readGameConfig, readModRepoConfig, readState } from "../lib/game-paths";
import { resolveApiSources, type ApiSource } from "../lib/api-sources";

/**
 * inspect_api -- find the exact name of a type, then read its source.
 *
 * The API surface a mod codes against spans more than one assembly. For Slay the Spire 2
 * a card inherits BaseLib's `CustomCardModel`, which itself inherits the game's
 * `CardModel`, so half the names a mod needs come from `sts2.dll` and half from
 * `BaseLib.dll`. A tool that can only see one of them invites guesses for the other half,
 * and a guess fails as CS0246/CS0012 without saying which of the two mistakes was made.
 * So this tool searches every assembly declared in mod-repo.json and labels each hit.
 *
 * Where the data comes from:
 *   - type names: `ilspycmd -l c <assembly>`, which is complete (6381 game types, 1015 in
 *     BaseLib) and takes about 0.3s per assembly.
 *   - summaries: the XML doc files next to each assembly. These are partial by nature -
 *     sts2.xml documents 15561 of 19635 members and BaseLib.xml omits CustomCardModel
 *     entirely - so a missing summary must never be read as a missing type. That is why
 *     search matches type names only, never summary text.
 */

interface DocIndex {
  byName: Map<string, string>;
}

function plain(xml: string): string {
  return xml
    .replace(/<see cref="[^:]+:([^"]+)"\s*\/>/g, (_m, ref: string) => ref.split(".").pop() ?? ref)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Merge the doc files of every source. Namespaces differ, so member names cannot collide. */
function readDocIndex(sources: ApiSource[]): DocIndex {
  const byName = new Map<string, string>();
  for (const src of sources) {
    if (!src.docPath) continue;
    let text: string;
    try {
      text = readFileSync(src.docPath, "utf8");
    } catch {
      continue;
    }
    const chunks = text.split('<member name="');
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      const nameEnd = chunk.indexOf('"');
      if (nameEnd < 0) continue;
      const name = chunk.slice(0, nameEnd);
      const sumStart = chunk.indexOf("<summary>");
      if (sumStart < 0) continue;
      const sumEnd = chunk.indexOf("</summary>", sumStart);
      if (sumEnd < 0) continue;
      byName.set(name, plain(chunk.slice(sumStart + "<summary>".length, sumEnd)));
    }
  }
  return { byName };
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

interface SourceIndex {
  source: ApiSource;
  names: string[];
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "inspect_api",
    label: "Inspect API",
    description:
      "Read the exact type names and C# source that a mod codes against, across every assembly the repository declares: the game (sts2.dll) and its standard framework (BaseLib.dll). Action search lists type names containing the query and tags each hit with the assembly it came from, attaching the assembly's own documentation summary when one exists. Action source decompiles one type in full, including private members and signatures. Use it before writing code that touches a game or BaseLib type, because a guessed name fails at build time with CS0246 or CS0012, which does not say whether the name is wrong or an assembly is missing. It only reads files and never loads or runs an assembly.",
    promptSnippet: "Look up exact type names across the game and BaseLib before writing mod code",
    promptGuidelines: [
      "Call inspect_api before you write code that touches a game or BaseLib type. Do not guess type names; the two assemblies carry different halves of what a card needs.",
      "Use action=search with a short substring of the type name, then action=source with the exact name that search returned. Search matches type names only, because the assemblies are the only complete source.",
      "A type with no summary line is still real. The documentation files are partial: sts2.xml covers 15561 of 19635 members and BaseLib.xml omits CustomCardModel. Never read a missing summary as a missing type.",
      "If a hit is tagged baselib, the mod must reference BaseLib and the manifest must declare it in dependencies. Inheriting a BaseLib type also requires sts2.dll, because BaseLib's types derive from the game's types.",
      "When you learn something this way, write the fact and the query you used into docs/, so the next session does not repeat it.",
    ],
    parameters: Type.Object({
      action: Type.String({
        description: 'One of "search" or "source".',
      }),
      query: Type.Optional(
        Type.String({
          description: 'For action=search: a substring of a type name, for example "CustomCard" or "CardModel".',
        }),
      ),
      typeName: Type.Optional(
        Type.String({
          description:
            'For action=source: the full type name, for example "MegaCrit.Sts2.Core.Models.CardModel" or "BaseLib.Abstracts.CustomCardModel".',
        }),
      ),
      assembly: Type.Optional(
        Type.String({
          description:
            'Restrict to one label: "game" or "baselib". Default "all", which is what you normally want because a card needs names from both.',
        }),
      ),
      limit: Type.Optional(Type.Number({ description: "Maximum results for search. Default 30, maximum 200." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const repoRoot = ctx.cwd;
      const state = readState(repoRoot);
      const cfg = readModRepoConfig(repoRoot);
      const gameDir = typeof state.gameDir === "string" ? state.gameDir : null;
      const managed =
        typeof state.managedDir === "string" && state.managedDir
          ? state.managedDir
          : gameDir
            ? managedDirFor(gameDir, cfg)
            : null;

      // Which assemblies to search, from the contract file only.
      let references: string[] = [];
      let packages: { id: string; label: string; assembly: string; docs?: string }[] = [];
      try {
        const raw = readGameConfig(repoRoot) as {
          assemblies?: string[];
          packages?: { id: string; label: string; assembly: string; docs?: string }[];
        };
        references = raw.assemblies ?? [];
        packages = raw.packages ?? [];
      } catch {
        /* fall through with empty lists; the note below explains it */
      }

      const { sources, notes } = resolveApiSources({ managedDir: managed, references, packages });
      const wanted = (params.assembly ?? "all").trim().toLowerCase();
      const active = wanted === "all" ? sources : sources.filter((s) => s.label === wanted);

      if (!active.length) {
        // Say which prerequisite is missing, not both: the two have different fixes.
        const gameMissing = !managed || !existsSync(managed);
        const pkgMissing = packages
          .filter((p) => !sources.some((s) => s.label === p.label))
          .map((p) => p.id);
        const next: string[] = [];
        if (gameMissing) next.push("run try_set_game_dir so the game's data directory is recorded");
        if (pkgMissing.length)
          next.push(
            `run dotnet restore in a mod that references ${pkgMissing.join(", ")} so the package is in the NuGet cache`,
          );
        return {
          content: [
            {
              type: "text",
              text: [
                `FAIL: no assembly to inspect${wanted === "all" ? "" : ` for label "${wanted}"`}.`,
                ...notes,
                `NEXT: ${next.length ? next.join(". Then ") : "run try_set_game_dir first"}.`,
              ].join("\n"),
            },
          ],
          details: { ok: false, reason: "NO_SOURCE", sources: sources.map((s) => s.label) },
        };
      }

      // ilspycmd: the repo pins it in .config/dotnet-tools.json, otherwise use a global install.
      const cached = state.runtime?.dotnet ?? state.dotnet;
      const dotnet = typeof cached === "string" && cached ? cached : "";
      const globalIlspy = dotnet ? join(dirname(dotnet), "tools", "ilspycmd") : "";
      const localManifest = join(repoRoot, ".config", "dotnet-tools.json");
      const useLocal = existsSync(localManifest) && Boolean(dotnet);
      const ilspy = useLocal ? dotnet : globalIlspy;
      const haveIlspy = Boolean(ilspy) && existsSync(ilspy);
      const ilspyArgs = (rest: string[]) => (useLocal ? ["tool", "run", "ilspycmd", ...rest] : rest);
      const ilspyEnv = dotnet
        ? { ...process.env, DOTNET_ROOT: dirname(dotnet), PATH: `${dirname(dotnet)}:${process.env.PATH ?? ""}` }
        : process.env;
      const installHint = useLocal
        ? 'run "dotnet tool restore" in the repository root (the version is pinned in .config/dotnet-tools.json)'
        : `install it once with "${dotnet || "dotnet"} tool install -g ilspycmd"`;

      const describe = (s: ApiSource) =>
        s.version ? `${s.label} (${s.assembly} ${s.version})` : `${s.label} (${s.assembly})`;

      // ---- source -------------------------------------------------------------
      if (params.action === "source") {
        const typeName = (params.typeName ?? "").trim();
        if (!typeName) {
          return {
            content: [
              {
                type: "text",
                text: "FAIL: action=source needs typeName.\nNEXT: run action=search with a substring of the name to get the exact spelling.",
              },
            ],
            details: { ok: false, reason: "NO_TYPE_NAME" },
          };
        }
        if (!haveIlspy) {
          return {
            content: [
              {
                type: "text",
                text: `FAIL: ilspycmd is not available, so source cannot be decompiled.\nNEXT: ${installHint}, then run source again.`,
              },
            ],
            details: { ok: false, reason: "NO_ILSPY" },
          };
        }
        const tried: string[] = [];
        for (const s of active) {
          try {
            const r = await runAsync(ilspy, ilspyArgs(["-t", typeName, s.dllPath]), {
              cwd: repoRoot,
              env: ilspyEnv,
              timeoutMs: 180_000,
            });
            const text = r.stdout.trim();
            if (!text) {
              tried.push(s.label);
              continue;
            }
            return {
              content: [{ type: "text", text: clip(text, 40_000) }],
              details: { ok: true, action: "source", typeName, foundIn: describe(s) },
            };
          } catch {
            tried.push(s.label);
          }
        }
        return {
          content: [
            {
              type: "text",
              text: `FAIL: no assembly searched defines ${typeName} (tried ${tried.join(", ")}).\nNEXT: run action=search with a substring of the name to get the exact spelling.`,
            },
          ],
          details: { ok: false, reason: "NOT_FOUND", typeName, tried },
        };
      }

      // ---- search -------------------------------------------------------------
      const query = (params.query ?? "").trim();
      if (!query) {
        return {
          content: [
            {
              type: "text",
              text: 'FAIL: action=search needs query.\nNEXT: pass a short substring of a type name, for example "CustomCard".',
            },
          ],
          details: { ok: false, reason: "NO_QUERY" },
        };
      }
      const limit = Math.min(Math.max(params.limit ?? 30, 1), 200);
      const q = query.toLowerCase();

      // Type names come from the assembly when ilspycmd is available, which is complete.
      // Without it, fall back to the doc file and say the list is partial.
      let indexed: SourceIndex[] = [];
      let degradedLabels: string[] = [];
      if (haveIlspy) {
        for (const s of active) {
          try {
            const r = await runAsync(ilspy, ilspyArgs(["-l", "c", s.dllPath]), {
              cwd: repoRoot,
              env: ilspyEnv,
              timeoutMs: 180_000,
            });
            const names = r.stdout
              .split("\n")
              .map((l) => l.replace(/^(Class|Struct|Interface|Enum|Delegate)\s+/, "").trim())
              .filter(Boolean);
            if (names.length) indexed.push({ source: s, names });
          } catch {
            degradedLabels.push(s.label);
          }
        }
      }
      const doc = readDocIndex(active);
      if (!indexed.length) {
        degradedLabels = active.map((s) => s.label);
        for (const s of active) {
          const names = [...doc.byName.keys()].filter((k) => k.startsWith("T:")).map((k) => k.slice(2));
          if (names.length) indexed.push({ source: s, names });
        }
      }

      interface Hit {
        label: string;
        name: string;
      }
      const hits: Hit[] = [];
      for (const { source, names } of indexed) {
        for (const n of names) {
          // Drop compiler-generated helpers (<>c display classes, <Module>, and nested
          // state machines such as CustomCardModel.<FinishMakeCalculatedVar>d__25).
          const compilerGenerated = n.includes("<>") || n.split(".").some((seg) => seg.startsWith("<"));
          if (!n.toLowerCase().includes(q) || compilerGenerated) continue;
          hits.push({ label: source.label, name: n });
        }
      }

      if (!hits.length) {
        const total = indexed.reduce((a, b) => a + b.names.length, 0);
        return {
          content: [
            {
              type: "text",
              text: `FAIL: no type name matches "${query}" (searched ${indexed.length} assembly(ies), ${total} names).\nNEXT: try a shorter substring or a different capitalisation. Search matches type names, not member names.`,
            },
          ],
          details: { ok: false, reason: "NO_MATCH", query },
        };
      }

      // Game first, then packages; then shorter names, which are usually what was meant.
      const rank = (h: Hit) => (h.label === "game" ? 0 : 1);
      hits.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name));
      const seen = new Set<string>();
      const shown: Hit[] = [];
      for (const h of hits) {
        const key = `${h.label}/${h.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        shown.push(h);
        if (shown.length >= limit) break;
      }

      const lines: string[] = [];
      for (const h of shown) {
        const summary = doc.byName.get(`T:${h.name}`);
        lines.push(`[${h.label}] ${h.name}${summary ? `\n    ${clip(summary, 180)}` : ""}`);
      }
      if (hits.length > shown.length) lines.push(`... ${hits.length - shown.length} more matches (raise limit or narrow the query)`);
      lines.push("");
      lines.push(`Searched: ${indexed.map((i) => describe(i.source)).join(", ")}`);
      for (const n of notes) lines.push(n);
      if (degradedLabels.length) {
        lines.push(
          `WARNING: ilspycmd is not available for ${degradedLabels.join(", ")}, so those lists came from the documentation files and are incomplete.`,
        );
        lines.push(`NEXT: ${installHint} to search those assemblies fully.`);
      } else {
        lines.push("NEXT: run action=source with one of the names above to read the type.");
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {
          ok: true,
          action: "search",
          query,
          matches: hits.length,
          shown: shown.length,
          searched: indexed.map((i) => i.source.label),
          degraded: degradedLabels,
        },
      };
    },
  });
}
