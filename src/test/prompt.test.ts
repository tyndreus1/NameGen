import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_PROMPT,
  STYLE_ORNAMENTS,
  buildGenerationPrompt,
  letterSpelling,
  ornamentForStyle,
  previewGenerationPrompt,
  turkishLetterInstructions,
} from "@/lib/generate/prompt";
import { DEFAULT_RING_POLICY, ringInstruction, ringPolicyFrom } from "@/lib/generate/ring-policy";

const twoRing = DEFAULT_RING_POLICY;
const oneLeft = ringPolicyFrom({ ringCount: "one", ringPosition: "left", enforceRings: true });

describe("Grok prompt (admin-controlled)", () => {
  it("spells the name letter by letter", () => {
    expect(letterSpelling("Merve")).toBe("M-e-r-v-e");
    expect(letterSpelling("Şükrü")).toBe("Ş-ü-k-r-ü");
  });

  it("does not bake two-ring or bold-script rules into Turkish letter hints", () => {
    const extra = turkishLetterInstructions("Şükrü");
    expect(extra).toContain("Letters, in order: Ş, ü, k, r, ü.");
    expect(extra).toContain("IMPORTANT Turkish letters");
    expect(extra).toContain("capital Ş");
    expect(extra).toContain("cedilla");
    expect(extra).toContain("two round dots");
    expect(extra).not.toMatch(/exactly two rings/i);
    expect(extra).not.toMatch(/far left end and the far right end/i);
  });

  it("covers ç ş ğ ı İ ö ü in both cases", () => {
    const sample = "ÇçŞşĞğIıİiÖöÜü";
    const extra = turkishLetterInstructions(sample);
    for (const ch of [...sample]) {
      expect(extra).toContain(ch);
    }
  });

  it("uses the shared base prompt plus category ornament for a two-ring style", () => {
    const prompt = buildGenerationPrompt({
      name: "Merve",
      ornament: ornamentForStyle("classic"),
      basePrompt: DEFAULT_BASE_PROMPT,
      ring: twoRing,
      hasReferences: true,
    });
    expect(prompt).toContain(DEFAULT_BASE_PROMPT.slice(0, 40));
    expect(prompt).toContain('Create a NEW design in exactly this style for the name "Merve".');
    expect(prompt).toContain('The text must read exactly "Merve" (M-e-r-v-e) and nothing else.');
    expect(prompt).toContain("far left end and the far right end");
    expect(prompt).toContain(ornamentForStyle("classic"));
    expect(prompt).not.toMatch(/bold, thick, flowing retro/i);
    expect(prompt).not.toMatch(/exactly two rings/i);
  });

  it("a one-ring category prompt contains no two-ring text", () => {
    const prompt = buildGenerationPrompt({
      name: "Christopher",
      ornament: "Vertical handwriting with one loop. Thin letters. Fancy first letter.",
      basePrompt: DEFAULT_BASE_PROMPT,
      ring: oneLeft,
      hasReferences: true,
    });
    expect(prompt).toContain("exactly one small round open ring");
    expect(prompt).toContain("far left end");
    expect(prompt).toContain("Do not add a second ring");
    expect(prompt).not.toMatch(/far left end and the far right end/i);
    expect(prompt).not.toMatch(/exactly two rings/i);
    expect(prompt).not.toMatch(/two end rings/i);
    expect(prompt).not.toMatch(/bold, thick, flowing retro/i);
    expect(ringInstruction(oneLeft)).not.toMatch(/and the far right end/i);
  });

  it("seed ornaments no longer mention two end rings", () => {
    expect(STYLE_ORNAMENTS.classic).not.toMatch(/two end rings/i);
    expect(STYLE_ORNAMENTS.elegant).not.toMatch(/two end rings/i);
  });

  it("final prompt preview matches the text that is sent", () => {
    const input = {
      name: "Christopher",
      ornament: "Vertical handwriting with one loop.",
      basePrompt: DEFAULT_BASE_PROMPT,
      ring: oneLeft,
      hasReferences: true,
    };
    expect(previewGenerationPrompt(input)).toBe(buildGenerationPrompt(input));
  });
});
