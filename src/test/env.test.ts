import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_XAI_IMAGE_MODEL,
  DEFAULT_XAI_TEXT_MODEL,
  getXaiBatches,
  getXaiImageModel,
  getXaiMaxRetries,
  getXaiNPerBatch,
  getXaiQuality,
  getXaiRefCount,
  getXaiResolution,
  getXaiTextModel,
} from "@/lib/env";

describe("xAI model env", () => {
  const previousImage = process.env.XAI_IMAGE_MODEL;
  const previousText = process.env.XAI_TEXT_MODEL;
  const previousRefs = process.env.XAI_REF_COUNT;
  const previousRes = process.env.XAI_RESOLUTION;
  const previousRetries = process.env.XAI_MAX_RETRIES;
  const previousQuality = process.env.XAI_QUALITY;
  const previousBatches = process.env.XAI_BATCHES;
  const previousNPer = process.env.XAI_N_PER_BATCH;

  afterEach(() => {
    if (previousImage === undefined) delete process.env.XAI_IMAGE_MODEL;
    else process.env.XAI_IMAGE_MODEL = previousImage;
    if (previousText === undefined) delete process.env.XAI_TEXT_MODEL;
    else process.env.XAI_TEXT_MODEL = previousText;
    if (previousRefs === undefined) delete process.env.XAI_REF_COUNT;
    else process.env.XAI_REF_COUNT = previousRefs;
    if (previousRes === undefined) delete process.env.XAI_RESOLUTION;
    else process.env.XAI_RESOLUTION = previousRes;
    if (previousRetries === undefined) delete process.env.XAI_MAX_RETRIES;
    else process.env.XAI_MAX_RETRIES = previousRetries;
    if (previousQuality === undefined) delete process.env.XAI_QUALITY;
    else process.env.XAI_QUALITY = previousQuality;
    if (previousBatches === undefined) delete process.env.XAI_BATCHES;
    else process.env.XAI_BATCHES = previousBatches;
    if (previousNPer === undefined) delete process.env.XAI_N_PER_BATCH;
    else process.env.XAI_N_PER_BATCH = previousNPer;
  });

  it("defaults to grok-imagine-image-2.0", () => {
    delete process.env.XAI_IMAGE_MODEL;
    expect(getXaiImageModel()).toBe("grok-imagine-image-2.0");
    expect(DEFAULT_XAI_IMAGE_MODEL).toBe("grok-imagine-image-2.0");
  });

  it("uses the env override when set", () => {
    process.env.XAI_IMAGE_MODEL = "grok-imagine-image-quality";
    expect(getXaiImageModel()).toBe("grok-imagine-image-quality");
  });

  it("defaults the vision/text model to grok-4.6", () => {
    delete process.env.XAI_TEXT_MODEL;
    expect(getXaiTextModel()).toBe("grok-4.6");
    expect(DEFAULT_XAI_TEXT_MODEL).toBe("grok-4.6");
  });

  it("defaults to 1 reference, 1k, low quality, 2x n=2 batches, 2 retries", () => {
    delete process.env.XAI_REF_COUNT;
    delete process.env.XAI_RESOLUTION;
    delete process.env.XAI_MAX_RETRIES;
    delete process.env.XAI_QUALITY;
    delete process.env.XAI_BATCHES;
    delete process.env.XAI_N_PER_BATCH;
    expect(getXaiRefCount()).toBe(1);
    expect(getXaiResolution()).toBe("1k");
    expect(getXaiMaxRetries()).toBe(2);
    expect(getXaiQuality()).toBe("low");
    expect(getXaiBatches()).toBe(2);
    expect(getXaiNPerBatch()).toBe(2);
  });

  it("parses ref count, resolution, and retries from env", () => {
    process.env.XAI_REF_COUNT = "0";
    process.env.XAI_RESOLUTION = "2k";
    process.env.XAI_MAX_RETRIES = "1";
    expect(getXaiRefCount()).toBe(0);
    expect(getXaiResolution()).toBe("2k");
    expect(getXaiMaxRetries()).toBe(1);
    process.env.XAI_REF_COUNT = "2";
    expect(getXaiRefCount()).toBe(2);
  });
});
