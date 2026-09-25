import { getXaiApiKey } from "../env";
import type { StyleId } from "../constants";
import { processRaster, type ProcessedDesign } from "./postprocess";

const XAI_BASE = "https://api.x.ai/v1";
const XAI_MODEL = "grok-imagine-image-2.0";

const STYLE_HINT: Record<StyleId, string> = {
  classic:
    "Classic flowing script, a swooping underline swash under the whole name, no extra ornaments besides the two end rings.",
  hearts:
    "Integrate hollow heart shapes into the outline: a heart in the left flourish and a small hollow heart dangling from the center of the underline swash on a short stem.",
  star:
    "Integrate a small 4-pointed star into the right-side flourish, still attached to the main outline.",
  butterfly:
    "A small filled butterfly silhouette perched on a letter, attached to the main outline by a short stem. Optional tiny hollow heart dangling from the swash.",
  elegant:
    "Elegant minimal script: clean swash, two end rings, no extra ornaments.",
};

export function buildGrokPrompt(name: string, style: StyleId, variation: number): string {
  return [
    `Laser-cut name necklace / pendant silhouette.`,
    `The name is spelled EXACTLY: "${name}" (do not change, add, or drop any letter, including Turkish letters).`,
    `Bold flowing calligraphy script. Every letter joined into ONE single connected black piece.`,
    `A swooping underline/swash flowing under the whole name that ties everything together.`,
    `A small ring (circle with a hole) at the far left end and another at the far right end, for a chain.`,
    STYLE_HINT[style],
    `Variation ${variation + 1}: slightly different swash curve and ornament placement.`,
    `Pure black (#000000) silhouette on a pure white (#FFFFFF) background.`,
    `No gray, no gradients, no shadows, no photorealism, no texture, no extra text, no watermark.`,
    `High-contrast stencil / vector look, as if already prepared for laser cutting.`,
    `Interior holes only for letter counters (e, a, o) and the two ring holes.`,
    `No detached dots, no floating ornaments, no i-dots that are not connected.`,
  ].join(" ");
}

export type GrokImage = {
  buffer: Buffer;
  prompt: string;
};

export async function generateGrokImages(
  name: string,
  style: StyleId,
  count: number,
): Promise<GrokImage[]> {
  const apiKey = getXaiApiKey();
  if (!apiKey) return [];

  const prompt = buildGrokPrompt(name, style, 0);
  const response = await fetch(`${XAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      prompt,
      n: count,
      response_format: "b64_json",
      aspect_ratio: "2:1",
      resolution: "1k",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`xAI image generation failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const json = (await response.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const images: GrokImage[] = [];
  for (const item of json.data ?? []) {
    if (item.b64_json) {
      images.push({ buffer: Buffer.from(item.b64_json, "base64"), prompt });
      continue;
    }
    if (item.url) {
      const downloaded = await fetch(item.url);
      if (downloaded.ok) {
        images.push({ buffer: Buffer.from(await downloaded.arrayBuffer()), prompt });
      }
    }
  }
  return images;
}

export async function tryProcessGrokImage(image: GrokImage): Promise<ProcessedDesign | null> {
  try {
    return await processRaster(image.buffer, "grok");
  } catch {
    return null;
  }
}
