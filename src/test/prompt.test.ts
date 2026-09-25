import { describe, expect, it } from "vitest";
import {
  buildEditPrompt,
  buildGenerationPrompt,
  buildTextOnlyPrompt,
  letterSpelling,
  loadStyleDescription,
  ornamentForStyle,
  turkishLetterInstructions,
} from "@/lib/generate/prompt";

describe("Grok edit prompt", () => {
  it("spells the name letter by letter", () => {
    expect(letterSpelling("Merve")).toBe("M-e-r-v-e");
    expect(letterSpelling("Şükrü")).toBe("Ş-ü-k-r-ü");
  });

  it("uses the live-tested template for Latin names", () => {
    const prompt = buildEditPrompt("Merve", "classic");
    expect(prompt).toContain('The reference images show a laser-cut name necklace pendant style.');
    expect(prompt).toContain('Create a NEW pendant in exactly this style for the name "Merve".');
    expect(prompt).toContain('The text must read exactly "Merve" (M-e-r-v-e) and nothing else.');
    expect(prompt).toContain("ONE single connected solid black piece");
    expect(prompt).toContain("far left end and the far right end");
    expect(prompt).toContain("Pure solid black silhouette");
    expect(prompt).not.toContain("IMPORTANT Turkish letters");
    expect(prompt).toContain(ornamentForStyle("classic"));
    expect(prompt).toContain("No hearts, no stars, no butterflies");
  });

  it("appends fused-dot / cedilla instructions for Turkish letters", () => {
    const extra = turkishLetterInstructions("Şükrü");
    expect(extra).toContain("Letters, in order: Ş, ü, k, r, ü.");
    expect(extra).toContain("IMPORTANT Turkish letters");
    expect(extra).toContain("capital Ş");
    expect(extra).toContain("cedilla");
    expect(extra).toContain("two round dots");
    expect(extra).toContain("Exactly two rings.");

    const prompt = buildEditPrompt("Şükrü", "hearts");
    expect(prompt).toContain('The text must read exactly "Şükrü" (Ş-ü-k-r-ü)');
    expect(prompt).toContain(extra.trim());
  });

  it("covers ç ş ğ ı İ ö ü in both cases", () => {
    const sample = "ÇçŞşĞğIıİiÖöÜü";
    const extra = turkishLetterInstructions(sample);
    for (const ch of [...sample]) {
      expect(extra).toContain(ch);
    }
  });

  it("has style-specific ornaments including star and zarif", () => {
    expect(ornamentForStyle("hearts")).toMatch(/heart/i);
    expect(ornamentForStyle("butterfly")).toMatch(/butterfly/i);
    expect(ornamentForStyle("star")).toMatch(/star/i);
    expect(ornamentForStyle("elegant")).toMatch(/minimal|elegant/i);
    expect(buildEditPrompt("Zeynep", "butterfly")).toContain("butterfly");
    expect(buildEditPrompt("Zeynep", "star")).toContain("star");
    expect(buildEditPrompt("Zeynep", "elegant")).toContain("No hearts, no stars, no butterflies");
  });

  it("loads the editable style-description file for text-only generations", () => {
    const description = loadStyleDescription();
    expect(description.length).toBeGreaterThan(40);
    expect(description).toMatch(/laser-cut/i);
    const textOnly = buildTextOnlyPrompt("Merve", "classic");
    expect(textOnly).toContain(description.slice(0, 40));
    expect(textOnly).toContain('The text must read exactly "Merve" (M-e-r-v-e)');
    expect(buildGenerationPrompt("Merve", "classic", 0)).toBe(textOnly);
    expect(buildGenerationPrompt("Merve", "classic", 1)).toBe(buildEditPrompt("Merve", "classic"));
  });
});
