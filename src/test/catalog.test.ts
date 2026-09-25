import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ensureCatalog, slugify } from "@/lib/catalog/seed";
import { loadCategoryRefs } from "@/lib/catalog/refs";
import { cleanReferenceUpload } from "@/lib/catalog/storage";
import { saveGenerationSettings } from "@/lib/catalog/settings";
import { generateDesigns } from "@/lib/generate/pipeline";
import type { GenerateImagesArgs, XaiClient } from "@/lib/generate/xai-client";
import { fakePendantPng } from "./helpers/pendant";
import { blank, fillRect } from "./helpers/pendant";
import { binaryToPng } from "@/lib/generate/postprocess";

function mockClient(capture: { prompts: string[]; refs: string[][] }): XaiClient {
  return {
    async generateImages(args: GenerateImagesArgs) {
      capture.prompts.push(args.prompt);
      capture.refs.push(args.references.map((ref) => ref.dataUrl));
      return {
        images: [{ buffer: await fakePendantPng() }],
        cost: 0,
        costTicks: 0,
        model: args.model ?? "grok-imagine-image-2.0",
        endpoint: args.references.length ? "edits" : "generations",
      };
    },
    async transcribeName() {
      return { text: "Merve", cost: 0, costTicks: 0 };
    },
  };
}

describe("admin catalog", () => {
  beforeEach(async () => {
    await prisma.categoryReference.deleteMany();
    await prisma.styleReference.deleteMany();
    await prisma.category.deleteMany();
    await prisma.appSettings.deleteMany();
    await ensureCatalog();
  });

  afterEach(async () => {
    await prisma.appSettings.deleteMany();
  });

  it("seeds the five styles and bundled references", async () => {
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    expect(categories.map((row) => row.slug)).toEqual([
      "classic",
      "hearts",
      "star",
      "butterfly",
      "elegant",
    ]);
    expect(categories[0]!.label).toContain("Klasik");
    const refs = await prisma.styleReference.findMany();
    expect(refs.length).toBe(5);
    expect(refs.some((row) => row.writtenName === "merve")).toBe(true);
  });

  it("supports category create, edit, reorder, disable, and delete", async () => {
    const created = await prisma.category.create({
      data: {
        slug: slugify("Çiçekli"),
        label: "Çiçekli",
        promptText: "Add one small flower fused to the last letter.",
        sortOrder: 10,
      },
    });
    expect(created.slug).toMatch(/cicekli|içekli|icekli/i);

    const updated = await prisma.category.update({
      where: { id: created.id },
      data: { enabled: false, label: "Çiçek" },
    });
    expect(updated.enabled).toBe(false);

    const ids = (await prisma.category.findMany({ orderBy: { sortOrder: "asc" } })).map((row) => row.id);
    await prisma.$transaction(
      ids
        .slice()
        .reverse()
        .map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: index } })),
    );
    const reordered = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    expect(reordered.at(-1)?.id).not.toBe(created.id);

    await prisma.category.delete({ where: { id: created.id } });
    expect(await prisma.category.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("cleans uploads to B/W and warns when the reference is not one piece", async () => {
    const good = await cleanReferenceUpload(await fakePendantPng());
    expect(good.onePiece).toBe(true);
    expect(good.warning).toBeNull();

    const image = blank(80, 40);
    fillRect(image, 4, 8, 20, 16);
    fillRect(image, 50, 8, 20, 16);
    const bad = await cleanReferenceUpload(await binaryToPng(image));
    expect(bad.onePiece).toBe(false);
    expect(bad.warning).toMatch(/tek parça/i);
  });

  it("assigns a reference to a category and only that pool is used", async () => {
    const hearts = await prisma.category.findUniqueOrThrow({ where: { slug: "hearts" } });
    const bare = await prisma.category.create({
      data: {
        slug: "assigned-only",
        label: "Atanmış",
        description: "Tek referanslı deneme",
        promptText: "Assigned-only ornament.",
        sortOrder: 30,
      },
    });
    const charlotte = await prisma.styleReference.findFirstOrThrow({
      where: { writtenName: "charlotte" },
    });
    await prisma.categoryReference.create({
      data: { categoryId: bare.id, referenceId: charlotte.id },
    });

    const assigned = await loadCategoryRefs("Merve", "assigned-only", 4);
    expect(assigned.map((ref) => ref.writtenName)).toEqual(["charlotte"]);

    const heartsPool = await loadCategoryRefs("Merve", hearts.slug, 4);
    expect(heartsPool.some((ref) => ref.id === charlotte.id)).toBe(true);
    expect(heartsPool.length).toBeGreaterThan(1);
  });

  it("picks category refs and excludes the same written name", async () => {
    const merveClassic = await loadCategoryRefs("Merve", "classic", 4);
    expect(merveClassic.length).toBeGreaterThan(0);
    expect(merveClassic.every((ref) => ref.writtenName !== "merve")).toBe(true);

    const zeynep = await loadCategoryRefs("Zeynep", "hearts", 4);
    expect(zeynep.every((ref) => ref.writtenName !== "zeynep")).toBe(true);
  });

  it("uses the category prompt and falls back to text-only when the category has no refs", async () => {
    const empty = await prisma.category.create({
      data: {
        slug: "bare",
        label: "Bare",
        promptText: "UNIQUE_ORNAMENT_TOKEN_NO_REFS",
        sortOrder: 20,
      },
    });
    expect(empty.slug).toBe("bare");
    const capture = { prompts: [] as string[], refs: [] as string[][] };
    await generateDesigns("Merve", "bare", 1, mockClient(capture));
    expect(capture.prompts[0]).toContain("UNIQUE_ORNAMENT_TOKEN_NO_REFS");
    expect(capture.refs[0]).toEqual([]);

    const hearts = { prompts: [] as string[], refs: [] as string[][] };
    await generateDesigns("Merve", "hearts", 1, mockClient(hearts));
    expect(hearts.prompts[0]).toMatch(/heart/i);
    expect(hearts.refs[0]!.length).toBe(1);
  }, 40000);

  it("saves live generation settings over env defaults", async () => {
    const saved = await saveGenerationSettings({
      imageModel: "grok-imagine-image-quality",
      quality: "medium",
      refCount: 2,
      batches: 1,
      nPerBatch: 4,
      resolution: "2k",
      maxRetries: 1,
    });
    expect(saved.imageModel).toBe("grok-imagine-image-quality");
    expect(saved.quality).toBe("medium");
    expect(saved.refCount).toBe(2);
    expect(saved.nPerBatch).toBe(4);
    expect(saved.resolution).toBe("2k");
  });
});
