import { afterEach, describe, expect, it } from "vitest";
import { usdToTicks } from "@/lib/cost";
import { generateDesigns } from "@/lib/generate/pipeline";
import { validateGrokRaster } from "@/lib/generate/validate";
import type { GenerateImagesArgs, XaiClient } from "@/lib/generate/xai-client";
import { blank, fakePendantPng, fillRect } from "./helpers/pendant";
import { binaryToPng } from "@/lib/generate/postprocess";

function mockClient(options: {
  name?: string;
  failRounds?: number;
  failFirstImages?: number;
  transcribe?: string;
  editCost?: number;
  visionCost?: number;
  ns?: number[];
}): XaiClient {
  let rounds = 0;
  let imagesSeen = 0;
  return {
    async generateImages(args: GenerateImagesArgs) {
      options.ns?.push(args.n);
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
      const cost = options.editCost ?? 0.08;
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
  const previousRetries = process.env.XAI_MAX_RETRIES;
  const previousRefs = process.env.XAI_REF_COUNT;

  afterEach(() => {
    if (previousRetries === undefined) delete process.env.XAI_MAX_RETRIES;
    else process.env.XAI_MAX_RETRIES = previousRetries;
    if (previousRefs === undefined) delete process.env.XAI_REF_COUNT;
    else process.env.XAI_REF_COUNT = previousRefs;
  });

  it("requests all images in one n-batch and sums ticks", async () => {
    const ns: number[] = [];
    const result = await generateDesigns("Merve", "classic", 4, mockClient({ name: "Merve", ns }));
    expect(ns).toEqual([4]);
    expect(result.designs).toHaveLength(4);
    expect(result.usedGrok).toBe(true);
    expect(result.grokAccepted).toBe(4);
    expect(result.fallbackCount).toBe(0);
    expect(result.attempts).toBe(1);
    expect(result.apiCostUsd).toBeCloseTo(0.08 + 4 * 0.002, 8);
    expect(result.apiCostTicks).toBe(usdToTicks(0.08) + 4 * usdToTicks(0.002));
    expect(result.imageModel).toBe("grok-imagine-image-2.0");
    expect(result.designs.every((d) => d.engine === "grok" && !d.fallback)).toBe(true);
    expect(result.designs[0]!.svg).toMatch(/<svg[\s\S]*<path/i);
  }, 40000);

  it("retries only failed slots (n = remaining) then accepts", async () => {
    process.env.XAI_MAX_RETRIES = "2";
    const ns: number[] = [];
    const result = await generateDesigns(
      "Merve",
      "classic",
      4,
      mockClient({ name: "Merve", failFirstImages: 2, ns }),
    );
    expect(ns[0]).toBe(4);
    expect(ns[1]).toBe(2);
    expect(result.grokAccepted).toBe(4);
    expect(result.fallbackCount).toBe(0);
    expect(result.attempts).toBe(2);
  }, 40000);

  it("falls back to the font path after retries and marks it", async () => {
    process.env.XAI_MAX_RETRIES = "2";
    const result = await generateDesigns(
      "Merve",
      "classic",
      1,
      mockClient({ name: "Merve", failRounds: 99 }),
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
    );
    expect(result.fallbackCount).toBe(1);
    expect(result.attempts).toBe(3);
    expect(result.apiCostUsd).toBeCloseTo(3 * (0.08 + 0.002), 8);
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
