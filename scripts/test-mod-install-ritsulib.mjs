import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(repoRoot, ".ritsu-dep-check-"));
const results = [];
const check = (name, condition, detail = "") => {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${!condition && detail ? `\n      ${detail}` : ""}`);
};

function copyWithTsExtensions(from, to) {
  cpSync(from, to, { recursive: true });
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) {
        const source = readFileSync(path, "utf8");
        writeFileSync(path, source.replace(/(from\s+")(\.\.?\/[^"]+?)(")/g, (m, a, spec, c) =>
          spec.endsWith(".ts") || spec.endsWith(".js") ? m : `${a}${spec}.ts${c}`));
      }
    }
  };
  walk(to);
}

try {
  copyWithTsExtensions(join(repoRoot, ".pi"), join(tmp, ".pi"));
  const vendor = join(tmp, "vendor", "ritsulib");
  mkdirSync(join(vendor, "shared"), { recursive: true });
  mkdirSync(join(vendor, "compat", "0.107.1"), { recursive: true });
  writeFileSync(join(vendor, "mod_manifest.json"), JSON.stringify({ id: "STS2-RitsuLib", version: "0.6.10", has_dll: true, has_pck: false, dependencies: [{ id: "ChildLib", min_version: "1.0.0" }] }));
  writeFileSync(join(vendor, "STS2-RitsuLib.dll"), "loader");
  writeFileSync(join(vendor, "assets.zip"), "assets");
  writeFileSync(join(vendor, "shared", "STS2-RitsuLib.Shared.dll"), "shared");
  writeFileSync(join(vendor, "compat", "0.107.1", "STS2-RitsuLib.Runtime.dll"), "runtime");
  writeFileSync(join(vendor, "README.md"), "repository only");
  writeFileSync(join(vendor, "LICENSE.txt"), "MIT");
  for (const [id, dependency] of [["ChildLib", "GrandChildLib"], ["GrandChildLib", "STS2-RitsuLib"]]) {
    const dir = join(tmp, "vendor", id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "mod_manifest.json"), JSON.stringify({ id, version: "1.0.0", dependencies: [{ id: dependency, min_version: "0.6.10" }] }));
    writeFileSync(join(dir, `${id}.dll`), id);
  }
  writeFileSync(join(tmp, "mod-repo.json"), JSON.stringify({
    modInstall: { relativeTo: "gameDir", path: { mac: "mods", windows: "mods" } },
    runtimeDependencies: [
      { id: "STS2-RitsuLib", vendorDir: "vendor/ritsulib" },
      { id: "ChildLib", vendorDir: "vendor/ChildLib" },
      { id: "GrandChildLib", vendorDir: "vendor/GrandChildLib" },
    ],
  }));

  const modDir = join(tmp, "MyMod");
  mkdirSync(modDir);
  writeFileSync(join(modDir, "MyMod.json"), JSON.stringify({
    id: "MyMod", version: "0.1.0", has_dll: true, has_pck: true,
    dependencies: [{ id: "STS2-RitsuLib", min_version: "0.6.10" }],
  }));
  writeFileSync(join(modDir, "MyMod.dll"), "mod");
  writeFileSync(join(modDir, "MyMod.pck"), "pck");
  writeFileSync(join(modDir, "asset_manifest.jsonl"), "{\"audit\":true}\n");

  const { default: register } = await import(pathToFileURL(join(tmp, ".pi", "extensions", "mod-install.ts")).href);
  let tool;
  register({ registerTool: (definition) => { tool = definition; } });
  const modsRoot = join(tmp, "mods");
  const workshopRoot = join(tmp, "workshop");
  mkdirSync(modsRoot);
  mkdirSync(workshopRoot);
  writeFileSync(join(tmp, ".gamer-agent.local.json"), JSON.stringify({ modInstallDir: modsRoot, workshopDir: workshopRoot }));
  const runInstall = async () => {
    const result = await tool.execute("call", { modDir }, undefined, undefined, { cwd: tmp });
    return { text: result.content.map((item) => item.text).join("\n"), details: result.details };
  };

  const first = await runInstall();
  const installed = join(modsRoot, "STS2-RitsuLib");
  check("official mod_manifest.json is accepted", existsSync(join(installed, "mod_manifest.json")), first.text);
  check("root loader and assets.zip are installed", existsSync(join(installed, "STS2-RitsuLib.dll")) && existsSync(join(installed, "assets.zip")), first.text);
  check("shared runtime directory is preserved", existsSync(join(installed, "shared", "STS2-RitsuLib.Shared.dll")), first.text);
  check("compat runtime directory is preserved", existsSync(join(installed, "compat", "0.107.1", "STS2-RitsuLib.Runtime.dll")), first.text);
  check("repository docs are not installed", !existsSync(join(installed, "README.md")) && !existsSync(join(installed, "LICENSE.txt")), first.text);
  check("consumer mod and PCK are installed", existsSync(join(modsRoot, "MyMod", "MyMod.dll")) && existsSync(join(modsRoot, "MyMod", "MyMod.pck")), first.text);
  check("asset manifest is not installed", !existsSync(join(modsRoot, "MyMod", "asset_manifest.jsonl")), first.text);
  check("recursive dependencies are installed", existsSync(join(modsRoot, "ChildLib", "ChildLib.dll")) && existsSync(join(modsRoot, "GrandChildLib", "GrandChildLib.dll")), first.text);
  check("cyclic dependencies terminate", /GrandChildLib/.test(first.text), first.text);

  writeFileSync(join(installed, "MARKER"), "keep this installation");
  writeFileSync(join(installed, "STS2-RitsuLib.json"), "{invalid preferred manifest");
  const second = await runInstall();
  check("existing official runtime is not overwritten", readFileSync(join(installed, "MARKER"), "utf8") === "keep this installation", second.text);
  check("existing official runtime is reported as installed", /already installed/.test(second.text), second.text);
  check("invalid preferred JSON falls back to official manifest", !/was not installed/.test(second.text), second.text);

  const resetMods = () => {
    rmSync(modsRoot, { recursive: true, force: true });
    mkdirSync(modsRoot);
  };
  const vendorManifestPath = join(vendor, "mod_manifest.json");
  const consumerManifestPath = join(modDir, "MyMod.json");
  const vendorManifest = JSON.parse(readFileSync(vendorManifestPath, "utf8"));
  vendorManifest.version = "0.6.9";
  writeFileSync(vendorManifestPath, JSON.stringify(vendorManifest));
  resetMods();
  const oldVendor = await runInstall();
  check("old bundled runtime is not installed", !existsSync(join(modsRoot, "STS2-RitsuLib")), oldVendor.text);
  check("old bundled runtime does not produce dependency PASS", /older than required 0.6.10/.test(oldVendor.text) && !/PASS: dependency STS2-RitsuLib/.test(oldVendor.text), oldVendor.text);

  const consumerManifest = JSON.parse(readFileSync(consumerManifestPath, "utf8"));
  consumerManifest.dependencies[0].min_version = "0.5.0";
  writeFileSync(consumerManifestPath, JSON.stringify(consumerManifest));
  const repoConfigPath = join(tmp, "mod-repo.json");
  const repoConfig = JSON.parse(readFileSync(repoConfigPath, "utf8"));
  repoConfig.runtimeDependencies[0].version = "0.6.10";
  writeFileSync(repoConfigPath, JSON.stringify(repoConfig));
  resetMods();
  const mismatched = await runInstall();
  check("repository/vendor version mismatch is rejected", /does not match repository version 0.6.10/.test(mismatched.text) && !existsSync(join(modsRoot, "STS2-RitsuLib")), mismatched.text);

  delete vendorManifest.version;
  writeFileSync(vendorManifestPath, JSON.stringify(vendorManifest));
  resetMods();
  const unreadable = await runInstall();
  check("unreadable vendor version is rejected", /no readable version/.test(unreadable.text) && !existsSync(join(modsRoot, "STS2-RitsuLib")), unreadable.text);

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
