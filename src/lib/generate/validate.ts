import sharp from "sharp";
import { countBlackPixels, cropToContent, hasGrayPixels, repairSmallIslandsAsync } from "./connectivity";
import { hasEndRings } from "./rings";
import { binaryToPng, cleanTracedSvg, pngToBinary } from "./postprocess";
import { traceToSvgOffThread, yieldEventLoop } from "./offload";
import type { XaiClient } from "./xai-client";

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

async function traceToSvg(png: Buffer): Promise<string> {
  return cleanTracedSvg(await traceToSvgOffThread(png));
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

  const repair = await repairSmallIslandsAsync(binary);
  await yieldEventLoop();
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
