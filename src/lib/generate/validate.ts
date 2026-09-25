import sharp from "sharp";
import { countBlackPixels, cropToContent, hasGrayPixels, repairSmallIslands } from "./connectivity";
import { hasEndRings } from "./rings";
import { binaryToPng, cleanTracedSvg, pngToBinary } from "./postprocess";
import type { XaiClient } from "./xai-client";
import potrace from "potrace";

export type ValidationOk = {
  ok: true;
  png: Buffer;
  svg: string;
  transcribed?: string;
  visionCost: number;
  visionCostTicks: number;
};

export type ValidationFail = {
  ok: false;
  reason: string;
  visionCost: number;
  visionCostTicks: number;
};

export type ValidationResult = ValidationOk | ValidationFail;

function namesMatch(expected: string, actual: string): boolean {
  const a = expected.normalize("NFC").trim();
  const b = actual.normalize("NFC").trim().replace(/^["'`]+|["'`]+$/g, "");
  return a === b;
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

export async function validateGrokRaster(
  pngInput: Buffer,
  expectedName: string,
  client: XaiClient,
): Promise<ValidationResult> {
  let visionCost = 0;
  let visionCostTicks = 0;
  const binary = await pngToBinary(pngInput, 160);
  if (countBlackPixels(binary) < 80) {
    return { ok: false, reason: "empty after threshold", visionCost, visionCostTicks };
  }

  const speckArea = Math.max(16, Math.round((binary.width * binary.height) / 80000));
  const maxDotArea = Math.max(80, Math.round((binary.width * binary.height) / 8000));
  const repair = repairSmallIslands(binary, {
    speckArea,
    maxDotArea,
    maxDistance: Math.max(12, Math.round(Math.min(binary.width, binary.height) * 0.04)),
    bridgeRadius: Math.max(2, Math.round(Math.min(binary.width, binary.height) / 400)),
  });
  if (repair.rejected || repair.components !== 1) {
    return { ok: false, reason: `not one piece (components=${repair.components})`, visionCost, visionCostTicks };
  }

  const rings = hasEndRings(binary);
  if (!rings.ok) {
    return { ok: false, reason: "missing left/right end rings with holes", visionCost, visionCostTicks };
  }

  const cropped = cropToContent(binary, 40);
  const png = await binaryToPng(cropped);
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (hasGrayPixels(data)) {
    return { ok: false, reason: "gray pixels remain", visionCost, visionCostTicks };
  }

  const transcribed = await client.transcribeName(png);
  visionCost += transcribed.cost;
  visionCostTicks += transcribed.costTicks;
  if (!namesMatch(expectedName, transcribed.text)) {
    return {
      ok: false,
      reason: `spelling mismatch (got "${transcribed.text}")`,
      visionCost,
      visionCostTicks,
    };
  }

  const svg = await traceToSvg(png);
  return { ok: true, png, svg, transcribed: transcribed.text, visionCost, visionCostTicks };
}
