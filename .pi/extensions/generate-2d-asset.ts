import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { checkImage, checkRefs, fitImage, generateImage, ImageError, type ImageResult } from "../lib/image-2d";
import { serialize } from "../lib/proc";
import { resolveUserPath } from "../lib/game-paths";

const CALLER_ERRORS = new Set([
  "NO_PATH",
  "NO_FILE",
  "NO_DIR",
  "NO_OUT",
  "NO_PROMPT",
  "BAD_SIZE",
  "SIZE_PARTIAL",
  "OUT_FILE_EXISTS",
  "BAD_BACKGROUND",
]);

function content(text: string): string {
  return text.length <= 16_000 ? text : `${text.slice(0, 16_000)}...`;
}

function passText(action: string, result: ImageResult): string {
  if (action === "generate") return `PASS: ${result.out} written at ${result.width}x${result.height}, task ${result.task}`;
  if (action === "fit") return `PASS: ${result.out} written at ${result.width}x${result.height} (${result.mode})`;
  if (action === "check") return `PASS: ${result.file} is ${result.width}x${result.height}, alpha=${result.alpha}`;
  return `PASS: all ${result.present} expected picture(s) are present`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_2d_asset",
    label: "Generate 2D Asset",
    description:
      "Generate a PNG from a player prompt and optional reference pictures, reuse an existing Tripo task, fit a PNG to exact dimensions, check PNG dimensions and alpha preferences, or list missing references. Actions: generate, fit, check, refs. The tool never adds style wording, never overwrites an existing output, and never edits game records. Generation spends Tripo credits unless task= is used.",
    promptSnippet: "Generate, fit, or check a 2D PNG without adding style wording",
    promptGuidelines: [
      "Use generate_2d_asset with action=generate for a player-approved prompt. Write previews to your_mods/<mod>/.preview/. The tool sends the prompt unchanged and adds no style wording.",
      "Use generate_2d_asset with outputAlpha=opaque for default card art and outputAlpha=preserve for icons. The check actions alpha=avoid and alpha=prefer only recommend solid cards or transparent icons. They do not reject valid PNG files.",
      "Use generate_2d_asset with task= to reuse an existing image without new generation credits. Choose a new output name because existing files are never overwritten.",
    ],
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("generate"),
        Type.Literal("fit"),
        Type.Literal("check"),
        Type.Literal("refs"),
      ], { description: "generate: create or reuse an image. fit: resize a PNG. check: inspect a PNG. refs: list missing reference files." }),
      prompt: Type.Optional(Type.String({ description: "generate: the exact prompt sent to Tripo. The tool adds no style wording." })),
      refs: Type.Optional(Type.Array(Type.String(), { description: "generate: local reference pictures, in order." })),
      out: Type.Optional(Type.String({ description: "generate / fit: output PNG. An existing file is never overwritten." })),
      background: Type.Optional(Type.String({ description: "generate: Tripo background, default transparent. fit with outputAlpha=opaque: six-digit compositing color, default #000000." })),
      task: Type.Optional(Type.String({ description: "generate: existing Tripo task id to download without new generation credits." })),
      in: Type.Optional(Type.String({ description: "fit: input PNG." })),
      width: Type.Optional(Type.Number({ description: "fit / check: expected width in pixels." })),
      height: Type.Optional(Type.Number({ description: "fit / check: expected height in pixels." })),
      mode: Type.Optional(Type.Union([Type.Literal("cover"), Type.Literal("contain")], { description: "fit: cover crops to fill; contain preserves the whole image with transparent bands. Default cover." })),
      outputAlpha: Type.Optional(Type.Union([Type.Literal("preserve"), Type.Literal("opaque")], { description: "fit: preserve emits RGBA; opaque composites onto background and emits RGB. Default preserve." })),
      file: Type.Optional(Type.String({ description: "check: PNG file to inspect." })),
      alpha: Type.Optional(Type.Union([Type.Literal("prefer"), Type.Literal("avoid")], { description: "check: prefer warns when no pixels are transparent; avoid warns when any pixels are transparent. Neither rejects the file." })),
      dir: Type.Optional(Type.String({ description: "refs: directory containing reference pictures." })),
      expect: Type.Optional(Type.Array(Type.String(), { description: "refs: expected file names inside dir." })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cwd = ctx.cwd;
      const pathParam = (value: string | undefined): string | undefined => value === undefined ? undefined : resolveUserPath(cwd, value);
      if ((params.action === "generate" || params.action === "fit") && !params.out?.trim())
        throw new Error(`INVALID_ARGS: action=${params.action} needs out=<file>; nothing was written`);

      const run = async () => {
        let result: ImageResult;
        if (params.action === "generate") {
          result = await generateImage({
            prompt: params.prompt,
            refs: (params.refs ?? []).map((file) => resolveUserPath(cwd, file)),
            out: pathParam(params.out)!,
            background: params.background,
            task: params.task,
            signal,
          });
        } else if (params.action === "fit") {
          if (!params.in?.trim()) throw new Error("INVALID_ARGS: action=fit needs in=<file>");
          result = await fitImage({
            inFile: pathParam(params.in)!,
            outFile: pathParam(params.out)!,
            width: params.width ?? Number.NaN,
            height: params.height ?? Number.NaN,
            mode: params.mode,
            outputAlpha: params.outputAlpha,
            background: params.background,
          });
        } else if (params.action === "check") {
          if (!params.file?.trim()) throw new Error("INVALID_ARGS: action=check needs file=<file>");
          result = await checkImage({
            file: pathParam(params.file)!,
            width: params.width,
            height: params.height,
            alpha: params.alpha,
          });
        } else {
          if (!params.dir?.trim()) throw new Error("INVALID_ARGS: action=refs needs dir=<directory>");
          result = await checkRefs({ dir: pathParam(params.dir)!, expect: params.expect });
        }

        if (result.status === "warn") {
          const missing = result.missing?.length ? `\nNOTE: missing ${result.missing.join(", ")}` : "";
          return {
            content: [{ type: "text" as const, text: content(`WARN: ${result.warning}${missing}`) }],
            details: { ok: true, action: params.action, result },
          };
        }
        return {
          content: [{ type: "text" as const, text: content(passText(params.action, result)) }],
          details: { ok: true, action: params.action, result },
        };
      };

      try {
        return params.action === "generate" ? await serialize("tripo-image-generation", run) : await run();
      } catch (error) {
        if (!(error instanceof ImageError)) throw error;
        if (CALLER_ERRORS.has(error.code)) throw new Error(`${error.code}: ${error.message}${error.next ? `\nNEXT: ${error.next}` : ""}`);
        const next = error.next ?? "fix the named problem, then retry";
        return {
          content: [{ type: "text" as const, text: content(`FAIL: ${error.code}: ${error.message}\nNEXT: ${next}`) }],
          details: { ok: false, action: params.action, reason: error.code },
        };
      }
    },
  });
}
