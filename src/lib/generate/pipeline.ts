import { VARIATION_COUNT, type StyleId } from "../constants";
import { addTicks } from "../cost";
import { getXaiImageModel, getXaiMaxRetries, getXaiRefCount, getXaiResolution } from "../env";
import { buildVariations, composeNameSvg } from "./vector";
import { processSvgComposition, type ProcessedDesign } from "./postprocess";
import { createXaiClient, type XaiClient } from "./xai-client";
import { buildGenerationPrompt } from "./prompt";
import { loadPickedReferences } from "./references";
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

  const accepted: GeneratedDesign[] = [];
  let attempts = 0;
  let apiCostUsd = 0;
  let apiCostTicks = 0;

  if (resolved) {
    const prompt = buildGenerationPrompt(name, style, refCount);
    const references = loadPickedReferences(name, style, refCount);
    const rounds = 1 + maxRetries;

    for (let round = 0; round < rounds && accepted.length < count; round++) {
      const needed = count - accepted.length;
      attempts++;
      try {
        const batch = await resolved.generateImages({
          prompt,
          references: references.map((ref) => ({ dataUrl: ref.dataUrl })),
          n: needed,
        });
        apiCostUsd += batch.cost;
        apiCostTicks = addTicks(apiCostTicks, batch.costTicks);

        for (const image of batch.images) {
          if (accepted.length >= count) break;
          try {
            const checked = await validateGrokRaster(image.buffer, name, resolved);
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
      } catch {
        /* retry remaining slots */
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
  };
}
