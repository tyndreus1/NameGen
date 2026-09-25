import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveXaiClient, extractCost } from "@/lib/generate/xai-client";
import { fakePendantPng } from "./helpers/pendant";

describe("xAI client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads cost from top-level or usage fields", () => {
    expect(extractCost({ cost: 0.1 })).toBe(0.1);
    expect(extractCost({ usage: { cost: 0.08 } })).toBe(0.08);
    expect(extractCost({ usage: { cost_usd: 0.07 } })).toBe(0.07);
    expect(extractCost({})).toBe(0);
  });

  it("POSTs JSON (not multipart) to /images/edits with two refs at 2k", async () => {
    const pngB64 = (await fakePendantPng()).toString("base64");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ b64_json: pngB64 }], cost: 0.1 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createLiveXaiClient("test-key");
    const result = await client.editImage({
      prompt: "pendant",
      references: [
        { dataUrl: "data:image/png;base64,aaa" },
        { dataUrl: "data:image/png;base64,bbb" },
      ],
    });
    expect(result.cost).toBe(0.1);
    expect(result.buffer.length).toBeGreaterThan(20);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/images/edits");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("grok-imagine-image-2.0");
    expect(body.prompt).toBe("pendant");
    expect(body.aspect_ratio).toBe("5:2");
    expect(body.n).toBe(1);
    expect(body.response_format).toBe("b64_json");
    expect(body.resolution).toBe("2k");
    expect(body.images).toEqual([
      { url: "data:image/png;base64,aaa", type: "image_url" },
      { url: "data:image/png;base64,bbb", type: "image_url" },
    ]);
    expect(body.image).toBeUndefined();
  });

  it("uses image (singular) for a single reference", async () => {
    const pngB64 = (await fakePendantPng()).toString("base64");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ b64_json: pngB64 }], usage: { cost: 0.08 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createLiveXaiClient("test-key");
    await client.editImage({
      prompt: "one",
      references: [{ dataUrl: "data:image/png;base64,aaa" }],
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.image).toEqual({ url: "data:image/png;base64,aaa", type: "image_url" });
    expect(body.images).toBeUndefined();
  });

  it("transcribes via chat completions and parses JSON text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: '{"text":"Şükrü"}' } }],
          usage: { cost: 0.002 },
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createLiveXaiClient("test-key");
    const result = await client.transcribeName(await fakePendantPng());
    expect(result.text).toBe("Şükrü");
    expect(result.cost).toBe(0.002);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("grok-4.6");
    expect(body.messages[0].content[0].type).toBe("image_url");
  });
});
