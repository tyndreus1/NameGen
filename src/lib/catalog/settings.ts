import { prisma } from "../db";
import {
  getXaiBatches,
  getXaiImageModel,
  getXaiMaxRetries,
  getXaiNPerBatch,
  getXaiQuality,
  getXaiRefCount,
  getXaiResolution,
  type XaiQuality,
} from "../env";

export type ResolvedSettings = {
  imageModel: string;
  quality: XaiQuality;
  refCount: 0 | 1 | 2;
  batches: number;
  nPerBatch: number;
  resolution: "1k" | "2k";
  maxRetries: number;
  source: "env" | "mixed";
};

export function envSettings(): ResolvedSettings {
  return {
    imageModel: getXaiImageModel(),
    quality: getXaiQuality(),
    refCount: getXaiRefCount(),
    batches: getXaiBatches(),
    nPerBatch: getXaiNPerBatch(),
    resolution: getXaiResolution(),
    maxRetries: getXaiMaxRetries(),
    source: "env",
  };
}

function asRefCount(n: number | null | undefined): 0 | 1 | 2 | undefined {
  if (n === 0 || n === 1 || n === 2) return n;
  return undefined;
}

function asQuality(value: string | null | undefined): XaiQuality | undefined {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function asResolution(value: string | null | undefined): "1k" | "2k" | undefined {
  if (value === "1k" || value === "2k") return value;
  return undefined;
}

export async function resolveGenerationSettings(): Promise<ResolvedSettings> {
  const defaults = envSettings();
  const row = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (!row) return defaults;
  return {
    imageModel: row.imageModel?.trim() || defaults.imageModel,
    quality: asQuality(row.quality) ?? defaults.quality,
    refCount: asRefCount(row.refCount) ?? defaults.refCount,
    batches: row.batches ?? defaults.batches,
    nPerBatch: row.nPerBatch ?? defaults.nPerBatch,
    resolution: asResolution(row.resolution) ?? defaults.resolution,
    maxRetries: row.maxRetries ?? defaults.maxRetries,
    source: "mixed",
  };
}

export type SettingsPatch = {
  imageModel?: string | null;
  quality?: string | null;
  refCount?: number | null;
  batches?: number | null;
  nPerBatch?: number | null;
  resolution?: string | null;
  maxRetries?: number | null;
};

export async function saveGenerationSettings(patch: SettingsPatch): Promise<ResolvedSettings> {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...patch },
    update: patch,
  });
  return resolveGenerationSettings();
}
