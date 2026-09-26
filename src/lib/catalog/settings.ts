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
import { DEFAULT_BASE_PROMPT } from "../generate/prompt";
import { GENERATION_COST, STARTING_CREDITS } from "../constants";

export type CreditPolicy = {
  startingCredits: number;
  generationCost: number;
};

export type ResolvedSettings = {
  imageModel: string;
  quality: XaiQuality;
  refCount: 0 | 1 | 2;
  batches: number;
  nPerBatch: number;
  resolution: "1k" | "2k";
  maxRetries: number;
  basePrompt: string;
  startingCredits: number;
  generationCost: number;
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
    basePrompt: DEFAULT_BASE_PROMPT,
    startingCredits: STARTING_CREDITS,
    generationCost: GENERATION_COST,
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
    basePrompt: row.basePrompt?.trim() || defaults.basePrompt,
    startingCredits: asNonNegInt(row.startingCredits) ?? defaults.startingCredits,
    generationCost: asPosInt(row.generationCost) ?? defaults.generationCost,
    source: "mixed",
  };
}

function asNonNegInt(n: number | null | undefined): number | undefined {
  if (typeof n === "number" && Number.isInteger(n) && n >= 0) return n;
  return undefined;
}

function asPosInt(n: number | null | undefined): number | undefined {
  if (typeof n === "number" && Number.isInteger(n) && n >= 1) return n;
  return undefined;
}

export async function resolveCreditPolicy(): Promise<CreditPolicy> {
  const settings = await resolveGenerationSettings();
  return {
    startingCredits: settings.startingCredits,
    generationCost: settings.generationCost,
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
  basePrompt?: string | null;
  startingCredits?: number | null;
  generationCost?: number | null;
};

export async function saveGenerationSettings(patch: SettingsPatch): Promise<ResolvedSettings> {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...patch },
    update: patch,
  });
  return resolveGenerationSettings();
}
