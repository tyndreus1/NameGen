import { ticksToUsd, usdToTicks } from "../cost";
import { getXaiApiKey, getXaiImageModel, getXaiQuality, getXaiResolution, getXaiTextModel } from "../env";

export const XAI_BASE = "https://api.x.ai/v1";

export type GenerateImagesArgs = {
  prompt: string;
  references: { dataUrl: string }[];
  n: number;
  model?: string;
  quality?: string;
  resolution?: string;
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

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function readUsdField(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload as Record<string, unknown>;
  const direct = asFiniteNumber(obj.cost) ?? asFiniteNumber(obj.cost_usd);
  if (direct && direct > 0) return direct;
  const usage = obj.usage;
  if (usage && typeof usage === "object") {
    const u = usage as Record<string, unknown>;
    const nested = asFiniteNumber(u.cost) ?? asFiniteNumber(u.cost_usd);
    if (nested && nested > 0) return nested;
  }
  return 0;
}

function readTicksField(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload as Record<string, unknown>;
  const direct = asFiniteNumber(obj.cost_in_usd_ticks);
  if (direct && direct > 0) return Math.round(direct);
  const usage = obj.usage;
  if (usage && typeof usage === "object") {
    const nested = asFiniteNumber((usage as Record<string, unknown>).cost_in_usd_ticks);
    if (nested && nested > 0) return Math.round(nested);
  }
  return 0;
}

/** xAI often sends only `cost_in_usd_ticks` (1e10 = $1) and no dollar field. */
export function extractCost(payload: unknown): number {
  const usd = readUsdField(payload);
  if (usd > 0) return usd;
  return ticksToUsd(readTicksField(payload));
}

export function extractCostTicks(payload: unknown): number {
  const ticks = readTicksField(payload);
  if (ticks > 0) return ticks;
  return usdToTicks(readUsdField(payload));
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
    async generateImages({ prompt, references, n, model: modelOverride, quality: qualityOverride, resolution: resolutionOverride }) {
      const model = modelOverride || getXaiImageModel();
      const resolution = resolutionOverride === "2k" || resolutionOverride === "1k" ? resolutionOverride : getXaiResolution();
      const quality =
        qualityOverride === "low" || qualityOverride === "medium" || qualityOverride === "high"
          ? qualityOverride
          : getXaiQuality();
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
