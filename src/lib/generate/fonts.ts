import fs from "node:fs";
import path from "node:path";
import opentype, { type Font } from "opentype.js";

export type LoadedFont = {
  id: string;
  family: string;
  font: Font;
};

const FONT_FILES: { id: string; family: string; file: string }[] = [
  { id: "great-vibes", family: "Great Vibes", file: "GreatVibes-Regular.ttf" },
  { id: "sacramento", family: "Sacramento", file: "Sacramento-Regular.ttf" },
  { id: "italianno", family: "Italianno", file: "Italianno-Regular.ttf" },
  { id: "parisienne", family: "Parisienne", file: "Parisienne-Regular.ttf" },
  { id: "alex-brush", family: "Alex Brush", file: "AlexBrush-Regular.ttf" },
  { id: "dancing", family: "Dancing Script", file: "DancingScript-Bold.ttf" },
  { id: "allura", family: "Allura", file: "Allura-Regular.ttf" },
  { id: "tangerine", family: "Tangerine", file: "Tangerine-Bold.ttf" },
];

let cache: LoadedFont[] | null = null;

function fontsDir(): string {
  return path.join(process.cwd(), "fonts");
}

function parseFont(filePath: string): Font {
  const buf = fs.readFileSync(filePath);
  return opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}

export function loadFonts(): LoadedFont[] {
  if (cache) return cache;
  const dir = fontsDir();
  cache = FONT_FILES.map((entry) => {
    const filePath = path.join(dir, entry.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing bundled font: ${entry.file}`);
    }
    return { id: entry.id, family: entry.family, font: parseFont(filePath) };
  });
  return cache;
}

export function glyphMissing(font: Font, ch: string): boolean {
  const glyph = font.charToGlyph(ch);
  if (!glyph) return true;
  if (glyph.name === ".notdef") return true;
  if (glyph.unicode === undefined && (!glyph.unicodes || glyph.unicodes.length === 0)) {
    return true;
  }
  const path = glyph.getPath(0, 0, 100);
  return path.commands.length === 0;
}

export function fontSupportsText(font: Font, text: string): boolean {
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    if (glyphMissing(font, ch)) return false;
  }
  return true;
}

export function pickFontsForName(name: string): LoadedFont[] {
  const fonts = loadFonts();
  const supported = fonts.filter((f) => fontSupportsText(f.font, name));
  if (supported.length === 0) {
    throw new Error(
      "Bu isimdeki bazı karakterler yüklü script fontlarında yok. İsmi kontrol edin.",
    );
  }
  return supported;
}

export function measureText(
  font: Font,
  text: string,
  fontSize: number,
  tracking = 1,
): { width: number; height: number; ascender: number; descender: number } {
  let width = 0;
  for (const ch of text) {
    width += font.getAdvanceWidth(ch, fontSize) * tracking;
  }
  const scale = fontSize / font.unitsPerEm;
  return {
    width,
    height: (font.ascender - font.descender) * scale,
    ascender: font.ascender * scale,
    descender: font.descender * scale,
  };
}

export function textToPathData(
  font: Font,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  tracking = 1,
): string {
  let cursor = x;
  const parts: string[] = [];
  for (const ch of text) {
    const glyphPath = font.getPath(ch, cursor, y, fontSize);
    const d = glyphPath.toPathData(2);
    if (d) parts.push(d);
    cursor += font.getAdvanceWidth(ch, fontSize) * tracking;
  }
  return parts.join(" ");
}
