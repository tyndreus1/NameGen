import { VARIATION_COUNT, type StyleId } from "../constants";
import { addTicks } from "../cost";
import {
  getXaiBatches,
  getXaiImageModel,
  getXaiMaxRetries,
  getXaiNPerBatch,
  getXaiQuality,
  getXaiRefCount,
  getXaiResolution,
} from "../env";
import { buildVariations, composeNameSvg } from "./vector";
import { processSvgComposition, type ProcessedDesign } from "./postprocess";
import { createXaiClient, type XaiClient } from "./xai-client";
import { buildGenerationPrompt } from "./prompt";
import { loadPickedReferences, referencesForBatch } from "./references";
import { validateGrokRaster } from "./validate";

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
  style: StyleId,
  index: number,
): Promise<GeneratedDesign> {
  const variation = buildVariations(name, style, VARIATION_COUNT)[index];
  if (!variation) throw new Error("Varyasyon üretilemedi");
  const composition = composeNameSvg(name, style, variation);
  const processed = await processSvgComposition(
    composition.svg,
    composition.rings,
    composition.width,
  );
  return { ...processed, index, engine: "deterministic", fallback: true };
}

async function fillWithFallback(
  name: string,
  style: StyleId,
  needed: number,
  startIndex: number,
): Promise<GeneratedDesign[]> {
  return Promise.all(
    Array.from({ length: needed }, (_, offset) => deterministicDesign(name, style, startIndex + offset)),
  );
}

export async function generateDesigns(
  rawName: string,
  style: StyleId,
  count = VARIATION_COUNT,
  client: XaiClient | null | undefined = undefined,
): Promise<GenerateResult> {
  const name = assertName(rawName);
  const resolved = client === undefined ? createXaiClient() : client;
  const grokAttempted = Boolean(resolved);
  const refCount = getXaiRefCount();
  const maxRetries = getXaiMaxRetries();
  const batches = getXaiBatches();
  const nPerBatch = getXaiNPerBatch();
  const quality = getXaiQuality();

  const accepted: GeneratedDesign[] = [];
  let attempts = 0;
  let apiCostUsd = 0;
  let apiCostTicks = 0;
  let batchCursor = 0;

  if (resolved) {
    const prompt = buildGenerationPrompt(name, style, refCount);
    const poolSize = refCount === 0 ? 0 : Math.max(refCount, batches);
    const pool = loadPickedReferences(name, style, poolSize);

    const requestBatch = async (n: number) => {
      const references = referencesForBatch(pool, batchCursor, refCount).map((ref) => ({
        dataUrl: ref.dataUrl,
      }));
      batchCursor++;
      attempts++;
      return resolved.generateImages({ prompt, references, n });
    };

    const acceptImages = async (images: { buffer: Buffer }[], visionClient: XaiClient) => {
      for (const image of images) {
        if (accepted.length >= count) break;
        try {
          const checked = await validateGrokRaster(image.buffer, name, visionClient);
          apiCostUsd += checked.visionCost;
          apiCostTicks = addTicks(apiCostTicks, checked.visionCostTicks);
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

    // Variety phase: parallel small n-batches, each with a different reference.
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
      apiCostUsd += batch.cost;
      apiCostTicks = addTicks(apiCostTicks, batch.costTicks);
      await acceptImages(batch.images, resolved);
    }

    // Retry failed slots only: one request with n = remaining.
    for (let retry = 0; retry < maxRetries && accepted.length < count; retry++) {
      const n = count - accepted.length;
      try {
        const batch = await requestBatch(n);
        apiCostUsd += batch.cost;
        apiCostTicks = addTicks(apiCostTicks, batch.costTicks);
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
    apiCostUsd,
    apiCostTicks,
    imageModel: grokAttempted ? getXaiImageModel() : null,
    refCount,
    resolution: grokAttempted ? getXaiResolution() : null,
    quality: grokAttempted ? quality : null,
    batches,
    nPerBatch,
  };
}
