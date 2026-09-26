import { afterEach, describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/db";
import { ticksToUsd } from "@/lib/cost";
import { generateDesigns } from "@/lib/generate/pipeline";
import { yieldEventLoop } from "@/lib/generate/offload";
import type { GenerateImagesArgs, XaiClient } from "@/lib/generate/xai-client";
import { largePendantPng } from "./helpers/pendant";

function mockLargeClient(png: Buffer, ticksPerBatch: number): XaiClient {
  return {
    async generateImages(args: GenerateImagesArgs) {
      return {
        images: Array.from({ length: args.n }, () => ({ buffer: png })),
        cost: 0,
        costTicks: ticksPerBatch,
        model: args.model ?? "grok-imagine-image-2.0",
        endpoint: args.references.length ? "edits" : "generations",
      };
    },
    async transcribeName() {
      return { text: "Merve", cost: 0, costTicks: 0 };
    },
  };
}

async function measureLag(sampleMs: number): Promise<number> {
  let max = 0;
  let last = performance.now();
  const stopAt = last + sampleMs;
  while (performance.now() < stopAt) {
    await yieldEventLoop();
    const now = performance.now();
    const gap = now - last;
    last = now;
    if (gap > max) max = gap;
  }
  return max;
}

describe("event loop after a real-sized generation", () => {
  afterEach(async () => {
    await prisma.appSettings.deleteMany();
  });

  it("keeps the loop free and stores USD from ticks", async () => {
    const png = await largePendantPng(1600, 640, 240);
    const ticksPerBatch = 994_000_000;
    const client = mockLargeClient(png, ticksPerBatch);

    let catalogMs = Number.POSITIVE_INFINITY;
    const catalogProbe = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const t0 = performance.now();
      await prisma.category.findMany({ take: 5 });
      catalogMs = performance.now() - t0;
    })();

    const result = await generateDesigns("Merve", "classic", 4, client, {
      batches: 2,
      nPerBatch: 2,
      maxRetries: 0,
      refCount: 1,
      quality: "low",
    });
    await catalogProbe;

    expect(result.grokAccepted).toBe(4);
    expect(result.apiCostTicks).toBe(ticksPerBatch * 2);
    expect(result.apiCostUsd).toBeCloseTo(ticksToUsd(ticksPerBatch * 2), 6);
    expect(result.apiCostUsd).toBeCloseTo(0.1988, 5);
    expect(catalogMs).toBeLessThan(400);

    const afterLag = await measureLag(120);
    expect(afterLag).toBeLessThan(80);

    const t0 = performance.now();
    await prisma.category.findMany({ where: { enabled: true } });
    expect(performance.now() - t0).toBeLessThan(250);

    const second = await generateDesigns("Merve", "hearts", 1, client, {
      batches: 1,
      nPerBatch: 1,
      maxRetries: 0,
      refCount: 1,
      quality: "low",
    });
    expect(second.designs).toHaveLength(1);
    expect(second.apiCostUsd).toBeCloseTo(ticksToUsd(ticksPerBatch), 6);
  }, 60000);
});
