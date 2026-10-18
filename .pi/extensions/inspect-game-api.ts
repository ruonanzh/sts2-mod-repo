import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runAsync } from "../lib/proc";
import { managedDirFor, readModRepoConfig, readState } from "../lib/game-paths";

/**
 * inspect_game_api -- find the exact name of a game type, then read its source.
 *
 * Why this exists: a wrong type or member name fails at build time with a message that
 * does not name the real cause, so guessing is expensive. The game ships two things we
 * can read without executing anything:
 *
 *   sts2.dll   6381 types. `ilspycmd -l c` lists them, `ilspycmd -t` decompiles one.
 *   sts2.xml   19,635 documented members -- but only the ones that carry a doc comment.
 *              `CardModel.PortraitPath` is not in it, so the doc file alone would answer
 *              "not found" for exactly the members a modder needs. It is used only to
 *              enrich a hit with a summary.
 *
 * So: search uses the type list from the assembly (complete) and attaches summaries when
 * the doc file has them. When ilspycmd is missing, search degrades to the doc file and
 * says so.
 */

interface DocIndex {
  /** exact member name -> plain-text summary */
  byName: Map<string, string>;
}

function plain(xml: string): string {
  return xml
    .replace(/<see cref="[^:]+:([^"]+)"\s*\/>/g, (_m, ref: string) => ref.split(".").pop() ?? ref)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The doc file is ~5 MB, so split on the member tag instead of running one lazy regex. */
function readDocIndex(xmlPath: string): DocIndex {
  const byName = new Map<string, string>();
  if (!existsSync(xmlPath)) return { byName };
  const chunks = readFileSync(xmlPath, "utf8").split('<member name="');
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
  return { byName };
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "inspect_game_api",
    label: "Inspect Game API",
    description:
      "Read the installed Slay the Spire 2 assembly to get exact type names, and decompile a type to C#. Action search lists type names that contain the query and attaches the game's own documentation summary when one exists. Action source decompiles one type in full, including private members and signatures. Use it before writing code that touches a game type, because a guessed name fails at build time with an error that does not name the real cause. Search needs ilspycmd (a dotnet global tool); source needs it too. It only reads files and never loads or runs the game assembly.",
    promptSnippet: "Look up exact game type names and read their source before writing mod code",
    promptGuidelines: [
      "Call inspect_game_api before you write code that touches a game type. Do not guess type or member names.",
      "Use action=search with a short substring of the type name, then action=source with the exact name that search returned. Search matches type names, not member names, because the assembly is the only complete source and it lists types.",
      "A member that is undocumented is still real. If search finds nothing for a member name, search for the type instead and read its source; the game's documentation file only covers members that carry a doc comment.",
      "When you learn something this way, write the fact and the query you used into docs/, so the next session does not repeat it.",
    ],
    parameters: Type.Object({
      action: Type.String({
        description: 'One of "search" or "source".',
      }),
      query: Type.Optional(
        Type.String({
          description: 'For action=search: a substring of a type name, for example "CardModel" or "ModManager".',
        }),
      ),
      typeName: Type.Optional(
        Type.String({
          description:
            'For action=source: the full type name, for example "MegaCrit.Sts2.Core.Models.CardModel".',
        }),
      ),
      limit: Type.Optional(Type.Number({ description: "Maximum results for search. Default 30, maximum 200." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const repoRoot = ctx.cwd;
      const state = readState(repoRoot);
      const gameDir = typeof state.gameDir === "string" ? state.gameDir : null;
      const managed =
        typeof state.managedDir === "string" && state.managedDir
          ? state.managedDir
          : gameDir
            ? managedDirFor(gameDir, readModRepoConfig(repoRoot))
            : null;

      if (!managed || !existsSync(managed)) {
        return {
          content: [
            {
              type: "text",
              text: "FAIL: the game's data directory is not recorded or does not exist.\nNEXT: run try_set_game_dir first; it derives and records the directory that holds sts2.dll.",
            },
          ],
          details: { ok: false, reason: "NO_MANAGED_DIR" },
        };
      }

      const dll = join(managed, "sts2.dll");
      if (!existsSync(dll)) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: sts2.dll not found in ${managed}.\nNEXT: run check_game_paths to verify the recorded game directory.`,
            },
          ],
          details: { ok: false, reason: "NO_DLL" },
        };
      }

      // ilspycmd is a dotnet global tool; it lives beside the SDK recorded by check_runtime.
      const cached = state.runtime?.dotnet ?? state.dotnet;
      const dotnet = typeof cached === "string" && cached ? cached : "";
      const ilspy = dotnet ? join(dirname(dotnet), "tools", "ilspycmd") : "";
      const haveIlspy = Boolean(ilspy) && existsSync(ilspy);
      const ilspyEnv = dotnet
        ? {
            ...process.env,
            DOTNET_ROOT: dirname(dotnet),
            PATH: `${dirname(dotnet)}:${process.env.PATH ?? ""}`,
          }
        : process.env;
      const installHint = `install it once with "${dotnet || "dotnet"} tool install -g ilspycmd"`;

      // ---- source -------------------------------------------------------------
      if (params.action === "source") {
        const typeName = (params.typeName ?? "").trim();
        if (!typeName) {
          return {
            content: [
              {
                type: "text",
                text: "FAIL: action=source needs typeName.\nNEXT: run action=search first to get the exact type name.",
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
        try {
          const r = await runAsync(ilspy, ["-t", typeName, dll], { env: ilspyEnv, timeoutMs: 180_000 });
          const text = r.stdout.trim();
          if (!text) {
            return {
              content: [
                {
                  type: "text",
                  text: `FAIL: nothing decompiled for ${typeName}.\nNEXT: run action=search with a substring of the name to get the exact spelling.`,
                },
              ],
              details: { ok: false, reason: "NOT_FOUND", typeName },
            };
          }
          return {
            content: [{ type: "text", text: clip(text, 40_000) }],
            details: { ok: true, action: "source", typeName },
          };
        } catch (e) {
          const err = e as { stderr?: string; stdout?: string; message?: string };
          return {
            content: [
              {
                type: "text",
                text: `FAIL: decompiling ${typeName} failed: ${String(err.stderr || err.message).slice(0, 300)}\nNEXT: run action=search for the exact type name and try again.`,
              },
            ],
            details: { ok: false, reason: "ILSPY_FAILED" },
          };
        }
      }

      // ---- search -------------------------------------------------------------
      const query = (params.query ?? "").trim();
      if (!query) {
        return {
          content: [
            {
              type: "text",
              text: 'FAIL: action=search needs query.\nNEXT: pass a short substring of a type name, for example "CardModel".',
            },
          ],
          details: { ok: false, reason: "NO_QUERY" },
        };
      }
      const limit = Math.min(Math.max(params.limit ?? 30, 1), 200);
      const q = query.toLowerCase();
      const doc = readDocIndex(join(managed, "sts2.xml"));

      let names: string[] = [];
      let source = "the assembly type list";
      if (haveIlspy) {
        try {
          const r = await runAsync(ilspy, ["-l", "c", dll], { env: ilspyEnv, timeoutMs: 180_000 });
          // Lines look like: "Class MegaCrit.Sts2.Core.Models.CardModel"
          names = r.stdout
            .split("\n")
            .map((l) => l.replace(/^(Class|Struct|Interface|Enum|Delegate)\s+/, "").trim())
            .filter(Boolean);
        } catch {
          names = [];
        }
      }
      if (!names.length) {
        // Degraded path: the doc file only lists members that carry a doc comment, so this
        // can miss real types. Say so instead of pretending the answer is complete.
        source = "the documentation file only (partial)";
        names = [...doc.byName.keys()].filter((k) => k.startsWith("T:")).map((k) => k.slice(2));
      }

      // Drop compiler-generated helpers (<>c display classes, <Module>), which match a
      // substring query but are never what a modder is looking for.
      const hits = names.filter(
        (n) => n.toLowerCase().includes(q) && !n.includes("<>") && !n.startsWith("<"),
      );
      if (!hits.length) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: no type name matches "${query}" (searched ${source}, ${names.length} names).\nNEXT: try a shorter substring, or a different capitalisation.`,
            },
          ],
          details: { ok: false, reason: "NO_MATCH", query, source },
        };
      }

      // Prefer the game's own namespace over compiler-generated helpers.
      hits.sort((a, b) => {
        const score = (n: string) => (n.startsWith("MegaCrit.") ? 0 : n.startsWith("System.") || n.startsWith("<") ? 2 : 1);
        return score(a) - score(b) || a.length - b.length;
      });

      const shown = hits.slice(0, limit);
      const lines: string[] = [];
      for (const n of shown) {
        const summary = doc.byName.get(`T:${n}`);
        lines.push(`${n}${summary ? `\n    ${clip(summary, 180)}` : ""}`);
      }
      if (hits.length > shown.length) lines.push(`... ${hits.length - shown.length} more matches (raise limit or narrow the query)`);
      lines.push("");
      if (source.includes("partial")) {
        lines.push(
          "WARNING: ilspycmd is not available, so this list came from the documentation file and is incomplete.",
        );
        lines.push(`NEXT: ${installHint} to search the full assembly.`);
      } else {
        lines.push(`NEXT: run action=source with one of the names above to read the type.`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { ok: true, action: "search", query, matches: hits.length, shown: shown.length, source },
      };
    },
  });
}
