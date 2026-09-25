import type { StyleId } from "../constants";
import { pickFontsForName, measureText, textToPathData, type LoadedFont } from "./fonts";
import { butterflyPath, heartPath, ringPath, starPath, stemPath } from "./ornaments";

export type Variation = {
  index: number;
  fontId: string;
  tracking: number;
  swashAmp: number;
  swashDrop: number;
  ringOuter: number;
  stroke: number;
  leftHeart: boolean;
  danglingHeart: boolean;
  star: boolean;
  butterfly: boolean;
};

export type RingSpec = { x: number; y: number; outer: number; inner: number };

export type Composition = {
  svg: string;
  width: number;
  height: number;
  rings: RingSpec[];
};

export function buildVariations(name: string, style: StyleId, count: number): Variation[] {
  const fonts = pickFontsForName(name);
  const variations: Variation[] = [];
  for (let i = 0; i < count; i++) {
    const font = fonts[i % fonts.length]!;
    const base: Variation = {
      index: i,
      fontId: font.id,
      tracking: 0.86 + (i % 3) * 0.03,
      swashAmp: 36 + (i % 4) * 16,
      swashDrop: Math.round(fontSizeHint(name) * 0.1),
      ringOuter: 38 + (i % 3) * 3,
      stroke: 5.5 + (i % 3) * 0.8,
      leftHeart: false,
      danglingHeart: false,
      star: false,
      butterfly: false,
    };

    if (style === "hearts") {
      base.leftHeart = i !== 3;
      base.danglingHeart = true;
    } else if (style === "star") {
      base.star = true;
      base.danglingHeart = i === 2;
    } else if (style === "butterfly") {
      base.butterfly = true;
      base.danglingHeart = i % 2 === 1;
    } else if (style === "classic") {
      base.danglingHeart = i === 3;
    } else if (style === "elegant") {
      base.stroke = 4.8 + (i % 2) * 0.6;
      base.swashAmp = 18 + i * 8;
    }
    variations.push(base);
  }
  return variations;
}

function fontSizeHint(name: string): number {
  return Math.max(110, Math.min(230, 1400 / Math.max([...name].length, 3)));
}

function fontById(fonts: LoadedFont[], id: string): LoadedFont {
  return fonts.find((f) => f.id === id) ?? fonts[0]!;
}

export function composeNameSvg(name: string, style: StyleId, variation: Variation): Composition {
  const fonts = pickFontsForName(name);
  const loaded = fontById(fonts, variation.fontId);
  const font = loaded.font;

  const charCount = [...name].length;
  const fontSize = Math.max(110, Math.min(230, 1400 / Math.max(charCount, 3)));
  const metrics = measureText(font, name, fontSize, variation.tracking);

  const ringOuter = variation.ringOuter;
  const ringInner = ringOuter * 0.46;
  const gap = ringOuter + 28;
  const padX = 56;
  const padY = variation.butterfly ? 110 : 64;
  const textWidth = metrics.width;

  const textX = padX + ringOuter * 2 + gap;
  const baseline = padY + metrics.ascender * 0.95;
  const textY = baseline;

  const swashY = baseline + Math.max(10, fontSize * 0.1);
  const leftRing = { x: padX + ringOuter, y: swashY };
  const rightRing = {
    x: textX + textWidth + gap + ringOuter,
    y: swashY - variation.swashAmp * 0.15,
  };

  const width = Math.ceil(rightRing.x + ringOuter + padX);
  const ornamentBottom = variation.danglingHeart || variation.star ? 130 : 50;
  const height = Math.ceil(swashY + variation.swashAmp + ornamentBottom + 48);

  const c1x = textX + textWidth * 0.28;
  const c2x = textX + textWidth * 0.7;
  const c1y = swashY + variation.swashAmp;
  const c2y = swashY - variation.swashAmp * 0.25;

  const swashStartX = leftRing.x + ringOuter * 0.92;
  const swashEndX = rightRing.x - ringOuter * 0.92;
  const swash = `M ${swashStartX} ${leftRing.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${swashEndX} ${rightRing.y}`;

  const textPath = textToPathData(font, name, textX, textY, fontSize, variation.tracking);
  const extras: string[] = [];
  extras.push(ringPath(leftRing.x, leftRing.y, ringOuter, ringInner));
  extras.push(ringPath(rightRing.x, rightRing.y, ringOuter, ringInner));

  if (variation.leftHeart) {
    const hx = leftRing.x + ringOuter + 46;
    const hy = leftRing.y - 38;
    extras.push(heartPath(hx, hy, 52, true));
    extras.push(stemPath(swashStartX + 8, leftRing.y - 4, hx - 6, hy + 16, 12));
  }

  if (variation.danglingHeart) {
    const hx = textX + textWidth * 0.48;
    const attachY = swashY + variation.swashAmp * 0.25;
    const hy = attachY + 70;
    extras.push(heartPath(hx, hy, 44, true));
    extras.push(stemPath(hx, attachY, hx, hy - 26, 11));
  }

  if (variation.star) {
    const sx = textX + textWidth * 0.9;
    extras.push(starPath(sx, swashY + 48, 34));
    extras.push(stemPath(sx, swashY + 4, sx, swashY + 22, 10));
  }

  if (variation.butterfly) {
    const bx = textX + fontSize * 0.55;
    const by = textY - fontSize * 0.58;
    extras.push(butterflyPath(bx, by, 52));
  }

  const swashWidth = style === "elegant" ? 16 : 20;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g fill="#000000" fill-rule="evenodd" stroke="#000000" stroke-linejoin="round" stroke-linecap="round">
    <path d="${textPath}" stroke-width="${variation.stroke}"/>
    <path d="${swash}" fill="none" stroke-width="${swashWidth}"/>
    <g stroke="none">
      ${extras.map((d) => `<path d="${d}"/>`).join("\n      ")}
    </g>
  </g>
</svg>`;

  return {
    svg,
    width,
    height,
    rings: [
      { x: leftRing.x, y: leftRing.y, outer: ringOuter, inner: ringInner },
      { x: rightRing.x, y: rightRing.y, outer: ringOuter, inner: ringInner },
    ],
  };
}
