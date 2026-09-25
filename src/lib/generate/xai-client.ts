import { usdToTicks } from "../cost";
import { getXaiApiKey, getXaiImageModel, getXaiQuality, getXaiResolution, getXaiTextModel } from "../env";

export const XAI_BASE = "https://api.x.ai/v1";

export type GenerateImagesArgs = {
  prompt: string;
  references: { dataUrl: string }[];
  n: number;
};

export type GeneratedImage = {
  buffer: Buffer;
};

export type GenerateImagesResult = {
  images: GeneratedImage[];
  cost: number;
  costTicks: number;
  model: string;
  endpoint: "edits" | "generations";
};

export type TranscribeResult = {
  text: string;
  cost: number;
  costTicks: number;
};

export type XaiClient = {
  generateImages(args: GenerateImagesArgs): Promise<GenerateImagesResult>;
  transcribeName(png: Buffer): Promise<TranscribeResult>;
};

export function extractCost(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.cost === "number") return obj.cost;
  const usage = obj.usage;
  if (usage && typeof usage === "object") {
    const u = usage as Record<string, unknown>;
    if (typeof u.cost === "number") return u.cost;
    if (typeof u.cost_usd === "number") return u.cost_usd;
  }
  return 0;
}

export function extractCostTicks(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.cost_in_usd_ticks === "number") return Math.round(obj.cost_in_usd_ticks);
  const usage = obj.usage;
  if (usage && typeof usage === "object") {
    const u = usage as Record<string, unknown>;
    if (typeof u.cost_in_usd_ticks === "number") return Math.round(u.cost_in_usd_ticks);
  }
  return usdToTicks(extractCost(payload));
}

function decodeImageItem(item: { b64_json?: string; url?: string } | undefined): Buffer | null {
  if (!item) return null;
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  return null;
}

async function postJson(path: string, apiKey: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${XAI_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`xAI ${path} failed (${response.status}): ${text.slice(0, 280)}`);
  }
  return parsed;
}

async function buffersFromResponse(
  json: { data?: { b64_json?: string; url?: string }[] },
): Promise<Buffer[]> {
  const items = json.data ?? [];
  const out: Buffer[] = [];
  for (const item of items) {
    const fromB64 = decodeImageItem(item);
    if (fromB64) {
      out.push(fromB64);
      continue;
    }
    if (item.url) {
      const downloaded = await fetch(item.url);
      if (!downloaded.ok) throw new Error("xAI image URL download failed");
      out.push(Buffer.from(await downloaded.arrayBuffer()));
    }
  }
  return out;
}

export function createLiveXaiClient(apiKey: string): XaiClient {
  return {
    async generateImages({ prompt, references, n }) {
      const model = getXaiImageModel();
      const resolution = getXaiResolution();
      const quality = getXaiQuality();
      const count = Math.max(1, Math.round(n));
      const base: Record<string, unknown> = {
        model,
        prompt,
        aspect_ratio: "5:2",
        n: count,
        response_format: "b64_json",
        resolution,
      };

      const endpoint = references.length === 0 ? "generations" : "edits";
      if (endpoint === "edits") {
        // Edits default to medium (+$0.02/image). Pin low unless env overrides.
        base.quality = quality;
      }
      if (references.length === 1) {
        base.image = { url: references[0]!.dataUrl, type: "image_url" };
      } else if (references.length > 1) {
        base.images = references.map((ref) => ({ url: ref.dataUrl, type: "image_url" }));
      }

      const path = endpoint === "edits" ? "/images/edits" : "/images/generations";
      const json = (await postJson(path, apiKey, base)) as {
        data?: { b64_json?: string; url?: string }[];
      };
      const buffers = await buffersFromResponse(json);
      if (!buffers.length) throw new Error(`xAI ${endpoint} returned no image`);
      return {
        images: buffers.map((buffer) => ({ buffer })),
        cost: extractCost(json),
        costTicks: extractCostTicks(json),
        model,
        endpoint,
      };
    },

    async transcribeName(png) {
      const model = getXaiTextModel();
      const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
      const json = (await postJson("/chat/completions", apiKey, {
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text:
                  'This is a laser-cut name necklace silhouette. Transcribe ONLY the name written in the design, exactly as spelled, including Turkish letters (ç, ğ, ı, İ, ö, ş, ü). Reply with JSON only: {"text":"..."} and no other words.',
              },
            ],
          },
        ],
      })) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      const match = content.match(/\{[\s\S]*\}/);
      let text = content.trim();
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as { text?: string };
          if (parsed.text) text = parsed.text;
        } catch {
          /* keep raw */
        }
      }
      return {
        text: text.normalize("NFC").trim(),
        cost: extractCost(json),
        costTicks: extractCostTicks(json),
      };
    },
  };
}

export function createXaiClient(): XaiClient | null {
  const key = getXaiApiKey();
  if (!key) return null;
  return createLiveXaiClient(key);
}
