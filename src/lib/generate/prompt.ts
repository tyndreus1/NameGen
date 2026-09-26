import type { StyleId } from "../constants";
import { DEFAULT_RING_POLICY, ringInstruction, type RingPolicy } from "./ring-policy";

/** Shared technical base. Editable in admin Settings — not a hidden style. */
export const DEFAULT_BASE_PROMPT =
  "Laser-cut metal name jewelry design, flat vector silhouette, pure solid black on a plain white background, no shading, no gradients, no texture, no 3D, no chain. Every letter joined to the next so the whole design is ONE single connected solid black piece. Centered composition, generous white margin. No other text, no floating pieces.";

export const TECHNICAL_RULES = [
  "Saf siyah-beyaz: gri piksel kabul edilmez.",
  "Tek bağlı parça: yüzen / kopuk parçalar reddedilir.",
  "Halka kontrolü yalnızca kategori ‘halkayı zorla’ açıksa çalışır; sayı ve konum o kategorinin ayarına göre değişir.",
] as const;

export type PromptInput = {
  name: string;
  ornament: string;
  basePrompt: string;
  ring: RingPolicy;
  hasReferences: boolean;
};

export const STYLE_ORNAMENTS: Record<StyleId, string> = {
  classic: "No hearts, no stars, no butterflies - only letters and flourishes.",
  hearts:
    "Weave small solid hearts into the design: one heart in the left flourish and one heart hanging at the center of the underline swash, all fused to the piece.",
  star: "Add one small solid four-pointed star fused into the right-side flourish, touching the swash, plus no floating pieces.",
  butterfly:
    "Add one small solid butterfly silhouette perched on the top right of the name, touching and fused to the last letter, plus a small heart at the center of the underline swash.",
  elegant:
    "Keep the design elegant and minimal: only letters and curly flourishes. No hearts, no stars, no butterflies.",
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
  return ` Letters, in order: ${letters}. IMPORTANT Turkish letters: ${hints.join(" ")}`;
}

export function ornamentForStyle(style: string): string {
  if (style in STYLE_ORNAMENTS) return STYLE_ORNAMENTS[style as StyleId];
  return style;
}

function collapse(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildGenerationPrompt(input: PromptInput): string {
  const spelled = letterSpelling(input.name);
  const turkish = turkishLetterInstructions(input.name);
  const base = input.basePrompt.trim() || DEFAULT_BASE_PROMPT;
  const lead = input.hasReferences
    ? `The reference images show the target style. Create a NEW design in exactly this style for the name "${input.name}".`
    : `Create a NEW design for the name "${input.name}".`;

  return collapse([
    base,
    `${lead} The text must read exactly "${input.name}" (${spelled}) and nothing else.${turkish}`,
    ringInstruction(input.ring),
    input.ornament,
  ]);
}

export function previewGenerationPrompt(input: PromptInput): string {
  return buildGenerationPrompt(input);
}

export function promptInputFrom(
  name: string,
  ornament: string,
  options?: Partial<PromptInput>,
): PromptInput {
  return {
    name,
    ornament,
    basePrompt: options?.basePrompt ?? DEFAULT_BASE_PROMPT,
    ring: options?.ring ?? DEFAULT_RING_POLICY,
    hasReferences: options?.hasReferences ?? true,
  };
}
