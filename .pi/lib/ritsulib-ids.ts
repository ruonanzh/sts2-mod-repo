/** RitsuLib 0.6.10 public-stem normalization, mirrored from ModContentRegistry. */
export function normalizePublicStem(value: string): string {
  if (!value.trim()) throw new Error("EMPTY_PUBLIC_STEM: a public ID segment cannot be empty");
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/** Standalone models use <modid>_<category>_<typename>. */
export function standaloneModelId(modId: string, category: string, typeName: string): string {
  return [modId, category, typeName].map(normalizePublicStem).join("_");
}
