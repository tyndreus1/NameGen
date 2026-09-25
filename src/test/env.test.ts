import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_XAI_IMAGE_MODEL,
  DEFAULT_XAI_TEXT_MODEL,
  getXaiImageModel,
  getXaiTextModel,
} from "@/lib/env";

describe("xAI model env", () => {
  const previousImage = process.env.XAI_IMAGE_MODEL;
  const previousText = process.env.XAI_TEXT_MODEL;

  afterEach(() => {
    if (previousImage === undefined) delete process.env.XAI_IMAGE_MODEL;
    else process.env.XAI_IMAGE_MODEL = previousImage;
    if (previousText === undefined) delete process.env.XAI_TEXT_MODEL;
    else process.env.XAI_TEXT_MODEL = previousText;
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
});
