import { binaryToPng } from "@/lib/generate/postprocess";
import type { BinaryImage } from "@/lib/generate/connectivity";

export function blank(width: number, height: number): BinaryImage {
  return { width, height, data: new Uint8Array(width * height) };
}

export function fillRect(image: BinaryImage, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) continue;
      image.data[yy * image.width + xx] = 1;
    }
  }
}

export function ring(image: BinaryImage, cx: number, cy: number, outer: number, inner: number): void {
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= outer && d >= inner) image.data[y * image.width + x] = 1;
    }
  }
}

/** One-piece bar with compact open rings at both horizontal extremes. */
export function pendantBinary(width = 400, height = 120): BinaryImage {
  const image = blank(width, height);
  const midY = Math.round(height / 2);
  fillRect(image, 46, midY - 8, width - 92, 16);
  ring(image, 28, midY, 20, 9);
  ring(image, width - 28, midY, 20, 9);
  fillRect(image, 40, midY - 4, 16, 8);
  fillRect(image, width - 56, midY - 4, 16, 8);
  return image;
}

export async function fakePendantPng(): Promise<Buffer> {
  return binaryToPng(pendantBinary());
}
