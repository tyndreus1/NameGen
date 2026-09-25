import { describe, expect, it } from "vitest";
import { hasEndRings } from "@/lib/generate/rings";
import { blank, fillRect, pendantBinary, ring } from "./helpers/pendant";

describe("end-ring detection", () => {
  it("accepts compact interior holes at both horizontal extremes", () => {
    const check = hasEndRings(pendantBinary());
    expect(check.ok).toBe(true);
    expect(check.left).not.toBeNull();
    expect(check.right).not.toBeNull();
    expect(check.left).not.toBe(check.right);
  });

  it("rejects an open C-shape that a naive ring check might flag", () => {
    const image = blank(200, 80);
    fillRect(image, 40, 36, 120, 10);
    // Left: open C (gap to the background) — looks circular but is not a closed loop.
    ring(image, 24, 40, 16, 8);
    fillRect(image, 0, 36, 12, 10);
    for (let y = 36; y < 46; y++) {
      for (let x = 8; x < 24; x++) image.data[y * image.width + x] = 0;
    }
    ring(image, 176, 40, 16, 8);
    fillRect(image, 160, 36, 16, 10);
    expect(hasEndRings(image).ok).toBe(false);
  });

  it("does not treat a skinny spiral-like slit as a jump ring", () => {
    const image = blank(220, 80);
    fillRect(image, 20, 30, 180, 20);
    // Long enclosed horizontal gap near the left — spiral / flourish void, not a round hole.
    fillRect(image, 24, 36, 28, 4);
    for (let x = 24; x < 52; x++) {
      image.data[36 * image.width + x] = 0;
      image.data[37 * image.width + x] = 0;
      image.data[38 * image.width + x] = 0;
      image.data[39 * image.width + x] = 0;
    }
    ring(image, 200, 40, 14, 6);
    expect(hasEndRings(image).ok).toBe(false);
  });

  it("ignores a compact hole in the middle of the name", () => {
    const image = pendantBinary();
    // Punch an extra enclosed hole in the bar center.
    const cx = 200;
    const cy = 60;
    for (let y = cy - 6; y <= cy + 6; y++) {
      for (let x = cx - 6; x <= cx + 6; x++) {
        if (Math.hypot(x - cx, y - cy) <= 5) image.data[y * image.width + x] = 0;
      }
    }
    const check = hasEndRings(image);
    expect(check.ok).toBe(true);
    expect(check.left!.cx).toBeLessThan(80);
    expect(check.right!.cx).toBeGreaterThan(320);
  });
});
