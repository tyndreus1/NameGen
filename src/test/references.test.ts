import { describe, expect, it } from "vitest";
import { pickReferenceIds, isSameNameAsReference, REFERENCE_CATALOG } from "@/lib/generate/references";

describe("reference picking", () => {
  it("never includes a reference with the same name as the target", () => {
    expect(pickReferenceIds("Merve", "classic")).not.toContain("merve");
    expect(pickReferenceIds("Zeynep", "hearts")).not.toContain("zeynep");
    expect(pickReferenceIds("Aleyna", "star")).not.toContain("aleyna");
    expect(pickReferenceIds("Charlotte", "elegant")).not.toContain("charlotte");
    expect(pickReferenceIds("Sophia", "butterfly")).not.toContain("sophia");
    expect(pickReferenceIds("Sophiaa", "butterfly")).not.toContain("sophia");
  });

  it("sends two style-appropriate refs and forces Sophia for butterfly", () => {
    expect(pickReferenceIds("Merve", "classic")).toEqual(["charlotte", "zeynep"]);
    expect(pickReferenceIds("Merve", "hearts")).toEqual(["aleyna", "zeynep"]);
    expect(pickReferenceIds("Merve", "butterfly")).toEqual(["sophia", "aleyna"]);
    expect(pickReferenceIds("Elif", "star").length).toBe(2);
    expect(pickReferenceIds("Elif", "elegant").length).toBe(2);
  });

  it("matches reference names case-insensitively in Turkish locale", () => {
    const merve = REFERENCE_CATALOG.find((ref) => ref.id === "merve")!;
    expect(isSameNameAsReference("MERVE", merve)).toBe(true);
    expect(isSameNameAsReference("merve", merve)).toBe(true);
    expect(isSameNameAsReference("Zeynep", merve)).toBe(false);
  });
});
