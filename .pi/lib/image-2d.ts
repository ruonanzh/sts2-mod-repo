import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { cropCover, decodePng, encodePng, letterbox, MAX_IMAGE_PIXELS } from "./png.ts";

const API = "https://openapi.tripo3d.com/v3";
const NET_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
export const IMAGE_MODEL = "chat_image_2.5_flare";

export class ImageError extends Error {
  public code: string;
  public next?: string;

  constructor(code: string, message: string, next?: string) {
    super(message);
    this.code = code;
    this.next = next;
  }
}

export interface ImageResult {
  status: "pass" | "warn";
  out?: string;
  file?: string;
  task?: string | null;
  width?: number;
  height?: number;
  alpha?: boolean;
  mode?: string;
  present?: number;
  missing?: string[];
  warning?: string;
}

function validateSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_IMAGE_PIXELS)
    throw new ImageError("BAD_SIZE", `width and height must be positive integers with at most ${MAX_IMAGE_PIXELS} pixels, got ${width}x${height}`);
}

async function assertNewOutput(out: string): Promise<void> {
  if (existsSync(out)) throw new ImageError("OUT_FILE_EXISTS", `${out} already exists; choose a new file name or remove the old file after checking it`);
}

async function writeNewImage(out: string, data: Buffer, task?: string): Promise<void> {
  try {
    await mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await writeFile(out, data, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST" && existsSync(out))
      throw new ImageError("OUT_FILE_EXISTS", `${out} already exists; nothing was overwritten`);
    throw new ImageError(
      "WRITE_FAILED",
      `cannot write image ${out}: ${(error as Error).message}`,
      task ? `reuse task=${task} instead of paying for a new image` : "check the output directory permissions and free space",
    );
  }
}

export async function fitImage({
  inFile,
  outFile,
  width,
  height,
  mode = "cover",
  outputAlpha = "preserve",
  background = "#000000",
}: {
  inFile: string;
  outFile: string;
  width: number;
  height: number;
  mode?: "cover" | "contain";
  outputAlpha?: "preserve" | "opaque";
  background?: string;
}): Promise<ImageResult> {
  if (!inFile || !outFile) throw new ImageError("NO_PATH", "fit needs inFile and outFile");
  validateSize(width, height);
  await assertNewOutput(outFile);
  let source: Buffer;
  try {
    source = await readFile(inFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ImageError("NO_FILE", `no such file: ${inFile}`);
    throw error;
  }
  let img;
  try {
    img = decodePng(source);
  } catch (error) {
    throw new ImageError("BAD_PNG", `${inFile} is not a supported PNG: ${(error as Error).message}`, "use an 8-bit RGB or RGBA PNG, or convert the source before fitting");
  }
  const fitted = mode === "contain" ? letterbox(img, width, height) : cropCover(img, width, height);
  let encoded;
  try {
    encoded = encodePng(fitted, { opaque: outputAlpha === "opaque", background });
  } catch (error) {
    throw new ImageError("BAD_BACKGROUND", (error as Error).message);
  }
  await writeNewImage(outFile, encoded);
  return { status: "pass", out: outFile, width, height, mode, alpha: outputAlpha !== "opaque" };
}

export async function checkImage({
  file,
  width,
  height,
  alpha,
}: {
  file: string;
  width?: number;
  height?: number;
  alpha?: "prefer" | "avoid";
}): Promise<ImageResult> {
  if (!file) throw new ImageError("NO_FILE", "check needs file");
  if ((width === undefined) !== (height === undefined))
    throw new ImageError("SIZE_PARTIAL", "check needs both width and height, or neither");
  if (width !== undefined && height !== undefined) validateSize(width, height);
  let buf;
  try {
    buf = await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ImageError("NO_FILE", `no such file: ${file}`);
    throw error;
  }
  let img;
  try {
    img = decodePng(buf);
  } catch (error) {
    throw new ImageError("BAD_PNG", `${file} is not a supported PNG: ${(error as Error).message}`, "use an 8-bit RGB or RGBA PNG, or convert the source before checking");
  }
  if (width !== undefined && height !== undefined && (img.width !== width || img.height !== height))
    throw new ImageError(
      "SIZE_MISMATCH",
      `${file} is ${img.width}x${img.height}, expected ${width}x${height}`,
      `run fit with width=${width} height=${height}, then check again`,
    );
  let hasAlpha = false;
  for (let i = 3; i < img.rgba.length; i += 4) {
    if (img.rgba[i] < 255) { hasAlpha = true; break; }
  }
  if (alpha === "prefer" && !hasAlpha)
    return { status: "warn", file, width: img.width, height: img.height, alpha: false, warning: "ALPHA_RECOMMENDED: a transparent RGBA icon is recommended, but this RGB file is accepted" };
  if (alpha === "avoid" && hasAlpha)
    return { status: "warn", file, width: img.width, height: img.height, alpha: true, warning: "SOLID_RECOMMENDED: solid RGB card art is recommended, but this RGBA file is accepted" };
  return { status: "pass", file, width: img.width, height: img.height, alpha: hasAlpha };
}

export async function checkRefs({ dir, expect = [] }: { dir: string; expect?: string[] }): Promise<ImageResult> {
  if (!dir) throw new ImageError("NO_DIR", "refs needs dir");
  try {
    if (!(await stat(dir)).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new ImageError("NO_DIR", `no such directory: ${dir}`);
  }
  const missing = expect.filter((name) => !existsSync(path.join(dir, name)));
  return {
    status: missing.length ? "warn" : "pass",
    present: expect.length - missing.length,
    missing,
    warning: missing.length ? `${missing.length} of ${expect.length} expected picture(s) are missing` : undefined,
  };
}

export async function requireKey(): Promise<string> {
  const env = process.env.TRIPO_API_KEY;
  if (env?.trim()) return env.trim();
  const dataDir = process.env.PI_DESKTOP_DATA_DIR || path.join(homedir(), ".gamer-agent-pi");
  const file = path.join(dataDir, "api-keys.json");
  let key: unknown;
  try {
    key = (JSON.parse(await readFile(file, "utf8")) as { tripo?: unknown }).tripo;
  } catch {
    throw new ImageError(
      "NO_TRIPO_KEY",
      "no Tripo API key was found",
      'save {"tripo":"tsk_..."} to ~/.gamer-agent-pi/api-keys.json or set TRIPO_API_KEY',
    );
  }
  if (typeof key !== "string" || !key.trim())
    throw new ImageError("NO_TRIPO_KEY", "the Tripo API key is empty", "set the tripo field in ~/.gamer-agent-pi/api-keys.json");
  return key.trim();
}

type Fetch = typeof fetch;

function abortSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function fetchWithTimeout(fetchImpl: Fetch, url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal: abortSignal(signal, timeoutMs) });
  } catch (error) {
    if (signal?.aborted) throw new ImageError("CANCELLED", "image generation was cancelled");
    const name = String((error as Error)?.name);
    if (name === "TimeoutError" || name === "AbortError")
      throw new ImageError("NETWORK", `no answer from ${new URL(url).host} within ${Math.round(timeoutMs / 1000)}s`, "check the network, VPN, or proxy, then retry");
    throw new ImageError("NETWORK", `request to ${new URL(url).host} failed: ${(error as Error).message}`, "check the network, then retry");
  }
}

function tripoApi(key: string, fetchImpl: Fetch, signal?: AbortSignal) {
  return async (endpoint: string, body?: unknown): Promise<any> => {
    const response = await fetchWithTimeout(fetchImpl, API + endpoint, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, NET_TIMEOUT_MS, signal);
    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ImageError("BAD_RESPONSE", `Tripo returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`, "retry or check the API status");
    }
    if (response.status === 429 || json?.code === 2000)
      throw new ImageError("TRIPO_RATE_LIMIT", "the image generation concurrency limit was reached", "wait 30-60 seconds before the next call; do not retry in a loop");
    if (!response.ok || json?.code !== 0)
      throw new ImageError("TRIPO_API_ERROR", `Tripo HTTP ${response.status}, code=${json?.code}: ${json?.message ?? text.slice(0, 200)}`, "fix the reported API problem before retrying");
    return json.data;
  };
}

async function uploadFile(key: string, file: string, fetchImpl: Fetch, signal?: AbortSignal): Promise<string> {
  let data;
  try {
    data = await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ImageError("NO_FILE", `no such reference picture: ${file}`);
    throw new ImageError("READ_FAILED", `cannot read reference image ${file}: ${(error as Error).message}`, "check the reference file permissions and type");
  }
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)]), path.basename(file));
  const response = await fetchWithTimeout(fetchImpl, API + "/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  }, NET_TIMEOUT_MS, signal);
  const json: any = await response.json().catch(() => ({}));
  const token = json?.data?.file_token ?? json?.data?.image_token;
  if (!response.ok || json?.code !== 0 || !token)
    throw new ImageError("UPLOAD_FAILED", `uploading ${path.basename(file)} failed: ${JSON.stringify(json).slice(0, 200)}`, "check the reference file and retry");
  return String(token);
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new ImageError("CANCELLED", "image generation was cancelled");
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ImageError("CANCELLED", "image generation was cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

async function waitForTask(api: (endpoint: string) => Promise<any>, id: string, pollMs: number, timeoutMs: number, signal?: AbortSignal): Promise<any> {
  const started = Date.now();
  for (;;) {
    const data = await api(`/tasks/${id}`);
    const status = String(data?.status);
    if (status === "success") return data;
    if (["failed", "banned", "expired", "cancelled"].includes(status))
      throw new ImageError("TASK_FAILED", `task ${id} ended as ${status}: ${JSON.stringify(data?.task ?? data).slice(0, 300)}`, `inspect the task, then retry or reuse task=${id} after fixing the problem`);
    if (Date.now() - started > timeoutMs) {
      const limit = timeoutMs < 1000 ? `${timeoutMs} milliseconds` : `${Math.ceil(timeoutMs / 1000)} seconds`;
      throw new ImageError("TASK_TIMEOUT", `task ${id} did not finish within ${limit}`, `reuse task=${id} later instead of paying for a new image`);
    }
    await sleep(pollMs, signal);
  }
}

function pickUrl(output: unknown): string | null {
  for (const value of Object.values((output ?? {}) as Record<string, unknown>))
    if (typeof value === "string" && value.startsWith("http")) return value;
  return null;
}

export async function generateImage({
  prompt,
  refs = [],
  out,
  background = "transparent",
  task,
  key,
  fetchImpl = fetch,
  signal,
  pollMs = 2000,
  timeoutMs = 900_000,
  onTask,
}: {
  prompt?: string;
  refs?: string[];
  out: string;
  background?: string;
  task?: string;
  key?: string;
  fetchImpl?: Fetch;
  signal?: AbortSignal;
  pollMs?: number;
  timeoutMs?: number;
  onTask?: (taskId: string) => void;
}): Promise<ImageResult> {
  if (!out) throw new ImageError("NO_OUT", "generate needs out");
  if (!task && !prompt?.trim()) throw new ImageError("NO_PROMPT", "generate needs prompt, or task to reuse an existing image");
  await assertNewOutput(out);
  const apiKey = key || await requireKey();
  const api = tripoApi(apiKey, fetchImpl, signal);
  let requestId = task ?? null;
  if (requestId) onTask?.(requestId);
  let imageUrl: string | null;
  if (task) {
    const done = await waitForTask(api, task, pollMs, timeoutMs, signal);
    imageUrl = pickUrl(done?.output);
  } else {
    const tokens: string[] = [];
    for (const file of refs) tokens.push(await uploadFile(apiKey, file, fetchImpl, signal));
    const body: Record<string, unknown> = { prompt, model: IMAGE_MODEL, background, output_format: "png" };
    if (tokens.length === 1) body.input = tokens[0];
    if (tokens.length > 1) body.inputs = tokens;
    const endpoint = tokens.length ? "/generation/image-to-image" : "/generation/text-to-image";
    const created = await api(endpoint, body);
    requestId = String(created?.task_id ?? "");
    if (!requestId) throw new ImageError("TASK_FAILED", `Tripo accepted no task: ${JSON.stringify(created).slice(0, 200)}`, "retry after checking the API response");
    onTask?.(requestId);
    const done = await waitForTask(api, requestId, pollMs, timeoutMs, signal);
    imageUrl = pickUrl(done?.output);
  }
  if (!imageUrl) throw new ImageError("TASK_FAILED", `task ${requestId} finished with no image URL`, `reuse task=${requestId} after checking the task`);
  const response = await fetchWithTimeout(fetchImpl, imageUrl, {}, DOWNLOAD_TIMEOUT_MS, signal);
  if (!response.ok) throw new ImageError("DOWNLOAD_FAILED", `downloading the picture failed: HTTP ${response.status}`, `reuse task=${requestId} to fetch a fresh URL`);
  const bytes = Buffer.from(await response.arrayBuffer());
  let img;
  try {
    img = decodePng(bytes);
  } catch (error) {
    throw new ImageError("BAD_DOWNLOAD", `task ${requestId} did not return a supported PNG: ${(error as Error).message}`, `reuse task=${requestId} or generate a new image`);
  }
  try {
    await writeNewImage(out, bytes, requestId ?? undefined);
  } catch (error) {
    if (error instanceof ImageError && error.code === "OUT_FILE_EXISTS")
      throw new ImageError(error.code, error.message, `reuse task=${requestId} with a new out= path; do not pay for another image`);
    throw error;
  }
  return { status: "pass", out, task: requestId, width: img.width, height: img.height, alpha: bytes[25] === 6 };
}
