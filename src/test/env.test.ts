import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_XAI_IMAGE_MODEL, getXaiImageModel } from "@/lib/env";

describe("XAI_IMAGE_MODEL", () => {
  const previous = process.env.XAI_IMAGE_MODEL;

  afterEach(() => {
    if (previous === undefined) delete process.env.XAI_IMAGE_MODEL;
    else process.env.XAI_IMAGE_MODEL = previous;
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
});
