import { VARIATION_COUNT, type StyleId } from "../constants";
import { buildVariations, composeNameSvg } from "./vector";
import { generateGrokImages, tryProcessGrokImage } from "./grok";
import { processSvgComposition, type ProcessedDesign } from "./postprocess";
import { getXaiApiKey } from "../env";

export type GeneratedDesign = ProcessedDesign & {
  index: number;
  engine: "deterministic" | "grok";
};

export type GenerateResult = {
  designs: GeneratedDesign[];
  usedGrok: boolean;
  grokAttempted: boolean;
  grokAccepted: number;
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

async function deterministicDesign(
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
  return { ...processed, index, engine: "deterministic" };
}

export async function generateDesigns(
  rawName: string,
  style: StyleId,
  count = VARIATION_COUNT,
): Promise<GenerateResult> {
  const name = assertName(rawName);
  const designs: GeneratedDesign[] = [];
  let grokAttempted = false;
  let grokAccepted = 0;

  const apiKey = getXaiApiKey();
  if (apiKey) {
    grokAttempted = true;
    try {
      const images = await generateGrokImages(name, style, count);
      for (const [i, image] of images.entries()) {
        const processed = await tryProcessGrokImage(image);
        if (processed) {
          designs.push({ ...processed, index: i, engine: "grok" });
          grokAccepted++;
        }
      }
    } catch {
      // Fall through to the deterministic generator. Never fail the request
      // just because Grok is unavailable — spelling/connectivity must still hold.
    }
  }

  let slot = 0;
  while (designs.length < count) {
    const generated = await deterministicDesign(name, style, slot % count);
    generated.index = designs.length;
    designs.push(generated);
    slot++;
  }

  if (designs.length === 0) {
    throw new Error("Tasarım üretilemedi");
  }

  return {
    designs: designs.slice(0, count),
    usedGrok: grokAccepted > 0,
    grokAttempted,
    grokAccepted,
  };
}
