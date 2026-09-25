import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { generateDesigns } from "@/lib/generate/pipeline";
import { countComponents, hasGrayPixels } from "@/lib/generate/connectivity";
import { pngToBinary } from "@/lib/generate/postprocess";

describe("deterministic name generation", () => {
  it("renders Merve as a single black piece with vector SVG", async () => {
    const result = await generateDesigns("Merve", "classic", 1);
    expect(result.designs).toHaveLength(1);
    expect(result.usedGrok).toBe(false);
    const design = result.designs[0]!;
    expect(design.components).toBe(1);
    expect(design.svg).toMatch(/<svg[\s\S]*<path/i);
    expect(design.svg).not.toMatch(/<image/i);

    const { data } = await sharp(design.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(hasGrayPixels(data)).toBe(false);
    expect(countComponents(await pngToBinary(design.png))).toBe(1);
  }, 40000);

  it("keeps Turkish letters in Şükrü and stays one piece", async () => {
    const result = await generateDesigns("Şükrü", "hearts", 1);
    const design = result.designs[0]!;
    expect(design.components).toBe(1);
    expect(design.png.length).toBeGreaterThan(500);
  }, 40000);
});
