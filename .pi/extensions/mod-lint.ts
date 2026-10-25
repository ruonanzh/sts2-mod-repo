import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { runAsync } from "../lib/proc";
import { probeDotnet } from "../lib/dotnet";
import { managedDirFor, readGameConfig, readModRepoConfig, readState } from "../lib/game-paths";
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

function hasSourceFiles(dir: string): boolean {
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) return true;
    if (entry.isDirectory() && hasSourceFiles(join(dir, entry.name))) return true;
  }
  return false;
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

/** Walk localization/<lang>/*.json and collect key names and malformed files. */
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
      "Validates a Slay the Spire 2 mod directory and compiles it. Checks the manifest (single <id>.json, id equal to the file name, only the 10 loader keys), the project's AssemblyName, the min_game_version against the installed game, the configured RitsuLib dependency, and localization JSON. Then runs dotnet build, builds an optional PCK from assets/, and inspects the produced artifacts. The build writes output inside the mod directory. It does not edit source and does not test gameplay. Output text uses PASS, FAIL, or PARTIAL plus a NEXT line. Skipped compilation is PARTIAL, never PASS.",
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
      const cfg = readModRepoConfig(repoRoot);
      const gameConfig = readGameConfig(repoRoot);
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

        // 3. Every mod has a DLL. PCK is optional only when the repo enables the packer.
        if (manifestData.has_dll !== true)
          errors.push('has_dll must be true. Without it the loader never loads the assembly');
        if (manifestData.has_pck === true && cfg.compile?.pck !== true)
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

      // 6. csproj AssemblyName must equal id: the loader reads <id>.dll.
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

      const wantsPck = manifestData.has_pck === true && cfg.compile?.pck === true;
      const assetsDir = join(csprojDir, "assets");
      if (wantsPck && !hasSourceFiles(assetsDir)) {
        errors.push("has_pck is true, but assets/ is missing or empty. Create assets/ with the files that belong in the PCK");
      }

      // 7. Framework dependency and localization checks.
      if (csproj) {
        const projectText = readFileSync(csproj, "utf8");
        const deps = Array.isArray(manifestData.dependencies) ? manifestData.dependencies : [];
        for (const pkg of gameConfig.packages ?? []) {
          if (!projectText.includes(pkg.id) || !pkg.runtimeId) continue;
          const dep = deps.find((entry) => (entry as { id?: string }).id === pkg.runtimeId) as
            | { min_version?: string }
            | undefined;
          if (!dep) {
            errors.push(
              `the project references ${pkg.id} but the manifest does not declare ${pkg.runtimeId} in dependencies`,
            );
          } else if (pkg.version && (!dep.min_version || !isParseableVersion(dep.min_version))) {
            errors.push(
              `RitsuLib min_version is ${dep.min_version?.trim() || "missing"}. This harness targets RitsuLib ${pkg.version} or newer`,
            );
          } else if (pkg.version && dep.min_version && cmpVersion(dep.min_version, pkg.version) < 0) {
            errors.push(
              `RitsuLib min_version is ${dep.min_version}. This harness targets RitsuLib ${pkg.version} or newer`,
            );
          }
        }
      }
      const loc = localizationKeys(modDir);
      for (const bad of loc.badJson) errors.push(`localization/${bad} is not valid JSON`);

      // 8. Compile. dotnet comes from check_runtime's cache; the game dir from the path tools.
      const state = readState(repoRoot);
      const staticOk = errors.length === 0;
      let compilation: "skipped" | "passed" | "failed" = "skipped";
      let pckBuild: "not-required" | "skipped" | "passed" | "failed" = wantsPck ? "skipped" : "not-required";
      let installedVersion: string | null = null;

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

      if (compilation === "passed" && wantsPck) {
        const pckPath = join(csprojDir, "bin", "Release", `${modId}.pck`);
        rmSync(pckPath, { force: true });
        try {
          const toolProject = join(repoRoot, "tools", "pck-pack", "PckPack.csproj");
          const toolDll = join(repoRoot, "tools", "pck-pack", "bin", "Release", "net9.0", "pck-pack.dll");
          await runAsync(dotnet, ["build", toolProject, "-c", "Release", "--nologo", "-v", "quiet"], {
            cwd: repoRoot,
            timeoutMs: 300_000,
          });
          await runAsync(dotnet, [toolDll, assetsDir, pckPath], {
            cwd: csprojDir,
            timeoutMs: 300_000,
          });
          if (!existsSync(pckPath)) {
            pckBuild = "failed";
            errors.push(`missing ${modId}.pck after PCK build. Check has_pck and assets/`);
          } else {
            pckBuild = "passed";
          }
        } catch (e) {
          pckBuild = "failed";
          const err = e as { stderr?: string; stdout?: string; message?: string };
          errors.push(`PCK build failed: ${String(err.stderr || err.stdout || err.message).slice(0, 600)}`);
        }
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
      const ok =
        errors.length === 0 &&
        compilation === "passed" &&
        (pckBuild === "not-required" || pckBuild === "passed");
      const status = ok ? "pass" : compilation === "skipped" && errors.length === 0 ? "partial" : "fail";

      let nextAction: string;
      if (ok) {
        nextAction =
          "Run install_mod to copy the build into the game's mods directory, then restart the game and check godot.log. See the mod-installer skill.";
      } else if (compilation === "skipped" && errors.length === 0) {
        nextAction =
          "Fix the prerequisite named in the WARN lines, then run validate_mod again so the mod is actually compiled. See the setup-workspace skill.";
      } else if (errors.some((e) => e.includes("dotnet build failed") || e.includes("PCK build failed"))) {
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
        details: { ok, errors, warnings, compilation, pckBuild, modId, installedVersion },
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
