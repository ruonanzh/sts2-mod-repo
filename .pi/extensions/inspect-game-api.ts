import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { runAsync } from "../lib/proc";
import { managedDirFor, readGameConfig, readModRepoConfig, readState } from "../lib/game-paths";
import { resolveApiSources, type ApiSource, type PackageSpec } from "../lib/api-sources";

/**
 * inspect_game_api -- find the exact name of a type or member, then read its C#, its IL,
 * or the string literals around it. The surface matches the sibling game repositories.
 *
 * The API a mod codes against spans more than one assembly. For Slay the Spire 2 a card
 * can inherit RitsuLib's `ModCardTemplate`, whose base is the game's `CardModel`, so the
 * names come from `sts2.dll` and the RitsuLib modules. A tool that sees only one of them
 * invites guesses for the other half, and a guess fails as CS0246/CS0012 without saying
 * which mistake was made. So this searches every assembly declared in mod-repo.json and
 * labels each result.
 *
 * Backend: `tools/api-probe`, which links the vendored ICSharpCode.Decompiler 11.1
 * (see THIRD_PARTY_LICENSES.md). It is vendored rather than installed as a global dotnet
 * tool so that the version is fixed and no network is needed; the trade is one build step,
 * which check_runtime performs. Vendored code is copied unmodified from the Unity Mono
 * skeleton, where it already carries fixes learned in use.
 *
 * One run per source root. api-probe resolves `--dll` relative to `--managed`, and the game
 * directory and the NuGet cache are separate trees, so grouping by root is the honest shape,
 * not a workaround.
 */

const PROBE_DIR = join("tools", "api-probe");
const PROBE_DLL = join("bin", "Release", "net8.0", "api-probe.dll");

/**
 * The five actions, identical to `inspect_game_api` in the other game repositories so an agent
 * does not have to relearn the surface. The names are also the `api-probe` command line's names,
 * except that the probe spells nothing differently: this is a pass-through.
 */
const ACTIONS = new Set(["search", "members", "decompile", "il", "strings"]);

interface ProbeRun {
  source: ApiSource;
  stdout: string;
  failed: boolean;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "inspect_game_api",
    label: "Inspect API",
    description:
      "Read the exact type and member names, the C#, the IL, and the string literals of every assembly the repository declares: the game (sts2.dll) and the pinned RitsuLib modules. The five actions are search, members, decompile, il, and strings. search finds types and members whose name contains the target. members lists one type's members and its base chain. decompile turns one type or member into C#. il turns one type or method into IL. strings lists string literals. Results are tagged with the assembly they came from. Use it before writing code that touches a game or RitsuLib type, because a guessed name fails at build time with CS0246 or CS0012, which does not say whether the name is wrong or an assembly is missing. It reads the assemblies on disk and never loads or runs the game.",
    promptSnippet: "Look up exact type and member names across the game and RitsuLib before writing mod code",
    promptGuidelines: [
      "Call inspect_game_api before you write code that touches a game or RitsuLib type. Do not guess names. The game and RitsuLib assemblies carry different parts of what a card needs.",
      "Use action=search with a short substring. It matches both type names and member names, so searching for a method such as PortraitPath works and tells you which type owns it.",
      "Use action=members to see a type's base chain. A RitsuLib type derives from a game type, so a hit tagged ritsulib almost always means sts2.dll is needed too. members shows this directly.",
      "A hit tagged ritsulib also means the mod must reference the RitsuLib package and declare STS2-RitsuLib in the manifest dependencies.",
      "A type can sit in any declared assembly. If a lookup misses, try dll=game or dll=ritsulib before you decide the type does not exist. A miss from search never proves that nothing uses a name; that needs a call-site, which is what the decompiled dump is for.",
      "When you learn something this way, write the fact and the target you used into docs/, so the next session does not repeat it.",
    ],
    parameters: Type.Object({
      action: Type.Union(
        [
          Type.Literal("search"),
          Type.Literal("members"),
          Type.Literal("decompile"),
          Type.Literal("il"),
          Type.Literal("strings"),
        ],
        {
          description:
            "search: find types or members by name. members: list a type's members and its base chain. decompile: a type or member to C#. il: a type or method to IL. strings: string literals in an assembly.",
        },
      ),
      target: Type.Optional(
        Type.String({
          description:
            'A full type name such as "MegaCrit.Sts2.Core.Models.CardModel" or "STS2RitsuLib.Scaffolding.Content.ModCardTemplate", or a substring for action=search such as "ModCard".',
        }),
      ),
      member: Type.Optional(
        Type.String({
          description: "For action=decompile or action=il: narrow the output to one member.",
        }),
      ),
      dll: Type.Optional(
        Type.String({
          description:
            'Which assembly to read: "game", "ritsulib", an assembly name such as "sts2" or "STS2-RitsuLib.Runtime", or "all". Default "all", which searches the game and every pinned RitsuLib module.',
        }),
      ),
      limit: Type.Optional(Type.Number({ description: "Maximum output lines. Default 400." })),
      offset: Type.Optional(
        Type.Number({ description: "Skip the first N matches, to page a large search or strings result. Default 0." }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const repoRoot = ctx.cwd;
      const action = String(params.action ?? "");
      if (!ACTIONS.has(action)) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: unknown action ${JSON.stringify(params.action)}.\nNEXT: use one of search, members, decompile, il, or strings.`,
            },
          ],
          details: { ok: false, reason: "BAD_ACTION" },
        };
      }

      const target = (params.target ?? "").trim();
      if (!target) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: action=${action} needs target.\nNEXT: ${
                action === "search"
                  ? "pass a short substring, for example \"CustomCard\"."
                  : "run action=search first to get the exact type name."
              }`,
            },
          ],
          details: { ok: false, reason: "NO_TARGET" },
        };
      }

      // The probe has to exist: bin/ is gitignored, so a fresh clone starts without it.
      const probeDll = join(repoRoot, PROBE_DIR, PROBE_DLL);
      if (!existsSync(probeDll)) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: the API probe is not built yet (${join(PROBE_DIR, PROBE_DLL)}).\nNEXT: run check_runtime; it builds tools/api-probe. The build needs no network because the decompiler is vendored.`,
            },
          ],
          details: { ok: false, reason: "PROBE_NOT_BUILT" },
        };
      }

      const state = readState(repoRoot);
      const dotnet = typeof (state.runtime?.dotnet ?? state.dotnet) === "string"
        ? ((state.runtime?.dotnet ?? state.dotnet) as string)
        : "";
      if (!dotnet) {
        return {
          content: [
            {
              type: "text",
              text: "FAIL: the .NET SDK path is not recorded, so the probe cannot be started.\nNEXT: run check_runtime first.",
            },
          ],
          details: { ok: false, reason: "NO_DOTNET" },
        };
      }

      // Which assemblies to search, from the contract file only.
      const cfg = readModRepoConfig(repoRoot);
      const gameDir = typeof state.gameDir === "string" ? state.gameDir : null;
      const managed =
        typeof state.managedDir === "string" && state.managedDir
          ? state.managedDir
          : gameDir
            ? managedDirFor(gameDir, cfg)
            : null;
      let references: string[] = [];
      let packages: PackageSpec[] = [];
      try {
        const raw = readGameConfig(repoRoot);
        references = raw.assemblies ?? [];
        packages = raw.packages ?? [];
      } catch {
        /* the notes below explain an empty result */
      }

      const { sources, notes } = resolveApiSources({ managedDir: managed, references, packages });
      // `dll` mirrors the other game repository: a label ("game", "ritsulib"), an assembly name
      // ("sts2"), or "all". The label is ours; the assembly name is what the sibling tool calls it.
      const wanted = (params.dll ?? "all").trim().toLowerCase();
      const active =
        wanted === "all"
          ? sources
          : sources.filter(
              (s) => s.label === wanted || s.assembly.toLowerCase() === wanted.replace(/\.dll$/, ""),
            );

      if (!active.length) {
        const gameMissing = !managed || !existsSync(managed);
        const pkgMissing = packages.filter((p) => !sources.some((s) => s.label === p.label)).map((p) => p.id);
        const next: string[] = [];
        if (gameMissing) next.push("run try_set_game_dir so the game's data directory is recorded");
        if (pkgMissing.length)
          next.push(`run dotnet restore in a mod that references ${pkgMissing.join(", ")} so the package is in the NuGet cache`);
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
          details: { ok: false, reason: "NO_SOURCE" },
        };
      }

      const describe = (s: ApiSource) =>
        s.version ? `${s.label} (${s.assembly} ${s.version})` : `${s.label} (${s.assembly})`;

      // One probe run per assembly, always with the game's data directory as the resolver
      // root. That matters for correctness, not tidiness: api-probe builds a
      // UniversalAssemblyResolver over --managed, so probing RitsuLib with the NuGet folder as
      // the root leaves sts2.dll unresolvable and its base chain comes back empty (the class
      // base is dropped as TypeKind.Unknown). Pointing the resolver at the game directory and
      // loading the package assembly by an absolute --dll keeps the chain intact -
      // Path.Combine returns the absolute path unchanged.
      const resolverRoot = managed && existsSync(managed) ? managed : null;
      const runs: ProbeRun[] = [];
      for (const s of active) {
        const args = [
          probeDll,
          "--managed",
          resolverRoot ?? s.root,
          "--dll",
          resolverRoot ? s.dllPath : `${s.assembly}.dll`,
          "--action",
          action,
          "--target",
          target,
        ];
        if (params.member) args.push("--member", params.member);
        if (params.limit !== undefined) args.push("--limit", String(params.limit));
        if (params.offset !== undefined) args.push("--offset", String(params.offset));
        try {
          const r = await runAsync(dotnet, args, {
            cwd: repoRoot,
            env: { ...process.env, DOTNET_ROOT: dirname(dotnet) },
            timeoutMs: 180_000,
          });
          runs.push({ source: s, stdout: r.stdout.trim(), failed: false });
        } catch (e) {
          // api-probe exits 1 when the target is absent from that assembly, which is a
          // normal outcome when searching two assemblies. Keep whatever it printed.
          const err = e as { stdout?: string; stderr?: string; message?: string };
          runs.push({
            source: s,
            stdout: (err.stdout ?? "").trim() || (err.stderr ?? "").trim() || (err.message ?? "").trim(),
            failed: true,
          });
        }
      }

      // A real hit always begins with a "## <file>" header. A miss prints either
      // "# search: 0 match(es) ... legal empty result" or "# ERROR: no result ...".
      // Searching several assemblies makes a miss the expected outcome for most of them,
      // so only blocks with a header are rendered; otherwise every cross-assembly lookup
      // would print error text for the assemblies that legitimately do not define the type.
      const hits = runs.filter((r) => /^## /m.test(r.stdout));
      if (!hits.length) {
        // api-probe computes a nearest-name suggestion on a miss. Keep it: it is the most
        // useful thing to hand back when the spelling is slightly off.
        const suggestions = runs
          .flatMap((r) => r.stdout.split("\n"))
          .filter((l) => l.startsWith("#   did you mean:"))
          .map((l) => l.replace("#   did you mean:", "").trim())
          .slice(0, 2);
        return {
          content: [
            {
              type: "text",
              text: [
                `FAIL: nothing matched "${target}" in ${active.map(describe).join(", ")}.`,
                ...suggestions.map((s) => `Did you mean: ${s}`),
                ...notes,
                "NEXT: names are matched as a substring. Try a shorter one, or check the spelling.",
              ].join("\n"),
            },
          ],
          details: { ok: false, reason: "NO_MATCH", target },
        };
      }

      // Label each block so the reader can tell the game from the framework.
      const blocks: string[] = [];
      for (const r of hits) {
        const body = r.stdout
          .split("\n")
          .map((l) => l.trimEnd())
          .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
          .join("\n");
        blocks.push(`[${describe(r.source)}]\n${body}`);
      }
      const text = blocks.join("\n\n");
      const limit = Math.min(Math.max(params.limit ?? 400, 20), 2000);
      const lines = text.split("\n");
      const trimmed = lines.length <= limit ? text : `${lines.slice(0, limit).join("\n")}\n... (${lines.length - limit} more lines truncated)`;

      const footer: string[] = [];
      for (const n of notes) footer.push(n);
      if (action === "search") {
        footer.push("NEXT: action=members shows a type's base chain, and action=decompile reads its C#.");
      }

      return {
        content: [
          {
            type: "text",
            text: [trimmed, ...(footer.length ? ["", ...footer] : [])].join("\n"),
          },
        ],
        details: {
          ok: true,
          action: params.action,
          target,
          searched: active.map((s) => describe(s)),
          ran: runs.map((r) => r.source.label),
        },
      };
    },
  });
}
