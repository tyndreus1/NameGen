import { describe, expect, it } from "vitest";
import { generateDesigns } from "@/lib/generate/pipeline";
import { validateGrokRaster } from "@/lib/generate/validate";
import type { XaiClient } from "@/lib/generate/xai-client";
import { blank, fakePendantPng, fillRect } from "./helpers/pendant";
import { binaryToPng } from "@/lib/generate/postprocess";

function mockClient(options: {
  name?: string;
  failEdits?: number;
  transcribe?: string;
  editCost?: number;
  visionCost?: number;
  buffer?: () => Promise<Buffer>;
}): XaiClient {
  let editCalls = 0;
  return {
    async editImage() {
      editCalls++;
      if (options.failEdits && editCalls <= options.failEdits) {
        throw new Error("simulated edit failure");
      }
      return {
        buffer: await (options.buffer ? options.buffer() : fakePendantPng()),
        cost: options.editCost ?? 0.1,
        model: "grok-imagine-image-2.0",
      };
    },
    async transcribeName() {
      return {
        text: options.transcribe ?? options.name ?? "Merve",
        cost: options.visionCost ?? 0.002,
      };
    },
  };
}

describe("Grok-primary pipeline (mocked xAI)", () => {
  it("accepts four parallel Grok slots and sums API cost", async () => {
    const result = await generateDesigns("Merve", "classic", 4, mockClient({ name: "Merve" }));
    expect(result.designs).toHaveLength(4);
    expect(result.usedGrok).toBe(true);
    expect(result.grokAttempted).toBe(true);
    expect(result.grokAccepted).toBe(4);
    expect(result.fallbackCount).toBe(0);
    expect(result.attempts).toBe(4);
    expect(result.apiCostUsd).toBeCloseTo(4 * (0.1 + 0.002), 8);
    expect(result.imageModel).toBe("grok-imagine-image-2.0");
    expect(result.designs.every((d) => d.engine === "grok" && !d.fallback)).toBe(true);
    expect(result.designs[0]!.svg).toMatch(/<svg[\s\S]*<path/i);
  }, 40000);

  it("retries a slot twice then accepts on the third try", async () => {
    const result = await generateDesigns(
      "Merve",
      "classic",
      1,
      mockClient({ name: "Merve", failEdits: 2 }),
    );
    expect(result.grokAccepted).toBe(1);
    expect(result.fallbackCount).toBe(0);
    expect(result.attempts).toBe(3);
    expect(result.apiCostUsd).toBeCloseTo(0.1 + 0.002, 8);
  }, 40000);

  it("falls back to the font path after 3 failed retries and marks it", async () => {
    const result = await generateDesigns(
      "Merve",
      "classic",
      1,
      mockClient({ name: "Merve", failEdits: 99 }),
    );
    expect(result.grokAccepted).toBe(0);
    expect(result.fallbackCount).toBe(1);
    expect(result.attempts).toBe(3);
    expect(result.usedGrok).toBe(false);
    expect(result.designs[0]!.engine).toBe("deterministic");
    expect(result.designs[0]!.fallback).toBe(true);
  }, 40000);

  it("rejects a spelling mismatch and then falls back", async () => {
    const result = await generateDesigns(
      "Merve",
      "classic",
      1,
      mockClient({ transcribe: "Zeynep" }),
    );
    expect(result.fallbackCount).toBe(1);
    expect(result.attempts).toBe(3);
    expect(result.apiCostUsd).toBeCloseTo(3 * (0.1 + 0.002), 8);
  }, 40000);

  it("uses the font path immediately when no xAI client is configured", async () => {
    const result = await generateDesigns("Merve", "classic", 1, null);
    expect(result.grokAttempted).toBe(false);
    expect(result.usedGrok).toBe(false);
    expect(result.imageModel).toBeNull();
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
