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
import { modInstallDirFor, readModRepoConfig, readState } from "../lib/game-paths";
import { readManifest } from "../lib/mod-identity";
import { readModLoadingState } from "../lib/game-settings";

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
      const recorded = typeof state.modInstallDir === "string" ? state.modInstallDir : null;
      const gameDir = typeof state.gameDir === "string" ? state.gameDir : null;
      let modRoot = recorded;
      if (!modRoot && gameDir) {
        // Derive from the confirmed game directory, never from a guess: mac is inside the
        // .app bundle (Contents/MacOS/mods), Windows is <install>/mods.
        modRoot = modInstallDirFor(gameDir, readModRepoConfig(repoRoot));
      }
      if (!modRoot || !existsSync(modRoot)) {
        return {
          content: [
            {
              type: "text",
              text: `FAIL: the mod install directory is not recorded or does not exist.\nNEXT: run try_set_game_dir first (it derives and records the mods directory), then install again.`,
            },
          ],
          details: { ok: false, reason: "NO_TARGET" },
        };
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

      // Report the mod-loading switch. This is the difference between "installed" and
      // "will actually load", and the game gives no hint when the switch is off.
      const loading = readModLoadingState();
      const lines: string[] = [];
      lines.push(`PASS: installed ${id} into ${target}`);
      if (renamed)
        lines.push(
          `NOTE: the target ${dirName} is used by another mod, so this copy went to ${targetName}. That other mod was not touched.`,
        );

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