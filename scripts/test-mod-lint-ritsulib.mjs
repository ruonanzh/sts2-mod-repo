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

async function setup({ repoPck = true, modPck = true, assets = "valid", dependencies = "valid", stale = false, fixture = "ritsulib_probe", powerKeys = "valid", cardKeys = "valid", relicKeys = "valid", badAssetJson = false, ownerMismatch = false, inheritedPower = false, primitiveAssetJson = false, missingRitsuUsing = false, compilerNoise = false, unknownName = false } = {}) {
  const root = mkdtempSync(join(repoRoot, ".lint-ritsu-"));
  copyWithTsExtensions(join(repoRoot, ".pi"), join(root, ".pi"));
  cpSync(join(repoRoot, "tools", "pck-pack"), join(root, "tools", "pck-pack"), { recursive: true });
  cpSync(join(repoRoot, ".gamer-agent.local.json"), join(root, ".gamer-agent.local.json"));
  cpSync(join(repoRoot, "reference", fixture), join(root, "reference", fixture), { recursive: true });
  const modDir = join(root, "reference", fixture);
  rmSync(join(modDir, "bin"), { recursive: true, force: true });
  rmSync(join(modDir, "obj"), { recursive: true, force: true });
  const config = JSON.parse(readFileSync(join(repoRoot, "mod-repo.json"), "utf8"));
  config.compile.pck = repoPck;
  writeFileSync(join(root, "mod-repo.json"), JSON.stringify(config));
  const manifestFiles = { example_power: "ExamplePower.json", example_card: "ExampleCard.json", example_relic: "ExampleRelic.json" };
  const manifestPath = join(modDir, manifestFiles[fixture] ?? "RitsuR0Probe.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.has_pck = modPck;
  if (dependencies === "missing") delete manifest.dependencies;
  if (dependencies === "old") manifest.dependencies[0].min_version = "0.5.0";
  if (dependencies === "missing-min") delete manifest.dependencies[0].min_version;
  if (dependencies === "malformed") manifest.dependencies[0].min_version = "not-a-version";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  if (ownerMismatch && fixture === "example_power") {
    manifest.id = "RenamedPower";
    const renamedManifest = join(modDir, "RenamedPower.json");
    writeFileSync(renamedManifest, JSON.stringify(manifest));
    rmSync(manifestPath);
    const projectPath = join(modDir, "ExamplePower.csproj");
    writeFileSync(projectPath, readFileSync(projectPath, "utf8").replace("<AssemblyName>ExamplePower</AssemblyName>", "<AssemblyName>RenamedPower</AssemblyName>"));
    const oldAssets = join(modDir, "assets", "ExamplePower");
    const newAssets = join(modDir, "assets", "RenamedPower");
    cpSync(oldAssets, newAssets, { recursive: true });
    rmSync(oldAssets, { recursive: true, force: true });
    for (const lang of ["eng", "zhs"]) {
      const path = join(newAssets, "localization", lang, "powers.json");
      writeFileSync(path, readFileSync(path, "utf8").replaceAll("EXAMPLE_POWER_POWER_MOMENTUM", "RENAMED_POWER_POWER_MOMENTUM"));
    }
  }
  if (inheritedPower && fixture === "example_power") {
    writeFileSync(join(modDir, "Momentum.cs"), `using MegaCrit.Sts2.Core.Entities.Powers;
using STS2RitsuLib.Interop.AutoRegistration;
using STS2RitsuLib.Scaffolding.Content;
namespace ExamplePower;
[RegisterPower]
public abstract class BasePower : ModPowerTemplate
{
    public override PowerType Type => PowerType.Buff;
    public override PowerStackType StackType => PowerStackType.Counter;
}
public sealed class Momentum : BasePower { }
`);
    for (const lang of ["eng", "zhs"]) rmSync(join(modDir, "assets", "ExamplePower", "localization", lang, "powers.json"));
  }
  if (missingRitsuUsing && fixture === "example_power") {
    const path = join(modDir, "Momentum.cs");
    writeFileSync(path, readFileSync(path, "utf8").replace("using STS2RitsuLib.Scaffolding.Content;\n", ""));
  }
  if (compilerNoise && fixture === "example_power") {
    const conversions = Array.from({ length: 14 }, (_, index) => `int e${index} = "bad";`).join("\n    ");
    writeFileSync(join(modDir, "CompilerErrors.cs"), `namespace ExamplePower;
internal static class CompilerErrors
{
    private static void TakesGuid(System.Guid value) { }
    private static void Trigger()
    {
        ${conversions}
        TakesGuid("bad");
    }
}
`);
  }
  if (unknownName && fixture === "example_power") {
    const path = join(modDir, "Entry.cs");
    writeFileSync(path, readFileSync(path, "utf8").replace("var assembly = Assembly.GetExecutingAssembly();", "MissingRitsuName.Do();\n        var assembly = Assembly.GetExecutingAssembly();"));
  }
  if (fixture === "example_power" && powerKeys !== "valid") {
    for (const lang of ["eng", "zhs"]) {
      const path = join(modDir, "assets", "ExamplePower", "localization", lang, "powers.json");
      writeFileSync(path, powerKeys === "missing" ? "{}" : JSON.stringify({
        "MOMENTUM.title": "Momentum",
        "MOMENTUM.description": "Wrong type-only key",
      }));
    }
  }
  if (fixture === "example_card" && cardKeys !== "valid") {
    for (const lang of ["eng", "zhs"]) {
      writeFileSync(join(modDir, "assets", "ExampleCard", "localization", lang, "cards.json"), JSON.stringify({
        "FOCUSED_STRIKE.title": "Focused Strike",
        "FOCUSED_STRIKE.description": "Wrong type-only key",
      }));
    }
  }
  if (fixture === "example_relic" && relicKeys !== "valid") {
    for (const lang of ["eng", "zhs"]) {
      writeFileSync(join(modDir, "assets", "ExampleRelic", "localization", lang, "relics.json"), JSON.stringify({
        "AEGIS_SHARD.title": "Aegis Shard",
        "AEGIS_SHARD.description": "Wrong type-only key",
      }));
    }
  }
  if (badAssetJson) {
    writeFileSync(join(modDir, "assets", "ExampleCard", "localization", "eng", "cards.json"), "{bad json");
  }
  if (primitiveAssetJson) {
    writeFileSync(join(modDir, "assets", "ExampleCard", "localization", "eng", "cards.json"), "1");
  }
  if (assets === "missing") rmSync(join(modDir, "assets"), { recursive: true, force: true });
  if (assets === "empty") {
    rmSync(join(modDir, "assets"), { recursive: true, force: true });
    mkdirSync(join(modDir, "assets"));
  }
  if (assets === "invalid") {
    rmSync(join(modDir, "assets"), { recursive: true, force: true });
    mkdirSync(join(modDir, "assets"));
    mkdirSync(join(modDir, "assets", "RitsuR0Probe", "localization", "eng"), { recursive: true });
    writeFileSync(join(modDir, "assets", "RitsuR0Probe", "localization", "eng", "cards.json"), JSON.stringify({
      "RITSU_R0_PROBE_CARD_FOCUSED_STRIKE.title": "Focused Strike",
      "RITSU_R0_PROBE_CARD_FOCUSED_STRIKE.description": "Deal damage.",
    }));
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
await caseRun("valid Power localization", { fixture: "example_power" }, ({ text, details }) => {
  check("full Power localization ID passes", details.ok && details.powerLocalization === "passed" && details.powerCount === 1, text);
});
await caseRun("type-only Power localization", { fixture: "example_power", powerKeys: "type-only" }, ({ text, details }) => {
  check("type-only Power key is rejected before compilation", !details.ok && details.compilation === "skipped" && details.powerLocalization === "failed" && text.includes("EXAMPLE_POWER_POWER_MOMENTUM"), text);
});
await caseRun("missing Power localization", { fixture: "example_power", powerKeys: "missing" }, ({ text, details }) => {
  check("missing Power title and description are rejected", !details.ok && details.powerLocalization === "failed" && text.includes("title and description"), text);
});
await caseRun("valid Card localization", { fixture: "example_card" }, ({ text, details }) => {
  check("constant FullPublicEntry passes for Card", details.ok && details.cardLocalization === "passed" && details.cardCount === 1, text);
});
await caseRun("type-only Card localization", { fixture: "example_card", cardKeys: "type-only" }, ({ text, details }) => {
  check("type-only Card key is rejected before compilation", !details.ok && details.compilation === "skipped" && details.cardLocalization === "failed" && text.includes("EXAMPLE_CARD_FOCUSED_STRIKE"), text);
});
await caseRun("valid Relic localization", { fixture: "example_relic" }, ({ text, details }) => {
  check("constant FullPublicEntry passes for Relic", details.ok && details.relicLocalization === "passed" && details.relicCount === 1, text);
});
await caseRun("type-only Relic localization", { fixture: "example_relic", relicKeys: "type-only" }, ({ text, details }) => {
  check("type-only Relic key is rejected before compilation", !details.ok && details.compilation === "skipped" && details.relicLocalization === "failed" && text.includes("EXAMPLE_RELIC_AEGIS_SHARD"), text);
});
await caseRun("malformed assets localization", { fixture: "example_card", badAssetJson: true }, ({ text, details }) => {
  check("malformed JSON under assets is rejected", !details.ok && text.includes("assets/ExampleCard/localization/eng/cards.json is not valid JSON"), text);
});
await caseRun("primitive assets localization", { fixture: "example_card", primitiveAssetJson: true }, ({ text, details }) => {
  check("primitive JSON root is rejected by validate_mod", !details.ok && text.includes("assets/ExampleCard/localization/eng/cards.json is not valid JSON"), text);
});
await caseRun("renamed Power with stale registration owner", { fixture: "example_power", ownerMismatch: true }, ({ text, details }) => {
  check("stale RegisterModAssembly owner is rejected", !details.ok && details.compilation === "skipped" && text.includes('registration owner "ExamplePower" does not match manifest id "RenamedPower"'), text);
});
await caseRun("inherited Power without localization table", { fixture: "example_power", inheritedPower: true }, ({ text, details }) => {
  check("inherited Power returns not-checked with a visible warning", details.ok && details.powerLocalization === "not-checked" && text.includes("Content Pack or inherited registrations need a runtime localization check"), text);
});
await caseRun("missing RitsuLib namespace", { fixture: "example_power", missingRitsuUsing: true }, ({ text, details }) => {
  check("missing RitsuLib using fails compilation", !details.ok && details.compilation === "failed" && text.includes("error CS0246") && text.includes("Momentum.cs"), text);
  check("namespace failure names RitsuLib and game API lookup", text.includes("NEXT: Check missing using directives and assembly references. Use inspect_game_api dll=ritsulib for RitsuLib types and dll=game for game types, then rerun validate_mod."), text);
});
await caseRun("many unrelated compiler errors", { fixture: "example_power", compilerNoise: true }, ({ text, details }) => {
  check("late compiler errors remain visible", !details.ok && details.compilation === "failed" && text.includes("error CS1503"), text);
  check("unrelated compiler errors keep generic NEXT", text.includes("NEXT: Read the compiler error above") && !text.includes("NEXT: Check missing using directives"), text);
});
await caseRun("unknown name without missing using", { fixture: "example_power", unknownName: true }, ({ text, details }) => {
  check("CS0103 remains visible", !details.ok && details.compilation === "failed" && text.includes("error CS0103") && text.includes("MissingRitsuName"), text);
  check("CS0103 alone keeps generic NEXT", text.includes("NEXT: Read the compiler error above") && !text.includes("NEXT: Check missing using directives"), text);
});

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
