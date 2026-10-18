// Maintainer-only helper. A player never runs this: their agent talks to the tools
// through the product. It exists so that a single tool can be exercised from a shell
// after a change, without starting a session.
//
// Run with: bun .pi/dev-harness.mjs <extension> [tool] [json-params]
// It bootstraps the two module stubs it needs into node_modules/ (gitignored), so a
// fresh clone works without any install step.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// The extensions import two packages that only exist inside the product. Stub them so
// the files resolve under plain bun; neither stub is ever used by the product.
function ensureStubs() {
  const stub = (dir, pkg, body) => {
    mkdirSync(`node_modules/${dir}`, { recursive: true });
    writeFileSync(`node_modules/${dir}/package.json`, JSON.stringify({ name: pkg, version: "0.0.0", main: "index.js", type: "module" }));
    writeFileSync(`node_modules/${dir}/index.js`, body);
  };
  stub("typebox", "typebox", `const s = (kind) => (opts) => ({ kind, ...(opts || {}) });
export const Type = { Object: s("Object"), String: s("String"), Number: s("Number"), Integer: s("Integer"),
  Boolean: s("Boolean"), Array: (item, o) => ({ kind: "Array", item, ...(o || {}) }), Optional: (i) => ({ kind: "Optional", inner: i }),
  Union: s("Union"), Literal: s("Literal") };
`);
  stub("@earendil-works/pi-coding-agent", "@earendil-works/pi-coding-agent", "export {};\n");
}
ensureStubs();

const [, , extFile, toolName, paramsJson] = process.argv;

const tools = new Map();
const fakePi = {
  registerTool(tool) {
    tools.set(tool.name, tool);
  },
  on() {},
  registerCommand() {},
  registerShortcut() {},
  addContextProvider() {},
  registerContextProvider() {},
};

const mod = await import(pathToFileURL(resolve(extFile)).href);
const factory = mod.default ?? mod;
await factory(fakePi);

if (!toolName) {
  console.log(JSON.stringify([...tools.keys()]));
  process.exit(0);
}

const tool = tools.get(toolName);
if (!tool) {
  console.error(`no such tool: ${toolName}. have: ${[...tools.keys()].join(", ")}`);
  process.exit(2);
}

const ctx = { cwd: process.cwd() };
const params = paramsJson ? JSON.parse(paramsJson) : {};
const result = await tool.execute("test-call", params, undefined, () => {}, ctx);
console.log("--- content ---");
console.log(result.content.map((c) => c.text).join("\n"));
console.log("--- details ---");
console.log(JSON.stringify(result.details, null, 2));
