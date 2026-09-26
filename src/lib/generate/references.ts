import fs from "node:fs";
import path from "node:path";
import type { StyleId } from "../constants";

export type ReferenceId = "merve" | "zeynep" | "aleyna" | "sophia" | "charlotte";

export type ReferenceImage = {
  id: ReferenceId;
  names: string[];
  file: string;
};

export const REFERENCE_CATALOG: ReferenceImage[] = [
  { id: "merve", names: ["merve"], file: "merve.png" },
  { id: "zeynep", names: ["zeynep"], file: "zeynep.png" },
  { id: "aleyna", names: ["aleyna"], file: "aleyna.png" },
  { id: "sophia", names: ["sophia", "sophiaa"], file: "sophia.png" },
  { id: "charlotte", names: ["charlotte"], file: "charlotte.png" },
];

const STYLE_PREFERENCE: Record<StyleId, ReferenceId[]> = {
  classic: ["charlotte", "zeynep", "merve", "aleyna"],
  hearts: ["aleyna", "zeynep", "charlotte", "merve"],
  star: ["aleyna", "charlotte", "zeynep", "merve"],
  butterfly: ["sophia", "aleyna", "charlotte", "zeynep"],
  elegant: ["charlotte", "merve", "zeynep", "aleyna"],
};

function normalizeName(name: string): string {
  return name.normalize("NFC").trim().toLocaleLowerCase("tr-TR");
}

export function referencesDir(): string {
  return path.join(process.cwd(), "assets", "references");
}

export function isSameNameAsReference(name: string, ref: ReferenceImage): boolean {
  const needle = normalizeName(name);
  return ref.names.some((n) => n === needle);
}

/** Seed-time preference only. Live generation uses loadCategoryRefs (DB assignments). */
export function pickReferenceIds(name: string, style: StyleId, count = 2): ReferenceId[] {
  const preferred = STYLE_PREFERENCE[style];
  const picked: ReferenceId[] = [];
  for (const id of preferred) {
    const ref = REFERENCE_CATALOG.find((item) => item.id === id);
    if (!ref) continue;
    if (isSameNameAsReference(name, ref)) continue;
    picked.push(id);
    if (picked.length >= count) break;
  }
  if (style === "butterfly" && !picked.includes("sophia") && !isSameNameAsReference(name, REFERENCE_CATALOG[3]!)) {
    const rest = picked.filter((id) => id !== "sophia").slice(0, count - 1);
    return ["sophia", ...rest].slice(0, count);
  }
  return picked;
}

export function loadReferenceDataUrl(id: ReferenceId): string {
  const ref = REFERENCE_CATALOG.find((item) => item.id === id);
  if (!ref) throw new Error(`Unknown reference ${id}`);
  const filePath = path.join(referencesDir(), ref.file);
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export function loadPickedReferences(
  name: string,
  style: StyleId,
  count = 2,
): { id: ReferenceId; dataUrl: string }[] {
  if (count <= 0) return [];
  return pickReferenceIds(name, style, count).map((id) => ({
    id,
    dataUrl: loadReferenceDataUrl(id),
  }));
}

/** One (or two) refs for a batch; rotate through the pool so batches differ. */
export function referencesForBatch<T>(pool: T[], batchIndex: number, refCount: number): T[] {
  if (refCount <= 0 || pool.length === 0) return [];
  if (refCount === 1) return [pool[batchIndex % pool.length]!];
  const a = pool[batchIndex % pool.length]!;
  const b = pool[(batchIndex + 1) % pool.length]!;
  return a === b ? [a] : [a, b];
}
