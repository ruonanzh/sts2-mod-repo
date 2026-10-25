import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = mkdtempSync(join(repoRoot, ".incomplete-dump-"));

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

try {
  copyWithTsExtensions(join(repoRoot, ".pi"), join(root, ".pi"));
  cpSync(join(repoRoot, "tools", "api-probe"), join(root, "tools", "api-probe"), { recursive: true });
  cpSync(join(repoRoot, "mod-repo.json"), join(root, "mod-repo.json"));
  cpSync(join(repoRoot, ".gamer-agent.local.json"), join(root, ".gamer-agent.local.json"));
  writeFileSync(join(root, ".pi", "lib", "decompile.json"), JSON.stringify({
    version: 1,
    runtime: "mono",
    dump: {
      assemblies: ["ritsulib", "missing"],
      paths: {
        ritsulib: join(repoRoot, "vendor", "ritsulib", "compat", "0.107.1", "STS2-RitsuLib.dll"),
        missing: join(root, "missing.dll"),
      },
      budgetBytes: 2000000,
    },
  }));
  process.env.DECOMPILED_ROOT = join(root, "decompiled");
  const { default: register } = await import(pathToFileURL(join(root, ".pi", "extensions", "inspect-game-code.ts")).href);
  let tool;
  register({ registerTool: (definition) => { tool = definition; } });
  const result = await tool.execute("call", { action: "dump", force: true }, undefined, () => {}, { cwd: root });
  const text = result.content.map((item) => item.text).join("\n");
  const pass = result.details.ok === false && result.details.reason === "INCOMPLETE_DUMP" && text.startsWith("PARTIAL:") && text.includes("NEXT:");
  console.log(`${pass ? "PASS" : "FAIL"}  incomplete configured dump returns PARTIAL and NEXT`);

  const status = await tool.execute("call", { action: "status" }, undefined, () => {}, { cwd: root });
  const statusText = status.content.map((item) => item.text).join("\n");
  const statusPass = status.details.ok === false && statusText.startsWith("PARTIAL:") && statusText.includes("configured assembly is unavailable") && statusText.includes("NEXT:");
  console.log(`${statusPass ? "PASS" : "FAIL"}  subsequent status cannot call incomplete coverage fresh`);

  const search = await tool.execute("call", { action: "search", target: "ModCardTemplate" }, undefined, () => {}, { cwd: root });
  const searchText = search.content.map((item) => item.text).join("\n");
  const searchPass = search.details.ok === false && search.details.reason === "INCOMPLETE_DUMP" && searchText.startsWith("PARTIAL:") && searchText.includes("NEXT:");
  console.log(`${searchPass ? "PASS" : "FAIL"}  automatic refresh propagates incomplete coverage`);

  const missingType = await tool.execute("call", { action: "type", target: "DefinitelyMissingType" }, undefined, () => {}, { cwd: root });
  const missingTypeText = missingType.content.map((item) => item.text).join("\n");
  const missingTypePass = missingType.details.ok === false && missingType.details.reason === "INCOMPLETE_DUMP" && missingTypeText.startsWith("PARTIAL:");
  console.log(`${missingTypePass ? "PASS" : "FAIL"}  incomplete coverage outranks TYPE_NOT_FOUND`);

  const missingMember = await tool.execute("call", { action: "body", target: "ModCardTemplate", member: "DefinitelyMissingMember" }, undefined, () => {}, { cwd: root });
  const missingMemberText = missingMember.content.map((item) => item.text).join("\n");
  const missingMemberPass = missingMember.details.ok === false && missingMember.details.reason === "INCOMPLETE_DUMP" && missingMemberText.startsWith("PARTIAL:");
  console.log(`${missingMemberPass ? "PASS" : "FAIL"}  incomplete coverage outranks METHOD_NOT_FOUND`);
  if (!pass || !statusPass || !searchPass || !missingTypePass || !missingMemberPass) process.exitCode = 1;
} finally {
  delete process.env.DECOMPILED_ROOT;
  rmSync(root, { recursive: true, force: true });
}
