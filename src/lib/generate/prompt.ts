import fs from "node:fs";
import path from "node:path";
import type { StyleId } from "../constants";

const FALLBACK_STYLE_DESCRIPTION =
  "Laser-cut metal name necklace pendant design, flat vector silhouette, pure solid black on a plain white background, no shading, no gradients, no texture, no 3D, no chain. Bold, thick, flowing retro brush script with every letter joined to the next so the whole design is ONE single connected solid black piece. A long elegant swash flows from the letter tails underneath the entire name and ties back into the first letter. A small round open ring (circle with a hole) at the far left end and the far right end for attaching a chain, joined by curly flourishes. Centered horizontal composition, wide banner format, generous white margin. No other text, no floating pieces.";

export function styleDescriptionPath(): string {
  return path.join(process.cwd(), "prompts", "style-description.md");
}

export function loadStyleDescription(): string {
  try {
    const raw = fs.readFileSync(styleDescriptionPath(), "utf8");
    return raw
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return FALLBACK_STYLE_DESCRIPTION;
  }
}

export const STYLE_ORNAMENTS: Record<StyleId, string> = {
  classic:
    "No hearts, no stars, no butterflies - only letters, swash, flourishes and the two end rings.",
  hearts:
    "Weave small solid hearts into the design: one heart in the left flourish and one heart hanging at the center of the underline swash, all fused to the piece.",
  star:
    "Add one small solid four-pointed star fused into the right-side flourish, touching the swash, plus no floating pieces.",
  butterfly:
    "Add one small solid butterfly silhouette perched on the top right of the name, touching and fused to the last letter, plus a small heart at the center of the underline swash.",
  elegant:
    "Keep the design elegant and minimal: only letters, a clean swash, curly flourishes and the two end rings. No hearts, no stars, no butterflies.",
};

const TURKISH_HINT: Record<string, string> = {
  ç: "ç is a script c with a small cedilla hook (like a tiny comma) hanging DIRECTLY from the bottom of the c and touching it.",
  Ç: "Ç is a capital script C with a small cedilla hook hanging DIRECTLY from the bottom of the C and touching it.",
  ş: "ş is a script s with a small cedilla hook (like a tiny comma) hanging DIRECTLY from the bottom of the s and touching it.",
  Ş: "the first/this letter is a capital Ş - a script S with a small cedilla hook (like a tiny comma) hanging DIRECTLY from the bottom of the S and touching it.",
  ğ: "ğ is a script g with a breve (small curve) fused to the top of the g; do not leave it floating.",
  Ğ: "Ğ is a capital G with a breve fused to the top of the letter.",
  ı: "ı is a Turkish undotted i - a plain stem with NO dot above it.",
  I: "I (Turkish capital ı) is a capital I without a dot.",
  İ: "İ is a Turkish capital I with a dot fused to the top of the letter (no floating dot).",
  i: "i has a dot that must be fused to the letter with a short stem (no floating dot).",
  ö: "ö has two round dots above it; make the two dots overlap and touch the top of the o so they are fused to the letter (no floating dots).",
  Ö: "Ö has two round dots fused to the top of the O (no floating dots).",
  ü: "ü has two round dots above it; make the two dots overlap and touch the top of the u so they are fused to the letter (no floating dots).",
  Ü: "Ü has two round dots fused to the top of the U (no floating dots).",
};

export function letterSpelling(name: string): string {
  return [...name].join("-");
}

export function turkishLetterInstructions(name: string): string {
  const seen = new Set<string>();
  const hints: string[] = [];
  for (const ch of name) {
    if (seen.has(ch)) continue;
    const hint = TURKISH_HINT[ch];
    if (hint) {
      seen.add(ch);
      hints.push(hint);
    }
  }
  if (!hints.length) return "";
  const letters = [...name].join(", ");
  return ` Letters, in order: ${letters}. IMPORTANT Turkish letters: ${hints.join(" ")} Exactly two rings.`;
}

export function ornamentForStyle(style: string): string {
  if (style in STYLE_ORNAMENTS) return STYLE_ORNAMENTS[style as StyleId];
  return style;
}

export function buildTextOnlyPrompt(name: string, styleOrOrnament: string): string {
  const spelled = letterSpelling(name);
  const turkish = turkishLetterInstructions(name);
  return [
    loadStyleDescription(),
    `Create a NEW pendant in exactly this style for the name "${name}". The text must read exactly "${name}" (${spelled}) and nothing else.${turkish}`,
    ornamentForStyle(styleOrOrnament),
    `Pure solid black silhouette on a plain white background, flat, no shading, no gradient, no outline, no texture, no 3D, no chain, no other text.`,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildGenerationPrompt(name: string, styleOrOrnament: string, refCount: number): string {
  return refCount <= 0 ? buildTextOnlyPrompt(name, styleOrOrnament) : buildEditPrompt(name, styleOrOrnament);
}

export function buildEditPrompt(name: string, styleOrOrnament: string): string {
  const spelled = letterSpelling(name);
  const turkish = turkishLetterInstructions(name);

  return [
    `The reference images show a laser-cut name necklace pendant style.`,
    `Create a NEW pendant in exactly this style for the name "${name}". The text must read exactly "${name}" (${spelled}) and nothing else.${turkish}`,
    `Same bold, thick, flowing retro script; every letter joined to the next so the whole design is ONE single connected solid black piece.`,
    `A long swash flows from the letter tails underneath the entire name and ties back into the first letter.`,
    `A small round open ring (circle with a hole) at the far left end and the far right end for attaching a chain, joined by curly flourishes.`,
    ornamentForStyle(styleOrOrnament),
    `Pure solid black silhouette on a plain white background, flat, no shading, no gradient, no outline, no texture, no 3D, no chain, no other text.`,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
