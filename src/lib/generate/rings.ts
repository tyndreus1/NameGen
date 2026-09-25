import type { BinaryImage } from "./connectivity";

export type Hole = {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

const N4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** White components that touch the image border (background). */
function borderConnectedWhite(image: BinaryImage): Uint8Array {
  const { width, height, data } = image;
  const seen = new Uint8Array(data.length);
  const stackX: number[] = [];
  const stackY: number[] = [];

  const push = (x: number, y: number) => {
    const i = idx(x, y, width);
    if (data[i] || seen[i]) return;
    seen[i] = 1;
    stackX.push(x);
    stackY.push(y);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stackX.length) {
    const cx = stackX.pop()!;
    const cy = stackY.pop()!;
    for (const [dx, dy] of N4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      push(nx, ny);
    }
  }
  return seen;
}

export function findInteriorHoles(image: BinaryImage): Hole[] {
  const { width, height, data } = image;
  const background = borderConnectedWhite(image);
  const seen = new Uint8Array(data.length);
  const holes: Hole[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (data[i] || background[i] || seen[i]) continue;

      const stackX = [x];
      const stackY = [y];
      seen[i] = 1;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let minY = y;
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
        for (const [dx, dy] of N4) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = idx(nx, ny, width);
          if (data[ni] || background[ni] || seen[ni]) continue;
          seen[ni] = 1;
          stackX.push(nx);
          stackY.push(ny);
        }
      }

      holes.push({
        area,
        minX,
        minY,
        maxX,
        maxY,
        cx: sumX / area,
        cy: sumY / area,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }
  return holes;
}

function blackBounds(image: BinaryImage): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!image.data[idx(x, y, image.width)]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, maxX, minY, maxY };
}

function isCompactRingHole(hole: Hole, imageArea: number): boolean {
  if (hole.area < 12 || hole.area > imageArea * 0.04) return false;
  const aspect = hole.width / Math.max(1, hole.height);
  if (aspect < 0.55 || aspect > 1.8) return false;
  const fill = hole.area / Math.max(1, hole.width * hole.height);
  // A round jump-ring hole is fairly filled in its bbox; a spiral gap is skinny.
  return fill > 0.35;
}

export type RingCheck = {
  ok: boolean;
  left: Hole | null;
  right: Hole | null;
};

export function hasEndRings(image: BinaryImage): RingCheck {
  const bounds = blackBounds(image);
  if (!bounds) return { ok: false, left: null, right: null };
  const span = Math.max(1, bounds.maxX - bounds.minX);
  const band = Math.max(8, span * 0.18);
  const holes = findInteriorHoles(image).filter((hole) =>
    isCompactRingHole(hole, image.width * image.height),
  );

  let left: Hole | null = null;
  let right: Hole | null = null;
  for (const hole of holes) {
    if (hole.cx <= bounds.minX + band) {
      if (!left || hole.cx < left.cx) left = hole;
    }
    if (hole.cx >= bounds.maxX - band) {
      if (!right || hole.cx > right.cx) right = hole;
    }
  }
  return { ok: Boolean(left && right && left !== right), left, right };
}
