import { getXaiApiKey, getXaiImageModel, getXaiTextModel } from "../env";

export const XAI_BASE = "https://api.x.ai/v1";

export type EditImageArgs = {
  prompt: string;
  references: { dataUrl: string }[];
};

export type EditImageResult = {
  buffer: Buffer;
  cost: number;
  model: string;
};

export type TranscribeResult = {
  text: string;
  cost: number;
};

export type XaiClient = {
  editImage(args: EditImageArgs): Promise<EditImageResult>;
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

export function createLiveXaiClient(apiKey: string): XaiClient {
  return {
    async editImage({ prompt, references }) {
      const model = getXaiImageModel();
      const images = references.map((ref) => ({
        url: ref.dataUrl,
        type: "image_url",
      }));
      const body: Record<string, unknown> = {
        model,
        prompt,
        aspect_ratio: "5:2",
        n: 1,
        response_format: "b64_json",
        resolution: "2k",
      };
      if (images.length === 1) {
        body.image = images[0];
      } else {
        body.images = images;
      }
      const json = (await postJson("/images/edits", apiKey, body)) as {
        data?: { b64_json?: string; url?: string }[];
      };
      const item = json.data?.[0];
      let buffer: Buffer | null = null;
      if (item?.b64_json) buffer = Buffer.from(item.b64_json, "base64");
      else if (item?.url) {
        const downloaded = await fetch(item.url);
        if (!downloaded.ok) throw new Error("xAI edit image URL download failed");
        buffer = Buffer.from(await downloaded.arrayBuffer());
      }
      if (!buffer) throw new Error("xAI edit returned no image");
      return { buffer, cost: extractCost(json), model };
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
      return { text: text.normalize("NFC").trim(), cost: extractCost(json) };
    },
  };
}

export function createXaiClient(): XaiClient | null {
  const key = getXaiApiKey();
  if (!key) return null;
  return createLiveXaiClient(key);
}
