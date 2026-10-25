import { test } from "bun:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveApiSources } from "./api-sources.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sts2-api-sources-"));
  const pkg = join(root, "sts2.ritsulib.compat.0.107.1");
  for (const version of ["0.6.9", "0.6.10", "0.6.11"]) {
    const dir = join(pkg, version, "lib", "net9.0");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "STS2-RitsuLib.dll"), version);
  }
  for (const assembly of ["STS2-RitsuLib.Runtime.dll", "STS2-RitsuLib.Shared.dll", "STS2-RitsuLib.Ui.dll", "STS2-RitsuLib.Settings.dll"]) {
    writeFileSync(join(pkg, "0.6.10", "lib", "net9.0", assembly), assembly);
  }
  return root;
}

test("resolveApiSources reads every module from the pinned compatibility version", () => {
  const root = fixture();
  const previous = process.env.NUGET_PACKAGES;
  process.env.NUGET_PACKAGES = root;
  try {
    const result = resolveApiSources({
      managedDir: null,
      references: [],
      packages: [{
        id: "STS2.RitsuLib.Compat.0.107.1",
        label: "ritsulib",
        version: "0.6.10",
        assemblies: ["STS2-RitsuLib.dll", "STS2-RitsuLib.Runtime.dll", "STS2-RitsuLib.Shared.dll", "STS2-RitsuLib.Ui.dll", "STS2-RitsuLib.Settings.dll"],
      }],
    });
    assert.equal(result.sources.length, 5);
    assert.deepEqual(result.sources.map((source) => source.assembly).sort(), [
      "STS2-RitsuLib", "STS2-RitsuLib.Runtime", "STS2-RitsuLib.Settings", "STS2-RitsuLib.Shared", "STS2-RitsuLib.Ui",
    ]);
    assert.ok(result.sources.every((source) => source.version === "0.6.10"));
    assert.ok(result.sources.every((source) => source.dllPath.includes("0.6.10")));
  } finally {
    if (previous === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveApiSources keeps highest-restored fallback for an unpinned package", () => {
  const root = fixture();
  const previous = process.env.NUGET_PACKAGES;
  process.env.NUGET_PACKAGES = root;
  try {
    const result = resolveApiSources({
      managedDir: null,
      references: [],
      packages: [{ id: "STS2.RitsuLib.Compat.0.107.1", label: "ritsulib", assembly: "STS2-RitsuLib.dll" }],
    });
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].version, "0.6.11");
  } finally {
    if (previous === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveApiSources reports each configured module that is missing", () => {
  const root = fixture();
  const previous = process.env.NUGET_PACKAGES;
  process.env.NUGET_PACKAGES = root;
  try {
    const result = resolveApiSources({
      managedDir: null,
      references: [],
      packages: [{
        id: "STS2.RitsuLib.Compat.0.107.1",
        label: "ritsulib",
        version: "0.6.10",
        assemblies: ["STS2-RitsuLib.dll", "STS2-RitsuLib.Runtime.dll", "STS2-RitsuLib.Missing.dll"],
      }],
    });
    assert.equal(result.sources.length, 2);
    assert.match(result.notes.join("\n"), /missing configured assembly STS2-RitsuLib.Missing.dll/);
  } finally {
    if (previous === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveApiSources does not fall back to another version when the pin is missing", () => {
  const root = fixture();
  const previous = process.env.NUGET_PACKAGES;
  process.env.NUGET_PACKAGES = root;
  try {
    const result = resolveApiSources({
      managedDir: null,
      references: [],
      packages: [{ id: "STS2.RitsuLib.Compat.0.107.1", label: "ritsulib", version: "9.9.9", assembly: "STS2-RitsuLib.dll" }],
    });
    assert.equal(result.sources.length, 0);
    assert.match(result.notes.join("\n"), /missing configured assembly STS2-RitsuLib.dll/);
  } finally {
    if (previous === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
