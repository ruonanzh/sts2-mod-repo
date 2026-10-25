import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
        writeFileSync(path, readFileSync(path, "utf8").replace(/(from\s+")(\.\.?\/[^"]+?)(")/g, (m, a, spec, c) =>
          spec.endsWith(".ts") || spec.endsWith(".js") ? m : `${a}${spec}.ts${c}`));
      }
    }
  };
  walk(to);
}

async function setup({ repoPck = true, modPck = true, assets = "valid", dependencies = "valid", stale = false } = {}) {
  const root = mkdtempSync(join(repoRoot, ".lint-ritsu-"));
  copyWithTsExtensions(join(repoRoot, ".pi"), join(root, ".pi"));
  cpSync(join(repoRoot, "tools", "pck-pack"), join(root, "tools", "pck-pack"), { recursive: true });
  cpSync(join(repoRoot, ".gamer-agent.local.json"), join(root, ".gamer-agent.local.json"));
  cpSync(join(repoRoot, "reference", "ritsulib_probe"), join(root, "reference", "ritsulib_probe"), { recursive: true });
  const modDir = join(root, "reference", "ritsulib_probe");
  rmSync(join(modDir, "bin"), { recursive: true, force: true });
  rmSync(join(modDir, "obj"), { recursive: true, force: true });
  const config = JSON.parse(readFileSync(join(repoRoot, "mod-repo.json"), "utf8"));
  config.compile.pck = repoPck;
  writeFileSync(join(root, "mod-repo.json"), JSON.stringify(config));
  const manifestPath = join(modDir, "RitsuR0Probe.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.has_pck = modPck;
  if (dependencies === "missing") delete manifest.dependencies;
  if (dependencies === "old") manifest.dependencies[0].min_version = "0.5.0";
  if (dependencies === "missing-min") delete manifest.dependencies[0].min_version;
  if (dependencies === "malformed") manifest.dependencies[0].min_version = "not-a-version";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  if (assets === "missing") rmSync(join(modDir, "assets"), { recursive: true, force: true });
  if (assets === "empty") {
    rmSync(join(modDir, "assets"), { recursive: true, force: true });
    mkdirSync(join(modDir, "assets"));
  }
  if (assets === "invalid") {
    rmSync(join(modDir, "assets"), { recursive: true, force: true });
    mkdirSync(join(modDir, "assets"));
    writeFileSync(join(modDir, "assets", "bad.png"), "not a png");
  }
  if (stale) {
    mkdirSync(join(modDir, "bin", "Release"), { recursive: true });
    writeFileSync(join(modDir, "bin", "Release", "RitsuR0Probe.pck"), "stale");
  }
  const { default: register } = await import(pathToFileURL(join(root, ".pi", "extensions", "mod-lint.ts")).href);
  let tool;
  register({ registerTool: (definition) => { tool = definition; } });
  const execute = async () => {
    const result = await tool.execute("call", { modDir }, undefined, undefined, { cwd: root });
    return { text: result.content.map((item) => item.text).join("\n"), details: result.details };
  };
  return { root, execute };
}

async function caseRun(name, options, verify) {
  const { root, execute } = await setup(options);
  try {
    const result = await execute();
    verify({ ...result, root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

await caseRun("compile.pck=true and has_pck=true", {}, ({ text, details }) => {
  check("enabled PCK builds successfully", details.ok && details.pckBuild === "passed", text);
});
await caseRun("compile.pck=true and has_pck=false", { modPck: false }, ({ text, details }) => {
  check("DLL-only mod needs no assets", details.ok && details.pckBuild === "not-required", text);
});
await caseRun("compile.pck=false and has_pck=true", { repoPck: false }, ({ text, details }) => {
  check("repo-disabled PCK is rejected", !details.ok && text.includes("this repo builds DLL-only mods"), text);
});
await caseRun("compile.pck=false and has_pck=false", { repoPck: false, modPck: false }, ({ text, details }) => {
  check("repo-disabled PCK still permits DLL-only", details.ok && details.pckBuild === "not-required", text);
});
await caseRun("missing assets", { assets: "missing" }, ({ text, details }) => {
  check("missing assets is rejected", !details.ok && text.includes("assets/ is missing or empty"), text);
});
await caseRun("empty assets", { assets: "empty" }, ({ text, details }) => {
  check("empty assets is rejected", !details.ok && text.includes("assets/ is missing or empty"), text);
});
await caseRun("bad PNG with stale PCK", { assets: "invalid", stale: true }, ({ text, details, root }) => {
  check("PCK build failure is reported", !details.ok && details.pckBuild === "failed" && text.includes("PCK build failed"), text);
  check("failed PCK build removes the stale artifact", !existsSync(join(root, "reference", "ritsulib_probe", "bin", "Release", "RitsuR0Probe.pck")), text);
});
await caseRun("missing RitsuLib dependency", { dependencies: "missing" }, ({ text, details }) => {
  check("missing runtime dependency is rejected", !details.ok && text.includes("does not declare STS2-RitsuLib"), text);
});
await caseRun("old RitsuLib dependency", { dependencies: "old" }, ({ text, details }) => {
  check("old runtime minimum is rejected", !details.ok && text.includes("RitsuLib min_version is 0.5.0"), text);
});
await caseRun("missing RitsuLib min_version", { dependencies: "missing-min" }, ({ text, details }) => {
  check("omitted runtime minimum is rejected", !details.ok && text.includes("RitsuLib min_version is missing"), text);
});
await caseRun("malformed RitsuLib min_version", { dependencies: "malformed" }, ({ text, details }) => {
  check("malformed runtime minimum is rejected", !details.ok && text.includes("RitsuLib min_version is not-a-version"), text);
});

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
