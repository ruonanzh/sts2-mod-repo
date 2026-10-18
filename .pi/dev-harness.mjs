// Throwaway harness: loads each extension with a fake pi API and runs its tools,
// so the tool logic can be exercised without spawning a nested agent.
// Run with: bun .pi/dev-harness.mjs <extension> <tool> [json-params]
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

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
