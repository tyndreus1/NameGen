import { Resvg } from "@resvg/resvg-js";
import potrace from "potrace";
import sharp from "sharp";
import {
  binaryFromRgba,
  binaryToRgba,
  countComponents,
  cropToContent,
  hasGrayPixels,
  punchDisk,
  unifyToSinglePiece,
  type BinaryImage,
} from "./connectivity";
import type { RingSpec } from "./vector";

export type ProcessedDesign = {
  png: Buffer;
  svg: string;
  components: number;
  source: "deterministic" | "grok";
};

function rasterizeSvg(svg: string, width = 2000): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
  });
  return resvg.render().asPng();
}

export async function pngToBinary(png: Buffer, threshold = 160): Promise<BinaryImage> {
  const { data, info } = await sharp(png)
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return binaryFromRgba(data, info.width, info.height, threshold);
}

export async function binaryToPng(image: BinaryImage): Promise<Buffer> {
  const rgba = binaryToRgba(image);
  return sharp(rgba, {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: false,
      palette: true,
      colors: 2,
      dither: 0,
    })
    .toBuffer();
}

function traceToSvg(png: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace();
    tracer.setParameters({
      threshold: 128,
      color: "#000000",
      background: "#ffffff",
      turdSize: 12,
      optTolerance: 0.42,
      turnPolicy: "minority",
      blackOnWhite: true,
    });
    tracer.loadImage(png, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(cleanTracedSvg(tracer.getSVG()));
    });
  });
}

export function cleanTracedSvg(svg: string): string {
  if (/<image[\s>]/i.test(svg)) {
    throw new Error("Traced SVG contained an embedded raster image");
  }
  let cleaned = svg
    .replace(/fill="(?!#000000|#000|#ffffff|#fff|none)[^"]*"/gi, 'fill="#000000"')
    .replace(/stroke="(?!#000000|#000|none)[^"]*"/gi, 'stroke="#000000"');
  if (!cleaned.includes('xmlns="http://www.w3.org/2000/svg"')) {
    cleaned = cleaned.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return cleaned;
}

export async function processRaster(
  pngInput: Buffer,
  source: ProcessedDesign["source"],
  rings?: { x: number; y: number; inner: number }[],
): Promise<ProcessedDesign> {
  let binary = await pngToBinary(pngInput);
  if (countBlackSafe(binary) < 80) {
    throw new Error("Design is empty after threshold");
  }
  if (rings?.length) {
    for (const ring of rings) {
      punchDisk(binary, ring.x, ring.y, ring.inner);
    }
  }
  const components = unifyToSinglePiece(binary, {
    minKeepArea: 28,
    bridgeRadius: Math.max(3, Math.round(Math.min(binary.width, binary.height) / 180)),
  });
  if (components !== 1) {
    throw new Error(`Design is not a single piece (components=${components})`);
  }
  if (rings?.length) {
    for (const ring of rings) {
      punchDisk(binary, ring.x, ring.y, Math.max(4, ring.inner * 0.92));
    }
  }
  binary = cropToContent(binary, 36);

  const png = await binaryToPng(binary);
  const check = await pngToBinary(png, 128);
  if (countComponents(check) !== 1) {
    throw new Error("PNG failed connectivity verification");
  }
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (hasGrayPixels(data)) {
    throw new Error("PNG still contains gray pixels");
  }

  const svg = await traceToSvg(png);
  return { png, svg, components: 1, source };
}

function countBlackSafe(image: BinaryImage): number {
  let n = 0;
  for (const v of image.data) if (v) n++;
  return n;
}

export async function processSvgComposition(
  svg: string,
  rings: RingSpec[] = [],
  sourceWidth?: number,
): Promise<ProcessedDesign> {
  const targetWidth = 2000;
  const png = rasterizeSvg(svg, targetWidth);
  const scale = sourceWidth ? targetWidth / sourceWidth : 1;
  const scaled = rings.map((ring) => ({
    x: ring.x * scale,
    y: ring.y * scale,
    inner: ring.inner * scale,
  }));
  return processRaster(png, "deterministic", scaled);
}
