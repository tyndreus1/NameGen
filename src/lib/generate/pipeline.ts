import { VARIATION_COUNT, fontStyleForSlug, type StyleId } from "../constants";
import { addTicks, ticksToUsd } from "../cost";
import { yieldEventLoop } from "./offload";
import { loadCategoryRefs } from "../catalog/refs";
import { resolveGenerationSettings, type ResolvedSettings } from "../catalog/settings";
import { buildVariations, composeNameSvg } from "./vector";
import { processSvgComposition, type ProcessedDesign } from "./postprocess";
import { createXaiClient, type XaiClient } from "./xai-client";
import { buildGenerationPrompt, ornamentForStyle } from "./prompt";
import { referencesForBatch } from "./references";
import { validateGrokRaster } from "./validate";
import { prisma } from "../db";
import { ensureCatalog } from "../catalog/seed";

export type GeneratedDesign = ProcessedDesign & {
  index: number;
  engine: "deterministic" | "grok";
  fallback?: boolean;
};

export type GenerateResult = {
  designs: GeneratedDesign[];
  usedGrok: boolean;
  grokAttempted: boolean;
  grokAccepted: number;
  fallbackCount: number;
  attempts: number;
  apiCostUsd: number;
  apiCostTicks: number;
  imageModel: string | null;
  refCount: number;
  resolution: string | null;
  quality: string | null;
  batches: number;
  nPerBatch: number;
};

function assertName(name: string): string {
  const trimmed = name.normalize("NFC").trim();
  if (!trimmed) {
    throw new Error("İsim boş olamaz");
  }
  if ([...trimmed].length > 18) {
    throw new Error("İsim en fazla 18 karakter olabilir");
  }
  if (!/^[\p{L}\p{M}'’\- ]+$/u.test(trimmed)) {
    throw new Error("İsim yalnızca harf, boşluk, kesme ve tire içerebilir");
  }
  return trimmed;
}

export async function deterministicDesign(
  name: string,
  style: string,
  index: number,
): Promise<GeneratedDesign> {
  const fontStyle: StyleId = fontStyleForSlug(style);
  const variation = buildVariations(name, fontStyle, VARIATION_COUNT)[index];
  if (!variation) throw new Error("Varyasyon üretilemedi");
  const composition = composeNameSvg(name, fontStyle, variation);
  const processed = await processSvgComposition(
    composition.svg,
    composition.rings,
    composition.width,
  );
  return { ...processed, index, engine: "deterministic", fallback: true };
}

async function fillWithFallback(
  name: string,
  style: string,
  needed: number,
  startIndex: number,
): Promise<GeneratedDesign[]> {
  return Promise.all(
    Array.from({ length: needed }, (_, offset) => deterministicDesign(name, style, startIndex + offset)),
  );
}

async function ornamentForCategory(slug: string): Promise<string> {
  await ensureCatalog();
  const category = await prisma.category.findUnique({ where: { slug } });
  if (category?.promptText) return category.promptText;
  return ornamentForStyle(slug);
}

export async function generateDesigns(
  rawName: string,
  style: string,
  count = VARIATION_COUNT,
  client: XaiClient | null | undefined = undefined,
  settingsOverride?: Partial<ResolvedSettings>,
): Promise<GenerateResult> {
  const name = assertName(rawName);
  const resolved = client === undefined ? createXaiClient() : client;
  const grokAttempted = Boolean(resolved);
  const settings = { ...(await resolveGenerationSettings()), ...settingsOverride };
  const maxRetries = settings.maxRetries;
  const batches = settings.batches;
  const nPerBatch = settings.nPerBatch;
  const quality = settings.quality;

  const accepted: GeneratedDesign[] = [];
  let attempts = 0;
  let apiCostUsd = 0;
  let apiCostTicks = 0;
  let batchCursor = 0;

  if (resolved) {
    const configuredRefs = settings.refCount;
    const pool =
      configuredRefs === 0 ? [] : await loadCategoryRefs(name, style, Math.max(configuredRefs, batches));
    const effectiveRefCount = pool.length === 0 ? 0 : configuredRefs;
    const ornament = await ornamentForCategory(style);
    const prompt = buildGenerationPrompt(name, ornament, effectiveRefCount);

    const requestBatch = async (n: number) => {
      const references = referencesForBatch(pool, batchCursor, effectiveRefCount).map((ref) => ({
        dataUrl: ref.dataUrl,
      }));
      batchCursor++;
      attempts++;
      return resolved.generateImages({
        prompt,
        references,
        n,
        model: settings.imageModel,
        quality: settings.quality,
        resolution: settings.resolution,
      });
    };

    const acceptImages = async (images: { buffer: Buffer }[], visionClient: XaiClient) => {
      for (const image of images) {
        if (accepted.length >= count) break;
        await yieldEventLoop();
        try {
          const checked = await validateGrokRaster(image.buffer, name, visionClient);
          apiCostTicks = addTicks(apiCostTicks, checked.visionCostTicks);
          apiCostUsd += checked.visionCost > 0 ? checked.visionCost : ticksToUsd(checked.visionCostTicks);
          if (!checked.ok) continue;
          accepted.push({
            png: checked.png,
            svg: checked.svg,
            components: 1,
            source: "grok",
            index: accepted.length,
            engine: "grok",
            fallback: false,
          });
        } catch {
          /* skip this image */
        }
      }
    };

    const varietyCount = Math.min(batches, Math.ceil(count / nPerBatch));
    const varietyNs: number[] = [];
    let planned = 0;
    for (let i = 0; i < varietyCount && planned < count; i++) {
      const n = Math.min(nPerBatch, count - planned);
      varietyNs.push(n);
      planned += n;
    }

    const varietyResults = await Promise.all(
      varietyNs.map(async (n) => {
        try {
          return await requestBatch(n);
        } catch {
          return null;
        }
      }),
    );
    for (const batch of varietyResults) {
      if (!batch) continue;
      apiCostTicks = addTicks(apiCostTicks, batch.costTicks);
      apiCostUsd += batch.cost > 0 ? batch.cost : ticksToUsd(batch.costTicks);
      await acceptImages(batch.images, resolved);
    }

    for (let retry = 0; retry < maxRetries && accepted.length < count; retry++) {
      const n = count - accepted.length;
      try {
        const batch = await requestBatch(n);
        apiCostTicks = addTicks(apiCostTicks, batch.costTicks);
        apiCostUsd += batch.cost > 0 ? batch.cost : ticksToUsd(batch.costTicks);
        await acceptImages(batch.images, resolved);
      } catch {
        /* next retry */
      }
    }
  }

  if (accepted.length < count) {
    const fallbacks = await fillWithFallback(name, style, count - accepted.length, accepted.length);
    accepted.push(...fallbacks);
  }

  const designs = accepted.slice(0, count).map((design, index) => ({ ...design, index }));
  const grokAccepted = designs.filter((d) => d.engine === "grok").length;
  const fallbackCount = designs.filter((d) => d.engine !== "grok").length;

  if (designs.length === 0) {
    throw new Error("Tasarım üretilemedi");
  }

  return {
    designs,
    usedGrok: grokAccepted > 0,
    grokAttempted,
    grokAccepted,
    fallbackCount,
    attempts,
    apiCostUsd: apiCostUsd > 0 ? apiCostUsd : ticksToUsd(apiCostTicks),
    apiCostTicks,
    imageModel: grokAttempted ? settings.imageModel : null,
    refCount: settings.refCount,
    resolution: grokAttempted ? settings.resolution : null,
    quality: grokAttempted ? quality : null,
    batches,
    nPerBatch,
  };
}
