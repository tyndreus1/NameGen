import { describe, expect, it } from "vitest";
import {
  pickReferenceIds,
  isSameNameAsReference,
  REFERENCE_CATALOG,
  referencesForBatch,
} from "@/lib/generate/references";

describe("reference picking", () => {
  it("never includes a reference with the same name as the target", () => {
    expect(pickReferenceIds("Merve", "classic")).not.toContain("merve");
    expect(pickReferenceIds("Zeynep", "hearts")).not.toContain("zeynep");
    expect(pickReferenceIds("Aleyna", "star")).not.toContain("aleyna");
    expect(pickReferenceIds("Charlotte", "elegant")).not.toContain("charlotte");
    expect(pickReferenceIds("Sophia", "butterfly")).not.toContain("sophia");
    expect(pickReferenceIds("Sophiaa", "butterfly")).not.toContain("sophia");
  });

  it("sends style-appropriate refs and forces Sophia for butterfly", () => {
    expect(pickReferenceIds("Merve", "classic", 2)).toEqual(["charlotte", "zeynep"]);
    expect(pickReferenceIds("Merve", "classic", 1)).toEqual(["charlotte"]);
    expect(pickReferenceIds("Merve", "hearts", 1)).toEqual(["aleyna"]);
    expect(pickReferenceIds("Merve", "butterfly", 1)).toEqual(["sophia"]);
    expect(pickReferenceIds("Merve", "butterfly", 2)).toEqual(["sophia", "aleyna"]);
    expect(pickReferenceIds("Elif", "star", 2).length).toBe(2);
  });

  it("matches reference names case-insensitively in Turkish locale", () => {
    const merve = REFERENCE_CATALOG.find((ref) => ref.id === "merve")!;
    expect(isSameNameAsReference("MERVE", merve)).toBe(true);
    expect(isSameNameAsReference("merve", merve)).toBe(true);
    expect(isSameNameAsReference("Zeynep", merve)).toBe(false);
  });

  it("rotates a different single reference per batch", () => {
    const pool = ["charlotte", "zeynep"];
    expect(referencesForBatch(pool, 0, 1)).toEqual(["charlotte"]);
    expect(referencesForBatch(pool, 1, 1)).toEqual(["zeynep"]);
    expect(referencesForBatch(pool, 0, 0)).toEqual([]);
  });
});
