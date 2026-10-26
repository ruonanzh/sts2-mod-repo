import { appendFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

export const MANIFEST_FILE = "asset_manifest.jsonl";
export const PROVIDER = "tripo";

export type ManifestRec = {
  t: string;
  provider: string;
  endpoint: string;
  name: string;
  request_id: string | null;
  parent_request_id: string | null;
  seed: number | null;
  files: string[];
  input: Record<string, unknown>;
  error?: string;
};

export function nowLocal(date = new Date()): string {
  const p = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

export function modRootOf(cwd: string, primaryOut: string): string {
  const rel = relative(cwd, primaryOut);
  const match = /^your_mods[\\/]([^\\/]+)[\\/]/.exec(rel);
  return match ? join(cwd, "your_mods", match[1]) : dirname(primaryOut);
}

export function relToModRoot(modRoot: string, file: string): string {
  const rel = relative(modRoot, file);
  return (rel || basename(file)).split("\\").join("/");
}

export function manifestRec(rec: Omit<ManifestRec, "t" | "provider">): ManifestRec {
  const out: ManifestRec = {
    t: nowLocal(),
    provider: PROVIDER,
    endpoint: rec.endpoint,
    name: rec.name,
    request_id: rec.request_id,
    parent_request_id: rec.parent_request_id,
    seed: rec.seed,
    files: rec.files,
    input: rec.input,
  };
  if (rec.error) out.error = rec.error;
  return out;
}

/** A manifest failure must not discard an already downloaded image. */
export function appendManifest(modRoot: string, rec: ManifestRec): string | null {
  try {
    mkdirSync(modRoot, { recursive: true });
    appendFileSync(join(modRoot, MANIFEST_FILE), `${JSON.stringify(rec)}\n`, "utf8");
    return null;
  } catch (error) {
    return `could not write ${MANIFEST_FILE}: ${(error as Error).message}`;
  }
}
