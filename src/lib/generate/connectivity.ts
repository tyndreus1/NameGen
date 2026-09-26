import { yieldEventLoop } from "./offload";

export type BinaryImage = {
  width: number;
  height: number;
  /** 1 = black (material), 0 = white (background / hole) */
  data: Uint8Array;
};

export type Component = {
  id: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
};

const NEIGHBORS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

export function countBlackPixels(image: BinaryImage): number {
  let n = 0;
  for (const v of image.data) if (v) n++;
  return n;
}

export function findComponents(image: BinaryImage): Component[] {
  const { width, height, data } = image;
  const seen = new Uint8Array(data.length);
  const components: Component[] = [];
  const stackX: number[] = [];
  const stackY: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (!data[i] || seen[i]) continue;

      stackX.length = 0;
      stackY.length = 0;
      stackX.push(x);
      stackY.push(y);
      seen[i] = 1;

      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let minY = y;
      const seed = components.length + 1;
      let maxX = x;
      let maxY = y;

      while (stackX.length) {
        const cx = stackX.pop()!;
        const cy = stackY.pop()!;
        area++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of NEIGHBORS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = idx(nx, ny, width);
          if (!data[ni] || seen[ni]) continue;
          seen[ni] = 1;
          stackX.push(nx);
          stackY.push(ny);
        }
      }

      components.push({
        id: seed,
        area,
        minX,
        minY,
        maxX,
        maxY,
        cx: sumX / area,
        cy: sumY / area,
      });
    }
  }

  return components.sort((a, b) => b.area - a.area);
}

export function countComponents(image: BinaryImage): number {
  return findComponents(image).length;
}

function componentMask(image: BinaryImage, target: Component): Uint8Array {
  const { width, height, data } = image;
  const seen = new Uint8Array(data.length);
  const mask = new Uint8Array(data.length);
  const stackX = [Math.round(target.cx)];
  const stackY = [Math.round(target.cy)];

  // Seed from bbox — centroid may land in a hole (e.g. a ring).
  let seeded = false;
  for (let y = target.minY; y <= target.maxY && !seeded; y++) {
    for (let x = target.minX; x <= target.maxX; x++) {
      const i = idx(x, y, width);
      if (data[i]) {
        stackX[0] = x;
        stackY[0] = y;
        seeded = true;
        break;
      }
    }
  }
  if (!seeded) return mask;

  const start = idx(stackX[0]!, stackY[0]!, width);
  seen[start] = 1;
  mask[start] = 1;

  while (stackX.length) {
    const cx = stackX.pop()!;
    const cy = stackY.pop()!;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = idx(nx, ny, width);
      if (!data[ni] || seen[ni]) continue;
      seen[ni] = 1;
      mask[ni] = 1;
      stackX.push(nx);
      stackY.push(ny);
    }
  }
  return mask;
}

function nearestPair(
  image: BinaryImage,
  maskA: Uint8Array,
  maskB: Uint8Array,
): { ax: number; ay: number; bx: number; by: number } | null {
  const { width, height } = image;
  let best = Infinity;
  let ax = 0;
  let ay = 0;
  let bx = 0;
  let by = 0;
  const pointsA: number[] = [];
  const pointsB: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (maskA[i]) pointsA.push(x, y);
      if (maskB[i]) pointsB.push(x, y);
    }
  }
  if (!pointsA.length || !pointsB.length) return null;

  // Sample if huge.
  const stepA = pointsA.length > 8000 ? Math.ceil(pointsA.length / 4000 / 2) * 2 : 2;
  const stepB = pointsB.length > 8000 ? Math.ceil(pointsB.length / 4000 / 2) * 2 : 2;

  for (let i = 0; i < pointsA.length; i += stepA) {
    const x1 = pointsA[i]!;
    const y1 = pointsA[i + 1]!;
    for (let j = 0; j < pointsB.length; j += stepB) {
      const x2 = pointsB[j]!;
      const y2 = pointsB[j + 1]!;
      const d = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
      if (d < best) {
        best = d;
        ax = x1;
        ay = y1;
        bx = x2;
        by = y2;
      }
    }
  }
  return { ax, ay, bx, by };
}

function paintDisk(image: BinaryImage, cx: number, cy: number, radius: number): void {
  const { width, height, data } = image;
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        data[idx(x, y, width)] = 1;
      }
    }
  }
}

function paintBridge(
  image: BinaryImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
): void {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    paintDisk(image, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
  }
}

function eraseComponent(image: BinaryImage, mask: Uint8Array): void {
  const { data } = image;
  for (let i = 0; i < data.length; i++) {
    if (mask[i]) data[i] = 0;
  }
}

export type UnifyOptions = {
  /** Islands smaller than this many pixels are deleted (dust / specks). */
  minKeepArea?: number;
  /** Bridge thickness in pixels. */
  bridgeRadius?: number;
};

/**
 * Force a single black connected component.
 * Tiny islands are removed; larger ones are bridged to the main body.
 * Interior holes are preserved (they are white, not black components).
 */
function keepLargestOnly(image: BinaryImage): number {
  const components = findComponents(image);
  if (components.length <= 1) return components.length;
  const main = components[0]!;
  const mainMask = componentMask(image, main);
  const { data } = image;
  for (let i = 0; i < data.length; i++) {
    if (data[i] && !mainMask[i]) data[i] = 0;
  }
  return 1;
}

export type IslandRepair = {
  components: number;
  bridged: number;
  removed: number;
  dilated: number;
  rejected: boolean;
};

function isCompactDiacritic(extra: Component, main: Component, maxDotArea: number, image: BinaryImage): boolean {
  if (extra.area > maxDotArea) return false;
  if (extra.area > main.area * 0.05) return false;
  const w = extra.maxX - extra.minX + 1;
  const h = extra.maxY - extra.minY + 1;
  const aspect = w / Math.max(1, h);
  if (aspect < 0.18 || aspect > 5.5) return false;
  const limit = Math.min(image.width, image.height) * 0.28;
  return Math.max(w, h) <= limit;
}

/**
 * Grow a small island a few pixels toward the letter so ü dots / cedillas
 * fuse with a short stem instead of a long invented bridge.
 */
function dilateToward(
  image: BinaryImage,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius: number,
  maxSteps: number,
): void {
  const dist = Math.hypot(toX - fromX, toY - fromY);
  const travel = Math.min(dist, maxSteps);
  const steps = Math.max(1, Math.ceil(travel));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (travel / Math.max(dist, 1));
    paintDisk(image, fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, radius);
  }
}

/**
 * Grok-path island handling: drop dust, fuse close dots/cedillas into the
 * nearest letter (dilate, then a neat short bridge), then one-piece check.
 * Far or large leftovers are rejected so the slot can retry.
 */
export type RepairOptions = {
  speckArea?: number;
  maxDotArea?: number;
  maxDistance?: number;
  bridgeRadius?: number;
  dilateRadius?: number;
};

/** Cap island work so a noisy 2k Grok raster cannot run unbounded. */
const MAX_REPAIR_ISLANDS = 64;

export function repairSmallIslands(image: BinaryImage, options: RepairOptions = {}): IslandRepair {
  return runIslandRepair(image, options);
}

export async function repairSmallIslandsAsync(
  image: BinaryImage,
  options: RepairOptions = {},
): Promise<IslandRepair> {
  return runIslandRepair(image, options, yieldEventLoop);
}

function runIslandRepair(
  image: BinaryImage,
  options: RepairOptions,
  yieldEvery?: () => Promise<void>,
): IslandRepair;
function runIslandRepair(
  image: BinaryImage,
  options: RepairOptions,
  yieldEvery: () => Promise<void>,
): Promise<IslandRepair>;
function runIslandRepair(
  image: BinaryImage,
  options: RepairOptions,
  yieldEvery?: () => Promise<void>,
): IslandRepair | Promise<IslandRepair> {
  const minDim = Math.min(image.width, image.height);
  let bridged = 0;
  let removed = 0;
  let dilated = 0;

  const step = (): IslandRepair | "again" => {
    const components = findComponents(image);
    if (components.length <= 1) {
      return { components: components.length, bridged, removed, dilated, rejected: false };
    }
    const main = components[0]!;
    const speckArea = options.speckArea ?? Math.max(10, Math.round(main.area * 0.00035));
    const maxDotArea = options.maxDotArea ?? Math.max(220, Math.round(main.area * 0.045));
    const maxDistance = options.maxDistance ?? Math.max(16, Math.round(minDim * 0.07));
    const dilateRadius = options.dilateRadius ?? Math.max(2, Math.round(minDim / 180));
    const bridgeRadius = options.bridgeRadius ?? Math.max(1, Math.round(minDim / 280));
    const extras = components.slice(1, MAX_REPAIR_ISLANDS + 1);
    const mainMask = componentMask(image, main);
    let changed = false;

    for (const extra of extras) {
      const extraMask = componentMask(image, extra);
      if (extra.area < speckArea) {
        eraseComponent(image, extraMask);
        removed++;
        changed = true;
        continue;
      }
      const pair = nearestPair(image, mainMask, extraMask);
      const dist = pair ? Math.hypot(pair.ax - pair.bx, pair.ay - pair.by) : Infinity;
      if (pair && isCompactDiacritic(extra, main, maxDotArea, image) && dist <= maxDistance) {
        dilateToward(image, pair.ax, pair.ay, pair.bx, pair.by, dilateRadius, dilateRadius + 1);
        dilated++;
        const after = findComponents(image);
        if (after.length > 1) {
          paintBridge(image, pair.ax, pair.ay, pair.bx, pair.by, bridgeRadius);
          bridged++;
        }
        changed = true;
      }
    }
    if (!changed) {
      const leftover = findComponents(image);
      return {
        components: leftover.length,
        bridged,
        removed,
        dilated,
        rejected: leftover.length !== 1,
      };
    }
    return "again";
  };

  if (!yieldEvery) {
    for (let guard = 0; guard < 12; guard++) {
      const result = step();
      if (result !== "again") return result;
    }
    const leftover = findComponents(image);
    return {
      components: leftover.length,
      bridged,
      removed,
      dilated,
      rejected: leftover.length !== 1,
    };
  }

  return (async () => {
    for (let guard = 0; guard < 12; guard++) {
      await yieldEvery();
      const result = step();
      if (result !== "again") return result;
    }
    const leftover = findComponents(image);
    return {
      components: leftover.length,
      bridged,
      removed,
      dilated,
      rejected: leftover.length !== 1,
    };
  })();
}

export function unifyToSinglePiece(image: BinaryImage, options: UnifyOptions = {}): number {
  const minKeepArea = options.minKeepArea ?? 18;
  const bridgeRadius = options.bridgeRadius ?? 3;

  for (let guard = 0; guard < 16; guard++) {
    const components = findComponents(image);
    if (components.length <= 1) return components.length;

    const main = components[0]!;
    const mainMask = componentMask(image, main);

    for (const extra of components.slice(1)) {
      const extraMask = componentMask(image, extra);
      if (extra.area < minKeepArea) {
        eraseComponent(image, extraMask);
        continue;
      }
      const pair = nearestPair(image, mainMask, extraMask);
      if (!pair) {
        paintBridge(image, main.cx, main.cy, extra.cx, extra.cy, Math.max(bridgeRadius, 8));
        continue;
      }
      const fat = extra.area > main.area * 0.08 ? Math.max(bridgeRadius, 8) : bridgeRadius;
      paintBridge(image, pair.ax, pair.ay, pair.bx, pair.by, fat);
    }
  }

  const leftover = findComponents(image);
  if (leftover.length <= 1) return leftover.length;
  // Last resort: drop only leftover dust so jewelry hardware is never discarded first.
  const main = leftover[0]!;
  for (const extra of leftover.slice(1)) {
    if (extra.area < main.area * 0.12) {
      eraseComponent(image, componentMask(image, extra));
    } else {
      paintBridge(image, main.cx, main.cy, extra.cx, extra.cy, 10);
    }
  }
  return keepLargestOnly(image);
}

export function binaryFromRgba(rgba: Uint8Array, width: number, height: number, threshold = 128): BinaryImage {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4] ?? 255;
    const g = rgba[i * 4 + 1] ?? 255;
    const b = rgba[i * 4 + 2] ?? 255;
    const a = rgba[i * 4 + 3] ?? 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[i] = a > 16 && luminance < threshold ? 1 : 0;
  }
  return { width, height, data };
}

export function binaryToRgba(image: BinaryImage): Buffer {
  const out = Buffer.alloc(image.width * image.height * 4);
  for (let i = 0; i < image.data.length; i++) {
    const v = image.data[i] ? 0 : 255;
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
}

export function cropToContent(image: BinaryImage, padding = 24): BinaryImage {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return image;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const next = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      next[y * w + x] = data[(minY + y) * width + (minX + x)]!;
    }
  }
  return { width: w, height: h, data: next };
}

export function punchDisk(image: BinaryImage, cx: number, cy: number, radius: number): void {
  const { width, height, data } = image;
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        data[y * width + x] = 0;
      }
    }
  }
}

export function hasGrayPixels(rgba: Uint8Array): boolean {
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const a = rgba[i + 3]!;
    if (a !== 255) return true;
    const isBlack = r === 0 && g === 0 && b === 0;
    const isWhite = r === 255 && g === 255 && b === 255;
    if (!isBlack && !isWhite) return true;
  }
  return false;
}
