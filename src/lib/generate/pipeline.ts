import { VARIATION_COUNT, type StyleId } from "../constants";
import { getXaiImageModel } from "../env";
import { buildVariations, composeNameSvg } from "./vector";
import { processSvgComposition, type ProcessedDesign } from "./postprocess";
import { createXaiClient, type XaiClient } from "./xai-client";
import { buildEditPrompt } from "./prompt";
import { loadPickedReferences } from "./references";
import { validateGrokRaster } from "./validate";

const SLOT_RETRIES = 3;

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
  imageModel: string | null;
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

async function fillSlot(
  name: string,
  style: StyleId,
  index: number,
  client: XaiClient | null,
): Promise<{ design: GeneratedDesign; attempts: number; cost: number }> {
  let attempts = 0;
  let cost = 0;
  if (client) {
    const prompt = buildEditPrompt(name, style);
    const references = loadPickedReferences(name, style);
    for (let tryIndex = 0; tryIndex < SLOT_RETRIES; tryIndex++) {
      attempts++;
      try {
        const edited = await client.editImage({
          prompt,
          references: references.map((ref) => ({ dataUrl: ref.dataUrl })),
        });
        cost += edited.cost;
        const checked = await validateGrokRaster(edited.buffer, name, client);
        cost += checked.visionCost;
        if (checked.ok) {
          return {
            design: {
              png: checked.png,
              svg: checked.svg,
              components: 1,
              source: "grok",
              index,
              engine: "grok",
              fallback: false,
            },
            attempts,
            cost,
          };
        }
      } catch {
        /* retry */
      }
    }
  }

  const fallback = await deterministicDesign(name, style, index);
  return { design: fallback, attempts, cost };
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

  const slots = await Promise.all(
    Array.from({ length: count }, (_, index) => fillSlot(name, style, index, resolved)),
  );

  const designs = slots.map((slot) => slot.design);
  const grokAccepted = designs.filter((d) => d.engine === "grok").length;
  const fallbackCount = designs.filter((d) => d.engine !== "grok").length;
  const attempts = slots.reduce((sum, slot) => sum + slot.attempts, 0);
  const apiCostUsd = slots.reduce((sum, slot) => sum + slot.cost, 0);

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
    imageModel: grokAttempted ? getXaiImageModel() : null,
  };
}
