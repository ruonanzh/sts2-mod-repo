import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizePublicStem, standaloneModelId } from "./ritsulib-ids";

export type ModelKind = "card" | "relic" | "power";

export interface RegisteredModel {
  typeName: string;
  expectedId: string;
}

export interface ModelLocalizationResult {
  status: "passed" | "failed" | "not-checked" | "not-required";
  models: RegisteredModel[];
  missing: RegisteredModel[];
  unresolved: string[];
  invalid: string[];
  invalidJson: string[];
  hasTable: boolean;
}

const SKIP_DIRS = new Set(["bin", "obj", "assets", ".git", ".preview", "node_modules"]);

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...sourceFiles(path));
    } else if (entry.name.endsWith(".cs")) {
      files.push(path);
    }
  }
  return files;
}

function attributePattern(kind: ModelKind): RegExp {
  const name = kind === "card" ? "RegisterCard" : kind === "relic" ? "RegisterRelic" : "RegisterPower";
  return new RegExp(`\\[\\s*${name}(?:Attribute)?(?:\\s*\\(([^\\]]*)\\))?\\s*\\]\\s*(?:public|internal)?\\s*(?:sealed\\s+)?(?:partial\\s+)?class\\s+([A-Za-z_][A-Za-z0-9_]*)`, "g");
}

function namedValue(args: string, name: string): string | null {
  return new RegExp(`\\b${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|[A-Za-z_][A-Za-z0-9_]*)`).exec(args)?.[1] ?? null;
}

function constants(text: string): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const match of text.matchAll(/\bconst\s+string\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
    const list = values.get(match[1]) ?? [];
    list.push(match[2]);
    values.set(match[1], list);
  }
  return values;
}

/** Check the repository's attribute forms without attempting a full C# parse. */
export function checkModelLocalization(modDir: string, modId: string, kind: ModelKind): ModelLocalizationResult {
  const models: RegisteredModel[] = [];
  const unresolved: string[] = [];
  const invalid: string[] = [];
  for (const file of sourceFiles(modDir)) {
    const text = readFileSync(file, "utf8");
    const consts = constants(text);
    for (const match of text.matchAll(attributePattern(kind))) {
      const args = match[1] ?? "";
      const typeName = match[2];
      const full = namedValue(args, "FullPublicEntry");
      const stem = namedValue(args, "StableEntryStem");
      if (full && stem) {
        invalid.push(`${kind} ${typeName} sets both StableEntryStem and FullPublicEntry. RitsuLib rejects this combination.`);
        continue;
      }
      if (full) {
        if (full.startsWith('"')) {
          models.push({ typeName, expectedId: normalizePublicStem(JSON.parse(full)) });
          continue;
        }
        const values = consts.get(full) ?? [];
        if (values.length === 1) {
          models.push({ typeName, expectedId: normalizePublicStem(values[0]) });
        } else {
          unresolved.push(`${kind} ${typeName}: ${full}`);
        }
        continue;
      }
      if (stem) {
        if (stem.startsWith('"')) {
          models.push({ typeName, expectedId: standaloneModelId(modId, kind, JSON.parse(stem)) });
          continue;
        }
        const values = consts.get(stem) ?? [];
        if (values.length === 1) {
          models.push({ typeName, expectedId: standaloneModelId(modId, kind, values[0]) });
        } else {
          unresolved.push(`${kind} ${typeName}: ${stem}`);
        }
        continue;
      }
      models.push({ typeName, expectedId: standaloneModelId(modId, kind, typeName) });
    }
  }

  const tableName = `${kind}s.json`;
  const localizationRoot = join(modDir, "assets", modId, "localization");
  const tables: Record<string, unknown>[] = [];
  const invalidJson: string[] = [];
  let hasTable = false;
  if (existsSync(localizationRoot)) {
    for (const entry of readdirSync(localizationRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(localizationRoot, entry.name, tableName);
      if (!existsSync(path)) continue;
      hasTable = true;
      try {
        tables.push(JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>);
      } catch {
        invalidJson.push(`${entry.name}/${tableName}`);
      }
    }
  }

  const missing = models.filter((model) =>
    !tables.some((table) => `${model.expectedId}.title` in table && `${model.expectedId}.description` in table));
  const status = missing.length > 0 || invalidJson.length > 0 || invalid.length > 0
    ? "failed"
    : unresolved.length > 0 || (models.length === 0 && hasTable)
      ? "not-checked"
      : models.length === 0 ? "not-required" : "passed";
  return { status, models, missing, unresolved, invalid, invalidJson, hasTable };
}
