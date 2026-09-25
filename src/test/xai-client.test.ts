import { afterEach, describe, expect, it, vi } from "vitest";
import { USD_TICKS_PER_DOLLAR, usdToTicks } from "@/lib/cost";
import { createLiveXaiClient, extractCost, extractCostTicks } from "@/lib/generate/xai-client";
import { fakePendantPng } from "./helpers/pendant";

describe("xAI client", () => {
  const previousResolution = process.env.XAI_RESOLUTION;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (previousResolution === undefined) delete process.env.XAI_RESOLUTION;
    else process.env.XAI_RESOLUTION = previousResolution;
  });

  it("reads cost and cost_in_usd_ticks", () => {
    expect(extractCost({ cost: 0.1 })).toBe(0.1);
    expect(extractCost({ usage: { cost: 0.08 } })).toBe(0.08);
    expect(extractCost({})).toBe(0);
    expect(extractCostTicks({ cost_in_usd_ticks: 800_000_000 })).toBe(800_000_000);
    expect(extractCostTicks({ usage: { cost_in_usd_ticks: 400_000_000 } })).toBe(400_000_000);
    expect(extractCostTicks({ cost: 0.08 })).toBe(usdToTicks(0.08));
    expect(USD_TICKS_PER_DOLLAR).toBe(10_000_000_000);
    expect(usdToTicks(1)).toBe(10_000_000_000);
  });

  it("POSTs JSON edits with n images, one ref, default 1k", async () => {
    delete process.env.XAI_RESOLUTION;
    const pngB64 = (await fakePendantPng()).toString("base64");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [{ b64_json: pngB64 }, { b64_json: pngB64 }],
          cost: 0.08,
          cost_in_usd_ticks: 800_000_000,
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createLiveXaiClient("test-key");
    const result = await client.generateImages({
      prompt: "pendant",
      references: [{ dataUrl: "data:image/png;base64,aaa" }],
      n: 2,
    });
    expect(result.images).toHaveLength(2);
    expect(result.cost).toBe(0.08);
    expect(result.costTicks).toBe(800_000_000);
    expect(result.endpoint).toBe("edits");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/images/edits");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("grok-imagine-image-2.0");
    expect(body.n).toBe(2);
    expect(body.resolution).toBe("1k");
    expect(body.image).toEqual({ url: "data:image/png;base64,aaa", type: "image_url" });
    expect(body.images).toBeUndefined();
  });

  it("uses images[] for two refs and /images/generations when ref-less", async () => {
    const pngB64 = (await fakePendantPng()).toString("base64");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ b64_json: pngB64 }], cost: 0.04 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createLiveXaiClient("test-key");

    process.env.XAI_RESOLUTION = "2k";
    await client.generateImages({
      prompt: "two",
      references: [
        { dataUrl: "data:image/png;base64,aaa" },
        { dataUrl: "data:image/png;base64,bbb" },
      ],
      n: 1,
    });
    let body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe("https://api.x.ai/v1/images/edits");
    expect(body.images).toHaveLength(2);
    expect(body.resolution).toBe("2k");

    await client.generateImages({ prompt: "none", references: [], n: 4 });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/images/generations");
    body = JSON.parse(String(init.body));
    expect(body.n).toBe(4);
    expect(body.image).toBeUndefined();
    expect(body.images).toBeUndefined();
  });

  it("transcribes via chat completions and parses JSON text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: '{"text":"Şükrü"}' } }],
          usage: { cost: 0.002, cost_in_usd_ticks: 20_000_000 },
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createLiveXaiClient("test-key");
    const result = await client.transcribeName(await fakePendantPng());
    expect(result.text).toBe("Şükrü");
    expect(result.cost).toBe(0.002);
    expect(result.costTicks).toBe(20_000_000);
  });
});
