export const GENERATION_COST = 3;
export const STARTING_CREDITS = 60;
export const CODE_VALUES = [60, 120, 240] as const;
export type CodeValue = (typeof CODE_VALUES)[number];

export const STYLES = [
  "classic",
  "hearts",
  "star",
  "butterfly",
  "elegant",
] as const;
export type StyleId = (typeof STYLES)[number];

export const STYLE_LABELS: Record<StyleId, string> = {
  classic: "Klasik script",
  hearts: "Kalpli",
  star: "Yıldızlı",
  butterfly: "Kelebekli",
  elegant: "Zarif / Minimal",
};

export const VARIATION_COUNT = 4;
export const MAX_NAME_LENGTH = 18;

export function fontStyleForSlug(slug: string): StyleId {
  return (STYLES as readonly string[]).includes(slug) ? (slug as StyleId) : "classic";
}
