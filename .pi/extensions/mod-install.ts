import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { modInstallDirFor, pathsFromGameDir, readModRepoConfig, readState } from "../lib/game-paths";
import { readManifest } from "../lib/mod-identity";
import { readModLoadingState } from "../lib/game-settings";
import {
  decideDependencyAction,
  readDependencySpecs,
  resolveDependency,
  stripBom,
  type DepSpec,
  type ResolveContext,
} from "../lib/mod-deps";

/**
 * install_mod -- copy a mod's runtime products into the game's mods directory.
 *
 * Target comes from the path tools' record in .gamer-agent.local.json. install_mod never
 * discovers the game itself.
 *
 * Products for this modType are exactly two files (godot-csharp, DLL-only):
 *   <id>.json   the manifest, file name equal to the id
 *   <id>.dll    the assembly, file name equal to the id
 * StS2 resolves both by the manifest id, so a wrong file name is silently not loaded.
 *
 * Ownership and idempotence use a workspace-side record at <modDir>/.pi-mod.json
 * ({ name, installedDir }). Nothing of ours is written into the game directory.
 *
 * Conflict rule (docs/mod-repo-guide.md 4.1): if the target directory exists and is not
 * the one we recorded, another mod owns it. Install as <dir>_pimod instead of overwriting.
 */

interface InstallRecord {
  name: string;
  installedDir: string;
}

function readRecord(modDir: string): InstallRecord | null {
  const p = join(modDir, ".pi-mod.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<InstallRecord>;
    if (typeof raw.installedDir !== "string" || !raw.installedDir) return null;
    return { name: typeof raw.name === "string" ? raw.name : "", installedDir: raw.installedDir };
  } catch {
    return null;
  }
}

function writeRecord(modDir: string, record: InstallRecord): void {
  writeFileSync(join(modDir, ".pi-mod.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

/**
 * Pick the directory to install into.
 * Preference: the recorded one (in-place update), then <modDirName>, then <modDirName>_pimod<N>.
 */
function chooseTarget(modRoot: string, dirName: string, record: InstallRecord | null): string {
  if (record && existsSync(record.installedDir)) return record.installedDir;
  const base = join(modRoot, dirName);
  if (!existsSync(base)) return base;
  for (let n = 1; n < 100; n++) {
    const candidate = join(modRoot, `${dirName}_pimod${n === 1 ? "" : n}`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(modRoot, `${dirName}_pimod`);
}

/**
 * A dependency this repository can put on disk itself: `runtimeDependencies[]` in mod-repo.json.
 * `vendorDir` is a repository path; its contents are copied verbatim into the game's mods
 * directory as `<id>/`. Nothing about which dependency is bundled is hardcoded here.
 */
interface VendorSpec {
  id: string;
  dir: string;
  workshopUrl?: string;
}

function readVendorSpecs(repoRoot: string): VendorSpec[] {
  let raw: { runtimeDependencies?: unknown };
  try {
    raw = JSON.parse(stripBom(readFileSync(join(repoRoot, "mod-repo.json"), "utf8")));
  } catch {
    return [];
  }
  const list = raw?.runtimeDependencies;
  if (!Array.isArray(list)) return [];
  const out: VendorSpec[] = [];
  for (const entry of list) {
    const rec = entry as { id?: unknown; vendorDir?: unknown; workshopUrl?: unknown };
    if (typeof rec?.id !== "string" || !rec.id.trim()) continue;
    if (typeof rec?.vendorDir !== "string" || !rec.vendorDir.trim()) continue;
    out.push({
      id: rec.id.trim(),
      dir: resolve(repoRoot, rec.vendorDir),
      workshopUrl: typeof rec.workshopUrl === "string" ? rec.workshopUrl : undefined,
    });
  }
  return out;
}

/**
 * Copy a bundled dependency into the mods directory. Called only when the player has no copy
 * at all (see `decideDependencyAction`) -- copying over an existing one is what pins an old
 * version forever, because the loader prefers the local copy over the Workshop one.
 */
function installBundled(
  vendor: VendorSpec,
  modRoot: string,
): { ok: true; dir: string } | { ok: false; reason: string } {
  if (!existsSync(vendor.dir)) return { ok: false, reason: `${vendor.dir} does not exist` };
  const target = join(modRoot, vendor.id);
  if (existsSync(target)) return { ok: false, reason: `${target} already exists` };
  const staging = join(modRoot, `.staging-dep-${process.pid}-${Date.now()}`);
  try {
    mkdirSync(staging, { recursive: true });
    for (const entry of readdirSync(vendor.dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      // Documentation and licences are ours, not the game's.
      if (entry.name.toLowerCase() === "readme.md") continue;
      if (entry.name.toLowerCase().startsWith("license")) continue;
      cpSync(join(vendor.dir, entry.name), join(staging, entry.name));
    }
    // The loader finds a mod's manifest by id, so a missing <id>.json would install nothing.
    if (!existsSync(join(staging, `${vendor.id}.json`))) {
      rmSync(staging, { recursive: true, force: true });
      return { ok: false, reason: `the bundled copy has no ${vendor.id}.json` };
    }
    renameSync(staging, target);
    return { ok: true, dir: target };
  } catch (error) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

interface DependencyReport {
  lines: string[];
  /** Non-empty when the player has to act before the mod can load. */
  blockers: string[];
}

/**
 * Report on every dependency the mod declares, and fill only the ones nobody has.
 *
 * The rule this enforces is in .pi/lib/mod-deps.ts: a local copy wins over a Workshop copy,
 * silently, so installing one where any copy already exists would pin the version.
 */
function handleDependencies(args: {
  specs: DepSpec[];
  ctx: ResolveContext;
  modRoot: string;
  vendors: VendorSpec[];
}): DependencyReport {
  const { specs, ctx, modRoot, vendors } = args;
  const lines: string[] = [];
  const blockers: string[] = [];

  for (const spec of specs) {
    const action = decideDependencyAction(resolveDependency(spec, ctx));
    const min = spec.minVersion ? ` (needs ${spec.minVersion} or newer)` : "";
    const vendor = vendors.find((v) => v.id === spec.id);

    if (action.kind === "ok") {
      const res = resolveDependency(spec, ctx);
      const shown = res.installations.find((i) => i.source === "local") ?? res.installations[0];
      const from = shown?.source === "workshop" ? "from the Workshop" : "from the mods directory";
      lines.push(`NOTE: dependency ${spec.id} ${shown?.version ?? "(version unreadable)"} is already installed ${from}; it was not touched.`);
      continue;
    }

    if (action.kind === "install-bundled") {
      if (!vendor) {
        lines.push(`WARN: dependency ${spec.id} is not installed, and this repository ships no bundled copy${min}.`);
        blockers.push(
          `Ask the player to subscribe to ${spec.id} in the Steam Workshop, then restart the game.`,
        );
        continue;
      }
      const done = installBundled(vendor, modRoot);
      if (!done.ok) {
        lines.push(`WARN: dependency ${spec.id} is not installed and the bundled copy could not be placed: ${done.reason}.`);
        blockers.push(
          vendor.workshopUrl
            ? `Ask the player to subscribe to ${spec.id} in the Steam Workshop (${vendor.workshopUrl}), then restart the game.`
            : `Ask the player to subscribe to ${spec.id} in the Steam Workshop, then restart the game.`,
        );
        continue;
      }
      const after = resolveDependency(spec, ctx);
      const got = after.installations.find((i) => i.dir === done.dir)?.version ?? null;
      lines.push(`PASS: dependency ${spec.id} was not installed, so the bundled ${got ?? ""} was placed in ${done.dir}.`);
      lines.push(
        `NOTE: that copy now wins over any Workshop subscription the player makes later (the loader prefers the mods directory). If the player subscribes anyway, the local copy has to be removed.`,
      );
      continue;
    }

    // Every remaining case leaves the installed copy exactly as it is.
    const res = resolveDependency(spec, ctx);
    if (action.kind === "warn-duplicate-local") {
      const locals = res.installations.filter((i) => i.source === "local");
      const list = locals.map((i) => `${i.version ?? "?"} in ${i.dir}`).join(", ");
      lines.push(
        `WARN: ${spec.id} exists ${locals.length} times in the mods directory - ${list}. The game loads the first copy it scans and fails the other with DUPLICATE_ID.`,
      );
      blockers.push(
        `Tell the player to keep one copy and delete the rest, then restart the game. Do not delete anything for them without asking.`,
      );
      continue;
    }
    if (action.kind === "warn-duplicate") {
      const local = res.installations.find((i) => i.source === "local");
      const workshop = res.installations.find((i) => i.source === "workshop");
      lines.push(
        `WARN: ${spec.id} exists in both places - ${local?.version ?? "?"} in ${local?.dir} and ${workshop?.version ?? "?"} from the Workshop. The game loads only the local one and disables the Workshop copy, so Workshop updates never apply.`,
      );
      blockers.push(
        `Tell the player to delete ${local?.dir} and keep the Workshop subscription, then restart the game. Do not delete it for them without asking.`,
      );
      continue;
    }
    if (action.kind === "warn-too-old") {
      const shown = res.installations.find((i) => i.source === "local") ?? res.installations[0];
      lines.push(`WARN: ${spec.id} ${shown?.version ?? ""} is older than the required ${spec.minVersion}${min}.`);
      blockers.push(
        shown?.source === "workshop"
          ? `Tell the player to update ${spec.id} in the Steam Workshop, then restart the game. Do not install a copy over it.`
          : `Tell the player the local ${spec.id} is too old; it has to be removed or replaced before this mod works. Do not overwrite it silently.`,
      );
      continue;
    }
    const shown = res.installations[0];
    lines.push(`WARN: could not read the version of ${spec.id} in ${shown?.dir}${min}.`);
    blockers.push(`Ask the player to confirm the ${spec.id} version, or reinstall it from the Steam Workshop.`);
  }

  return { lines, blockers };
}

/** Locate the built assembly: mod root first (Publish-style output), then bin/Release. */
function findDll(modDir: string, id: string): string | null {
  const candidates = [
    join(modDir, `${id}.dll`),
    join(modDir, "bin", "Release", `${id}.dll`),
    join(modDir, "bin", "Debug", `${id}.dll`),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "install_mod",
    label: "Install Mod",
    description:
      "Copies a mod's runtime products into the Slay the Spire 2 mods directory that try_set_game_dir or set_game_dir recorded. Products are the manifest <id>.json and the assembly <id>.dll. On macOS the target is SlayTheSpire2.app/Contents/MacOS/mods/<dir>; on Windows it is <install>/mods/<dir>. Re-installing the same mod updates it in place. If another mod owns the target directory, install_mod uses <dir>_pimod and does not overwrite it. It reports whether the game's mod loading switch (mod_settings.mods_enabled) is on, because the game silently skips every mod while that switch is off. It does not compile and does not install SDKs.",
    promptSnippet: "Install a validated mod into the game so the player can try it",
    promptGuidelines: [
      "Run install_mod only after validate_mod passes. install_mod copies files; it does not compile.",
      "If install_mod reports that mod loading is switched off, tell the player to enable mods in the game's Mod Settings and restart. Do not claim the mod will load until that switch is on.",
      "After install_mod succeeds, the player must restart the game. A newly added mod is only detected at startup.",
    ],
    parameters: Type.Object({
      modDir: Type.String({
        description:
          "Path to the mod directory in the workspace. A relative path is resolved against the workspace root.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const repoRoot = ctx.cwd;
      const modDir = resolve(repoRoot, params.modDir);

      const manifest = readManifest(modDir);
      if (!manifest.ok) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: ${manifest.reason}\nNEXT: run validate_mod on this mod directory and fix the reported problems before installing.`,
            },
          ],
          details: { ok: false, reason: "MANIFEST", detail: manifest.reason },
        };
      }
      const id = manifest.identity.id;

      // Target directory comes from the recorded paths only.
      const state = readState(repoRoot);
      const config = readModRepoConfig(repoRoot);
      const recorded = typeof state.modInstallDir === "string" ? state.modInstallDir : null;
      const gameDir = typeof state.gameDir === "string" ? state.gameDir : null;
      let modRoot = recorded;
      if (!modRoot && gameDir) {
        // Derive from the confirmed game directory, never from a guess: mac is inside the
        // .app bundle (Contents/MacOS/mods), Windows is <install>/mods.
        modRoot = modInstallDirFor(gameDir, config);
      }
      if (!modRoot) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: the mod install directory is not recorded.\nNEXT: run try_set_game_dir first (it derives and records the mods directory), then install again.`,
            },
          ],
          details: { ok: false, reason: "NO_TARGET" },
        };
      }
      // The game never creates its own mods directory, and nothing else here does either.
      // On a machine that has never had a mod, the recorded path does not exist yet. Refusing
      // here made the first install a dead end: this tool said "run try_set_game_dir", and that
      // tool derives the same path again. So create it, and say so.
      let createdModRoot = false;
      if (!existsSync(modRoot)) {
        try {
          mkdirSync(modRoot, { recursive: true });
          createdModRoot = true;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `FAIL: the mods directory is missing and could not be created: ${modRoot}\nReason: ${error instanceof Error ? error.message : String(error)}\nNEXT: check that the game directory exists and is writable, then run try_set_game_dir again.`,
              },
            ],
            details: { ok: false, reason: "CANNOT_CREATE_TARGET", detail: String(error) },
          };
        }
      }

      // Products. The two file names are hard requirements: the loader reads <id>.dll.
      const dll = findDll(modDir, id);
      if (!dll) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: ${id}.dll not found in ${modDir} (looked in the mod directory and under bin/Release).\nNEXT: run validate_mod to compile the mod, then install again.`,
            },
          ],
          details: { ok: false, reason: "NO_DLL", modId: id },
        };
      }
      if (!existsSync(manifest.identity.manifestPath)) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: the manifest ${id}.json disappeared between validation and install.\nNEXT: restore it and run validate_mod again.`,
            },
          ],
          details: { ok: false, reason: "NO_MANIFEST", modId: id },
        };
      }

      // The directory name is the your_mods directory name, not the manifest id:
      // basename() keeps it a single path segment, so it cannot escape the mods root.
      const dirName = basename(modDir);
      const record = readRecord(modDir);
      const target = chooseTarget(modRoot, dirName, record);
      const targetName = basename(target);
      const renamed = targetName !== dirName;

      // Transactional: stage next to the target, then swap.
      const staging = join(modRoot, `.staging-${process.pid}-${Date.now()}`);
      try {
        mkdirSync(staging, { recursive: true });
        cpSync(manifest.identity.manifestPath, join(staging, `${id}.json`));
        cpSync(dll, join(staging, `${id}.dll`));

        // Images that a mod loads at runtime from its own directory. A DLL-only mod has no
        // res://<id>/ namespace, so a texture has to come from a file next to the assembly.
        for (const entry of readdirSync(modDir, { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          if (!/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) continue;
          try {
            cpSync(join(modDir, entry.name), join(staging, entry.name));
          } catch {
            /* a locked image should not abort the install */
          }
        }

        // Any other runtime DLLs sitting next to the built assembly are dependencies
        // (a vendored library, a helper). The game resolves them from the mod folder root.
        const dllDir = join(dll, "..");
        if (existsSync(dllDir) && resolve(dllDir) !== resolve(modDir)) {
          for (const entry of readdirSync(dllDir, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".dll")) continue;
            if (entry.name === `${id}.dll`) continue;
            try {
              cpSync(join(dllDir, entry.name), join(staging, entry.name));
            } catch {
              /* a locked or unreadable dependency should not abort the install */
            }
          }
        }

        // Swap. Old copy is moved aside first so a failure cannot leave a half-installed mod.
        const aside = `${target}.old-${process.pid}`;
        if (existsSync(target)) renameSync(target, aside);
        try {
          renameSync(staging, target);
          if (existsSync(aside)) rmSync(aside, { recursive: true, force: true });
        } catch (e) {
          if (existsSync(aside) && !existsSync(target)) renameSync(aside, target);
          throw e;
        }
      } catch (error) {
        if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
        return {
          content: [
            {
              type: "text",
              text: `FAIL: copy failed: ${error instanceof Error ? error.message : String(error)}\nNEXT: check write permission on ${modRoot}. Any previously installed copy was left in place.`,
            },
          ],
          details: { ok: false, reason: "COPY_FAILED", detail: String(error) },
        };
      }

      writeRecord(modDir, { name: id, installedDir: target });

      const lines: string[] = [];
      lines.push(`PASS: installed ${id} into ${target}`);
      if (createdModRoot)
        lines.push(
          `NOTE: the mods directory did not exist, so this tool created it. The game does not create it, and a game that has never had a mod does not have it yet.`,
        );
      if (renamed)
        lines.push(
          `NOTE: the target ${dirName} is used by another mod, so this copy went to ${targetName}. That other mod was not touched.`,
        );

      // Dependency mods (BaseLib and the like). This mod cannot load without them, and
      // copying one over an existing copy would pin that copy's version forever.
      const workshopDir =
        typeof state.workshopDir === "string"
          ? state.workshopDir
          : gameDir
            ? pathsFromGameDir(gameDir, config).workshopDir
            : null;
      let depLockers: string[] = [];
      const specs = readDependencySpecs(manifest.identity.manifestPath);
      if (specs.length) {
        const report = handleDependencies({
          specs,
          ctx: { modRoot, workshopDir },
          modRoot,
          vendors: readVendorSpecs(repoRoot),
        });
        lines.push(...report.lines);
        depLockers = report.blockers;
      }

      // Report the mod-loading switch. This is the difference between "installed" and
      // "will actually load", and the game gives no hint when the switch is off.
      const loading = readModLoadingState();
      let nextAction: string;
      if (loading.modsEnabled === false) {
        lines.push(
          "WARN: mod loading is switched OFF in the game's settings (mod_settings.mods_enabled = false). The game will list the mod as disabled and load nothing, without an error.",
        );
        nextAction =
          "Tell the player to enable mods in the game's Mod Settings, then restart the game. See the mod-installer skill.";
      } else if (loading.modsEnabled === null) {
        lines.push(
          `NOTE: could not read the mod-loading switch${loading.settingsPath ? ` in ${loading.settingsPath}` : " (no settings.save found; the player may not have launched the game yet)"}.`,
        );
        nextAction =
          "Restart the game and confirm the mod appears and loads. If it shows as disabled, enable mods in the game's Mod Settings. See the mod-installer skill.";
      } else {
        nextAction =
          "Restart the game and check godot.log for 'Loading assembly DLL' and 'RUNNING MODDED'. See the mod-installer skill.";
      }
      // A dependency problem outranks the restart advice: the mod cannot load until it is fixed.
      if (depLockers.length) nextAction = depLockers.join(" ");
      lines.push(`NEXT: ${nextAction}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {
          ok: true,
          modId: id,
          installedDir: target,
          renamed,
          modsEnabled: loading.modsEnabled,
          settingsPath: loading.settingsPath,
        },
      };
    },
  });
}