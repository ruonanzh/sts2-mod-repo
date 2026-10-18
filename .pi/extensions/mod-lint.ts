import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { runAsync } from "../lib/proc";
import { probeDotnet } from "../lib/dotnet";
import { managedDirFor, readModRepoConfig, readState } from "../lib/game-paths";
import { MANIFEST_KEYS, isParseableVersion, readManifest } from "../lib/mod-identity";

/**
 * validate_mod -- Slay the Spire 2 (godot-csharp).
 *
 * Every rule below comes from the game's own loader, decompiled from
 * MegaCrit.Sts2.Core.Modding.ModManager / ModManifest, or from a failure that was
 * observed on this machine. The manifest key set and the file naming are hard rules
 * because a wrong value is silently ignored by the loader.
 *
 * Contract (docs/mod-repo-guide.md 3.1): param modDir, no third-party deps, read-only
 * except build output inside the mod dir, content text PASS/FAIL/PARTIAL plus a NEXT
 * line, details {ok, errors, warnings}. Skipped compilation is PARTIAL, never PASS.
 */

/** Truncate long output so a failed build cannot flood the context. */
function truncateLines(text: string, maxLines = 200): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}\n... (${lines.length - maxLines} more lines truncated)`;
}

/** Compare dotted versions; returns negative / zero / positive. */
function cmpVersion(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The game writes Contents/Resources/release_info.json next to the per-platform data dir. */
function readInstalledVersion(managedDir: string | null, gameDir: string | null): string | null {
  const candidates: string[] = [];
  if (managedDir) candidates.push(join(dirname(managedDir), "release_info.json"));
  if (gameDir) candidates.push(join(gameDir, "release_info.json"));
  for (const c of candidates) {
    try {
      const raw = JSON.parse(readFileSync(c, "utf8")) as { version?: string };
      if (typeof raw.version === "string" && raw.version.trim()) return raw.version.trim();
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Find the mod's csproj (top level only; a mod is one project). */
function findCsproj(modDir: string): string | null {
  try {
    const hit = readdirSync(modDir).find((f) => f.toLowerCase().endsWith(".csproj"));
    return hit ? join(modDir, hit) : null;
  } catch {
    return null;
  }
}

/** Read <AssemblyName> out of a csproj. The loader finds <id>.dll, so this must equal id. */
function readAssemblyName(csprojPath: string): string | null {
  try {
    const text = readFileSync(csprojPath, "utf8");
    const m = /<AssemblyName>\s*([^<\s]+)\s*<\/AssemblyName>/i.exec(text);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Walk localization/<lang>/*.json and collect key names, so we can check the MODID- prefix. */
function localizationKeys(modDir: string): { keys: string[]; badJson: string[] } {
  const keys: string[] = [];
  const badJson: string[] = [];
  const root = join(modDir, "localization");
  if (!existsSync(root)) return { keys, badJson };
  let langs: string[] = [];
  try {
    langs = readdirSync(root).filter((d) => {
      try {
        return statSync(join(root, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return { keys, badJson };
  }
  for (const lang of langs) {
    let files: string[] = [];
    try {
      files = readdirSync(join(root, lang)).filter((f) => f.toLowerCase().endsWith(".json"));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const obj = JSON.parse(readFileSync(join(root, lang, f), "utf8")) as Record<string, unknown>;
        for (const k of Object.keys(obj)) keys.push(k);
      } catch {
        badJson.push(`${lang}/${f}`);
      }
    }
  }
  return { keys, badJson };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "validate_mod",
    label: "Validate Mod",
    description:
      "Validates a Slay the Spire 2 mod directory and compiles it. Checks the manifest (single <id>.json, id equal to the file name, only the 10 loader keys), the project's AssemblyName, the min_game_version against the installed game, the BaseLib dependency floor, and the localization key prefix. Then runs dotnet build and inspects the produced <id>.dll. The build writes output inside the mod directory. It does not edit source and does not test gameplay. Output text uses PASS, FAIL, or PARTIAL plus a NEXT line. Skipped compilation is PARTIAL, never PASS.",
    promptSnippet: "Validate and compile a Slay the Spire 2 mod before installing it",
    promptGuidelines: [
      "Run validate_mod on a mod directory after changing the manifest or C# source, and before install_mod. It compiles, so do not repeat the same dotnet build separately.",
      "Treat PARTIAL as not validated. It means compilation was skipped, usually because the .NET SDK or the game directory is not set up yet. Fix the prerequisite named in the NEXT line first.",
      "A FAIL that names the manifest file naming rule means the loader would not find the assembly. Rename the file and the id together; never fix one without the other.",
    ],
    parameters: Type.Object({
      modDir: Type.String({
        description:
          "Path to the mod directory. A relative path is resolved against the workspace root.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const repoRoot = ctx.cwd;
      const modDir = resolve(repoRoot, params.modDir);
      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. Manifest: single .json, id matches the file name, id is a plain identifier.
      const manifest = readManifest(modDir);
      let modId = "";
      let manifestData: Record<string, unknown> = {};
      if (!manifest.ok) {
        errors.push(manifest.reason);
      } else {
        modId = manifest.identity.id;
        manifestData = manifest.data as Record<string, unknown>;

        // 2. Unknown keys. The loader ignores them, which usually hides a typo such as
        //    hasDll instead of has_dll - and a missed has_dll means no assembly is loaded.
        const unknown = Object.keys(manifestData).filter(
          (k) => !(MANIFEST_KEYS as readonly string[]).includes(k),
        );
        if (unknown.length)
          warnings.push(
            `the loader ignores unknown manifest keys: ${unknown.join(", ")}. Check them for typos`,
          );

        // 3. has_dll must be true: v1 ships DLL-only mods (compile.pck is false in mod-repo.json).
        if (manifestData.has_dll !== true)
          errors.push('has_dll must be true. Without it the loader never loads the assembly');
        if (manifestData.has_pck === true)
          errors.push(
            "has_pck is true, but this repo builds DLL-only mods. Either ship the .pck or set has_pck to false. A declared but missing .pck makes the loader log an error and load the mod without its assets.",
          );

        // 4. version must parse as semantic version. Mod.version is null otherwise, and any
        //    other mod that declares a min_version on this one fails to load.
        const version = typeof manifestData.version === "string" ? manifestData.version : "";
        if (!version) errors.push('version is missing. Other mods cannot depend on a mod without one');
        else if (!isParseableVersion(version))
          errors.push(`version "${version}" is not x.y.z. The game parses it as a semantic version`);

        // 5. min_game_version against the installed build. The loader marks the mod
        //    unsupported (and does not load it) when the installed version is lower.
        const minGame = typeof manifestData.min_game_version === "string" ? manifestData.min_game_version : "";
        if (!minGame) {
          warnings.push(
            "min_game_version is missing. The loader accepts the mod with a warning, but the mod will not be marked unsupported on older builds",
          );
        }
      }

      // 6. BaseLib floor. BaseLib 3.3.0 is the first version that pairs with game 0.107;
      //    below that the API surface differs.
      const deps = manifest.ok ? manifestData.dependencies : undefined;
      if (Array.isArray(deps)) {
        const baseLib = deps.find((d) => (d as { id?: string })?.id === "BaseLib") as
          | { min_version?: string }
          | undefined;
        if (baseLib?.min_version && cmpVersion(baseLib.min_version, "3.3.0") < 0)
          warnings.push(
            `BaseLib min_version is ${baseLib.min_version}. This harness targets game 0.107.1, which pairs with BaseLib 3.3.0 or newer`,
          );
      }

      // 7. csproj AssemblyName must equal id: the loader reads <id>.dll.
      const csproj = findCsproj(modDir);
      let csprojDir = modDir;
      if (!csproj) {
        errors.push("no .csproj in the mod directory. Copy reference/example_mod as the starting point");
      } else {
        csprojDir = dirname(csproj);
        const asm = readAssemblyName(csproj);
        if (modId && asm && asm !== modId)
          errors.push(
            `AssemblyName is "${asm}" but the manifest id is "${modId}". The loader looks for ${modId}.dll, so the build output would never be found`,
          );
        if (!asm && modId)
          warnings.push(
            `no <AssemblyName> in ${basename(csproj)}. It falls back to the project file name, which must also be ${modId}`,
          );
      }

      // 8. Localization key prefix. BaseLib prefixes model ids with ModId, so every key
      //    in a mod's loc table starts with "<id>-".
      const loc = localizationKeys(modDir);
      for (const bad of loc.badJson) errors.push(`localization/${bad} is not valid JSON`);
      if (modId) {
        const stray = loc.keys.filter((k) => !k.toUpperCase().startsWith(`${modId.toUpperCase()}-`));
        if (stray.length)
          warnings.push(
            `${stray.length} localization key(s) do not start with "${modId}-": ${stray.slice(0, 3).join(", ")}${stray.length > 3 ? ", ..." : ""}. Keys without the prefix collide with vanilla keys`,
          );
      }

      // 9. Compile. dotnet comes from check_runtime's cache; the game dir from the path tools.
      const state = readState(repoRoot);
      const staticOk = errors.length === 0;
      let compilation: "skipped" | "passed" | "failed" = "skipped";
      let installedVersion: string | null = null;

      const cfg = readModRepoConfig(repoRoot);
      const gameDir = typeof state.gameDir === "string" ? state.gameDir : null;
      const managedDir =
        typeof state.managedDir === "string" && state.managedDir
          ? state.managedDir
          : gameDir
            ? managedDirFor(gameDir, cfg)
            : null;
      installedVersion = readInstalledVersion(managedDir, gameDir);

      // min_game_version needs the installed build, so this comparison happens here.
      if (manifest.ok && staticOk) {
        const minGame =
          typeof manifestData.min_game_version === "string" ? manifestData.min_game_version : "";
        if (minGame && installedVersion && cmpVersion(installedVersion, minGame) < 0)
          errors.push(
            `min_game_version is ${minGame} but the installed game is ${installedVersion}. The loader treats the mod as unsupported and does not load it`,
          );
      }

      const dotnetCache = state.runtime?.dotnet ?? state.dotnet;
      const dotnet =
        typeof dotnetCache === "string" && dotnetCache ? dotnetCache : (probeDotnet().path ?? "");

      if (!dotnet) {
        warnings.push(
          "dotnet was not found, so compilation was skipped. Run check_runtime to verify the SDK; use install_runtime only for installation instructions",
        );
      } else if (!gameDir) {
        warnings.push(
          "the game directory is not recorded, so compilation was skipped. Run try_set_game_dir first; installing an SDK cannot fix a missing game path",
        );
      } else if (csproj && staticOk) {
        const refs = readAssemblies(repoRoot) ?? [];
        try {
          // The assembly list goes through an environment variable, not -p:. On the MSBuild
          // command line a semicolon ends the property, so it has to be escaped as %3B - but an
          // escaped value is no longer split by Include, which merges "sts2;0Harmony" into one
          // item and yields sts2.dll;0Harmony.dll. Environment variables bypass that parsing.
          await runAsync(dotnet, ["build", csproj, "-c", "Release"], {
            cwd: csprojDir,
            env: {
              ...process.env,
              GAME_DIR: gameDir,
              GAME_MANAGED_DIR: managedDir ?? "",
              STS2_GAME_ASSEMBLIES: refs.join(";"),
            },
            timeoutMs: 300_000,
          });
          compilation = "passed";
        } catch (e) {
          compilation = "failed";
          const err = e as { stderr?: string; stdout?: string; message?: string };
          errors.push(
            `dotnet build failed: ${String(err.stderr || err.stdout || err.message).slice(0, 600)}`,
          );
        }
      } else if (!staticOk) {
        warnings.push("compilation was skipped because the static checks already failed");
      }

      // 10. The artifact has to exist with the exact name the loader reads.
      const dllCandidates = modId
        ? [join(csprojDir, `${modId}.dll`), join(csprojDir, "bin", "Release", `${modId}.dll`)]
        : [];
      const dllPath = dllCandidates.find((p) => existsSync(p)) ?? null;
      if (compilation === "passed" && !dllPath)
        errors.push(
          `missing ${modId}.dll after a successful build. Check that AssemblyName equals the manifest id`,
        );

      // 11. Empty-stub guard. A build can exit 0 and still produce a shell: if the csproj
      //     points output at the project root, the SDK excludes the project's own *.cs files
      //     and compiles nothing. The mod then loads but does nothing.
      if (compilation === "passed" && dllPath) {
        try {
          const bytes = readFileSync(dllPath);
          if (bytes.length < 4096 || !bytes.includes("ModInitializerAttribute"))
            errors.push(
              `${modId}.dll looks like an empty stub (${bytes.length} bytes, no ModInitializerAttribute reference). ` +
                "Common cause: the csproj overrides the output path so the SDK excludes the mod's own *.cs files and compiles nothing",
            );
        } catch (e) {
          errors.push(`cannot read ${modId}.dll: ${(e as Error).message}`);
        }
      }

      // Result.
      const ok = errors.length === 0 && compilation === "passed";
      const status = ok ? "pass" : compilation === "skipped" && errors.length === 0 ? "partial" : "fail";

      let nextAction: string;
      if (ok) {
        nextAction =
          "Run install_mod to copy the build into the game's mods directory, then restart the game and check godot.log. See the mod-installer skill.";
      } else if (compilation === "skipped" && errors.length === 0) {
        nextAction =
          "Fix the prerequisite named in the WARN lines, then run validate_mod again so the mod is actually compiled. See the setup-workspace skill.";
      } else if (errors.some((e) => e.includes("dotnet build failed"))) {
        nextAction =
          "Read the compiler error above; it names the file and line. Common fixes are a missing package reference or an API that does not exist in this game build. See the mod-creator skill.";
      } else {
        nextAction =
          "Fix the FAIL lines in order, starting with the manifest. Then run validate_mod again. See the mod-creator skill for the manifest field meanings.";
      }

      const lines = [
        ...warnings.map((w) => `WARN: ${w}`),
        ...errors.map((e) => `FAIL: ${e}`),
      ];
      if (ok) {
        lines.push(
          `PASS: ${basename(modDir)} is valid and compiled against the installed game${installedVersion ? ` (${installedVersion})` : ""}. It was not tested in-game.`,
        );
      } else if (status === "partial") {
        lines.push("PARTIAL: Static checks passed, but the mod was not compiled.");
      }
      lines.push(`NEXT: ${nextAction}`);

      return {
        content: [{ type: "text", text: truncateLines(lines.join("\n")) }],
        details: { ok, errors, warnings, compilation, modId, installedVersion },
      };
    },
  });
}

/** compile.references from mod-repo.json (read again here to keep the build list in one place). */
function readAssemblies(repoRoot: string): string[] | null {
  try {
    const raw = JSON.parse(readFileSync(join(repoRoot, "mod-repo.json"), "utf8")) as {
      compile?: { references?: string[] };
    };
    const refs = raw.compile?.references;
    return Array.isArray(refs) && refs.length ? refs : null;
  } catch {
    return null;
  }
}
