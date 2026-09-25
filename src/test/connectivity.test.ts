import { describe, expect, it } from "vitest";
import {
  binaryFromRgba,
  countComponents,
  repairSmallIslands,
  unifyToSinglePiece,
  type BinaryImage,
} from "@/lib/generate/connectivity";

function blank(width: number, height: number): BinaryImage {
  return { width, height, data: new Uint8Array(width * height) };
}

function fillRect(image: BinaryImage, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      image.data[yy * image.width + xx] = 1;
    }
  }
}

function ring(image: BinaryImage, cx: number, cy: number, outer: number, inner: number): void {
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= outer && d >= inner) image.data[y * image.width + x] = 1;
    }
  }
}

describe("one-piece connectivity", () => {
  it("counts a single rectangle as 1", () => {
    const image = blank(40, 40);
    fillRect(image, 5, 5, 20, 10);
    expect(countComponents(image)).toBe(1);
  });

  it("counts two islands as 2 and unifies them", () => {
    const image = blank(60, 30);
    fillRect(image, 2, 8, 12, 12);
    fillRect(image, 40, 8, 12, 12);
    expect(countComponents(image)).toBe(2);
    expect(unifyToSinglePiece(image, { minKeepArea: 4, bridgeRadius: 2 })).toBe(1);
    expect(countComponents(image)).toBe(1);
  });

  it("removes dust specks instead of keeping them as islands", () => {
    const image = blank(40, 40);
    fillRect(image, 4, 4, 20, 20);
    image.data[1] = 1;
    expect(countComponents(image)).toBe(2);
    expect(unifyToSinglePiece(image, { minKeepArea: 4, bridgeRadius: 2 })).toBe(1);
  });

  it("treats a ring (hole) as a single black component", () => {
    const image = blank(50, 50);
    ring(image, 25, 25, 16, 8);
    expect(countComponents(image)).toBe(1);
    expect(unifyToSinglePiece(image)).toBe(1);
  });

  it("drops dust, bridges a close small dot, and rejects a far island", () => {
    const dust = blank(80, 40);
    fillRect(dust, 4, 8, 40, 20);
    dust.data[2] = 1;
    const dusted = repairSmallIslands(dust, { speckArea: 4, maxDotArea: 20, maxDistance: 8, bridgeRadius: 2 });
    expect(dusted.rejected).toBe(false);
    expect(dusted.removed).toBeGreaterThan(0);
    expect(dusted.components).toBe(1);

    const close = blank(80, 40);
    fillRect(close, 4, 10, 30, 16);
    fillRect(close, 40, 14, 4, 4);
    const bridged = repairSmallIslands(close, {
      speckArea: 2,
      maxDotArea: 30,
      maxDistance: 10,
      bridgeRadius: 2,
    });
    expect(bridged.rejected).toBe(false);
    expect(bridged.bridged).toBeGreaterThan(0);
    expect(countComponents(close)).toBe(1);

    const far = blank(120, 40);
    fillRect(far, 4, 10, 30, 16);
    fillRect(far, 90, 10, 16, 16);
    const rejected = repairSmallIslands(far, {
      speckArea: 4,
      maxDotArea: 40,
      maxDistance: 8,
      bridgeRadius: 2,
    });
    expect(rejected.rejected).toBe(true);
    expect(rejected.components).toBeGreaterThan(1);
  });

  it("fuses floating ü dots and a cedilla into the letter before the one-piece check", () => {
    const umlaut = blank(140, 90);
    fillRect(umlaut, 24, 36, 56, 30);
    fillRect(umlaut, 32, 20, 6, 6);
    fillRect(umlaut, 52, 20, 6, 6);
    const fusedDots = repairSmallIslands(umlaut);
    expect(fusedDots.rejected).toBe(false);
    expect(fusedDots.dilated + fusedDots.bridged).toBeGreaterThan(0);
    expect(countComponents(umlaut)).toBe(1);

    const cedilla = blank(140, 90);
    fillRect(cedilla, 30, 22, 44, 34);
    fillRect(cedilla, 48, 62, 5, 8);
    const fusedHook = repairSmallIslands(cedilla);
    expect(fusedHook.rejected).toBe(false);
    expect(countComponents(cedilla)).toBe(1);
  });

  it("classifies only pure black as material", () => {
    const width = 2;
    const height = 1;
    const rgba = Uint8Array.from([
      0, 0, 0, 255,
      128, 128, 128, 255,
    ]);
    const image = binaryFromRgba(rgba, width, height, 128);
    expect(image.data[0]).toBe(1);
    expect(image.data[1]).toBe(0);
  });
});
