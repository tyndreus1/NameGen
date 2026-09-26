import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usdToTicks } from "@/lib/cost";
import { generateDesigns } from "@/lib/generate/pipeline";
import { validateGrokRaster } from "@/lib/generate/validate";
import type { GenerateImagesArgs, XaiClient } from "@/lib/generate/xai-client";
import { blank, fakeLeftRingPendantPng, fakePendantPng, fillRect } from "./helpers/pendant";
import { ringPolicyFrom } from "@/lib/generate/ring-policy";
import { binaryToPng } from "@/lib/generate/postprocess";
import { prisma } from "@/lib/db";

function mockClient(options: {
  name?: string;
  failRounds?: number;
  failFirstImages?: number;
  transcribe?: string;
  editCost?: number;
  visionCost?: number;
  ns?: number[];
  refs?: string[];
}): XaiClient {
  let rounds = 0;
  let imagesSeen = 0;
  return {
    async generateImages(args: GenerateImagesArgs) {
      options.ns?.push(args.n);
      options.refs?.push(args.references[0]?.dataUrl ?? "");
      rounds++;
      if (options.failRounds && rounds <= options.failRounds) {
        throw new Error("simulated edit failure");
      }
      const good = await fakePendantPng();
      const bad = await binaryToPng(blank(80, 40));
      const images = Array.from({ length: args.n }, () => {
        imagesSeen++;
        const useBad = options.failFirstImages != null && imagesSeen <= options.failFirstImages;
        return { buffer: useBad ? bad : good };
      });
      const cost = options.editCost ?? 0.09;
      return {
        images,
        cost,
        costTicks: usdToTicks(cost),
        model: "grok-imagine-image-2.0",
        endpoint: "edits" as const,
      };
    },
    async transcribeName() {
      const cost = options.visionCost ?? 0.002;
      return {
        text: options.transcribe ?? options.name ?? "Merve",
        cost,
        costTicks: usdToTicks(cost),
      };
    },
  };
}

describe("Grok-primary pipeline (mocked xAI)", () => {
  const previous = {
    retries: process.env.XAI_MAX_RETRIES,
    refs: process.env.XAI_REF_COUNT,
    batches: process.env.XAI_BATCHES,
    nPer: process.env.XAI_N_PER_BATCH,
  };

  beforeEach(async () => {
    await prisma.appSettings.deleteMany();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries({
      XAI_MAX_RETRIES: previous.retries,
      XAI_REF_COUNT: previous.refs,
      XAI_BATCHES: previous.batches,
      XAI_N_PER_BATCH: previous.nPer,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("uses two n=2 batches with different references for variety", async () => {
    const ns: number[] = [];
    const refs: string[] = [];
    const result = await generateDesigns(
      "Merve",
      "classic",
      4,
      mockClient({ name: "Merve", ns, refs }),
      { batches: 2, nPerBatch: 2, maxRetries: 2, refCount: 1, quality: "low" },
    );
    expect(ns).toEqual([2, 2]);
    expect(new Set(refs.filter(Boolean)).size).toBe(2);
    expect(result.designs).toHaveLength(4);
    expect(result.grokAccepted).toBe(4);
    expect(result.fallbackCount).toBe(0);
    expect(result.attempts).toBe(2);
    expect(result.quality).toBe("low");
    expect(result.batches).toBe(2);
    expect(result.nPerBatch).toBe(2);
    expect(result.apiCostUsd).toBeCloseTo(2 * 0.09 + 4 * 0.002, 8);
    expect(result.designs.every((d) => d.engine === "grok")).toBe(true);
  }, 40000);

  it("retries only failed slots (n = remaining) then accepts", async () => {
    process.env.XAI_MAX_RETRIES = "2";
    const ns: number[] = [];
    const result = await generateDesigns(
      "Merve",
      "classic",
      4,
      mockClient({ name: "Merve", failFirstImages: 2, ns }),
      { batches: 2, nPerBatch: 2, maxRetries: 2, refCount: 1, quality: "low" },
    );
    expect(ns.slice(0, 2).sort()).toEqual([2, 2]);
    expect(ns[2]).toBe(2);
    expect(result.grokAccepted).toBe(4);
    expect(result.fallbackCount).toBe(0);
    expect(result.attempts).toBe(3);
  }, 40000);

  it("falls back to the font path after retries and marks it", async () => {
    process.env.XAI_MAX_RETRIES = "2";
    const result = await generateDesigns(
      "Merve",
      "classic",
      1,
      mockClient({ name: "Merve", failRounds: 99 }),
      { batches: 2, nPerBatch: 2, maxRetries: 2, refCount: 1, quality: "low" },
    );
    expect(result.grokAccepted).toBe(0);
    expect(result.fallbackCount).toBe(1);
    expect(result.attempts).toBe(3);
    expect(result.usedGrok).toBe(false);
    expect(result.designs[0]!.engine).toBe("deterministic");
    expect(result.designs[0]!.fallback).toBe(true);
  }, 40000);

  it("rejects a spelling mismatch and then falls back", async () => {
    process.env.XAI_MAX_RETRIES = "2";
    const result = await generateDesigns(
      "Merve",
      "classic",
      1,
      mockClient({ transcribe: "Zeynep" }),
      { batches: 2, nPerBatch: 2, maxRetries: 2, refCount: 1, quality: "low" },
    );
    expect(result.fallbackCount).toBe(1);
    expect(result.attempts).toBe(3);
    expect(result.apiCostUsd).toBeCloseTo(3 * (0.09 + 0.002), 8);
  }, 40000);

  it("uses the font path immediately when no xAI client is configured", async () => {
    const result = await generateDesigns("Merve", "classic", 1, null);
    expect(result.grokAttempted).toBe(false);
    expect(result.usedGrok).toBe(false);
    expect(result.imageModel).toBeNull();
    expect(result.apiCostTicks).toBe(0);
    expect(result.designs[0]!.fallback).toBe(true);
  }, 40000);
});

describe("Grok raster validation", () => {
  it("accepts a one-piece B/W pendant with rings and matching spelling", async () => {
    const checked = await validateGrokRaster(
      await fakePendantPng(),
      "Merve",
      mockClient({ transcribe: "Merve" }),
    );
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.svg).toMatch(/<path/i);
      expect(checked.transcribed).toBe("Merve");
    }
  }, 20000);

  it("accepts a one-ring design when the category says one ring", async () => {
    const checked = await validateGrokRaster(
      await fakeLeftRingPendantPng(),
      "Merve",
      mockClient({ transcribe: "Merve" }),
      ringPolicyFrom({ ringCount: "one", ringPosition: "left", enforceRings: true }),
    );
    expect(checked.ok).toBe(true);
  }, 20000);

  it("rejects a one-ring design when the category still requires two rings", async () => {
    const checked = await validateGrokRaster(
      await fakeLeftRingPendantPng(),
      "Merve",
      mockClient({ transcribe: "Merve" }),
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.reason).toMatch(/ring/i);
  }, 20000);

  it("rejects a far detached island that cannot be bridged", async () => {
    const image = blank(400, 120);
    fillRect(image, 20, 40, 200, 30);
    fillRect(image, 360, 40, 20, 20);
    const png = await binaryToPng(image);
    const checked = await validateGrokRaster(png, "Merve", mockClient({ transcribe: "Merve" }));
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.reason).toMatch(/not one piece|ring/i);
  });
});
