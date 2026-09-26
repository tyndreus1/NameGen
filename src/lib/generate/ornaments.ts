/** SVG path helpers. Coordinates are in the design space. */

export function heartPath(cx: number, cy: number, size: number, hollow = false): string {
  const s = size;
  const outer =
    `M ${cx} ${cy + s * 0.35}` +
    ` C ${cx} ${cy + s * 0.1}, ${cx - s * 0.55} ${cy - s * 0.05}, ${cx - s * 0.55} ${cy - s * 0.28}` +
    ` C ${cx - s * 0.55} ${cy - s * 0.58}, ${cx - s * 0.1} ${cy - s * 0.62}, ${cx} ${cy - s * 0.28}` +
    ` C ${cx + s * 0.1} ${cy - s * 0.62}, ${cx + s * 0.55} ${cy - s * 0.58}, ${cx + s * 0.55} ${cy - s * 0.28}` +
    ` C ${cx + s * 0.55} ${cy - s * 0.05}, ${cx} ${cy + s * 0.1}, ${cx} ${cy + s * 0.35} Z`;
  if (!hollow) return outer;
  const k = 0.58;
  const inner =
    `M ${cx} ${cy + s * 0.16}` +
    ` C ${cx} ${cy + s * 0.02}, ${cx - s * 0.55 * k} ${cy - s * 0.02}, ${cx - s * 0.55 * k} ${cy - s * 0.2}` +
    ` C ${cx - s * 0.55 * k} ${cy - s * 0.38}, ${cx - s * 0.06} ${cy - s * 0.4}, ${cx} ${cy - s * 0.16}` +
    ` C ${cx + s * 0.06} ${cy - s * 0.4}, ${cx + s * 0.55 * k} ${cy - s * 0.38}, ${cx + s * 0.55 * k} ${cy - s * 0.2}` +
    ` C ${cx + s * 0.55 * k} ${cy - s * 0.02}, ${cx} ${cy + s * 0.02}, ${cx} ${cy + s * 0.16} Z`;
  return `${outer} ${inner}`;
}

export function starPath(cx: number, cy: number, size: number): string {
  const outer = size;
  const inner = size * 0.38;
  const points = 4;
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${parts.join(" ")} Z`;
}

/** Bold filled butterfly close to the Sophia reference. */
export function butterflyPath(cx: number, cy: number, size: number): string {
  const s = size;
  const body =
    `M ${cx - s * 0.08} ${cy - s * 0.22}` +
    ` C ${cx - s * 0.08} ${cy - s * 0.55}, ${cx + s * 0.08} ${cy - s * 0.55}, ${cx + s * 0.08} ${cy - s * 0.22}` +
    ` L ${cx + s * 0.07} ${cy + s * 0.42}` +
    ` C ${cx + s * 0.07} ${cy + s * 0.58}, ${cx - s * 0.07} ${cy + s * 0.58}, ${cx - s * 0.07} ${cy + s * 0.42} Z`;
  const head = `M ${cx} ${cy - s * 0.58} a ${s * 0.12} ${s * 0.12} 0 1 0 0.01 0 Z`;
  const ul =
    `M ${cx} ${cy - s * 0.05}` +
    ` C ${cx - s * 0.05} ${cy - s * 0.55}, ${cx - s * 0.72} ${cy - s * 0.62}, ${cx - s * 0.82} ${cy - s * 0.18}` +
    ` C ${cx - s * 0.7} ${cy + s * 0.08}, ${cx - s * 0.18} ${cy + s * 0.12}, ${cx} ${cy + s * 0.02} Z`;
  const ur =
    `M ${cx} ${cy - s * 0.05}` +
    ` C ${cx + s * 0.05} ${cy - s * 0.55}, ${cx + s * 0.72} ${cy - s * 0.62}, ${cx + s * 0.82} ${cy - s * 0.18}` +
    ` C ${cx + s * 0.7} ${cy + s * 0.08}, ${cx + s * 0.18} ${cy + s * 0.12}, ${cx} ${cy + s * 0.02} Z`;
  const ll =
    `M ${cx} ${cy + s * 0.08}` +
    ` C ${cx - s * 0.2} ${cy + s * 0.18}, ${cx - s * 0.55} ${cy + s * 0.55}, ${cx - s * 0.28} ${cy + s * 0.7}` +
    ` C ${cx - s * 0.05} ${cy + s * 0.55}, ${cx - s * 0.02} ${cy + s * 0.28}, ${cx} ${cy + s * 0.16} Z`;
  const lr =
    `M ${cx} ${cy + s * 0.08}` +
    ` C ${cx + s * 0.2} ${cy + s * 0.18}, ${cx + s * 0.55} ${cy + s * 0.55}, ${cx + s * 0.28} ${cy + s * 0.7}` +
    ` C ${cx + s * 0.05} ${cy + s * 0.55}, ${cx + s * 0.02} ${cy + s * 0.28}, ${cx} ${cy + s * 0.16} Z`;
  return `${body} ${head} ${ul} ${ur} ${ll} ${lr}`;
}

export function ringPath(cx: number, cy: number, outer: number, inner: number): string {
  const o = circleSubpath(cx, cy, outer, true);
  const i = circleSubpath(cx, cy, inner, false);
  return `${o} ${i}`;
}

function circleSubpath(cx: number, cy: number, r: number, clockwise: boolean): string {
  const sweep = clockwise ? 1 : 0;
  return (
    `M ${cx - r} ${cy}` +
    ` a ${r} ${r} 0 1 ${sweep} ${r * 2} 0` +
    ` a ${r} ${r} 0 1 ${sweep} ${-r * 2} 0` +
    ` Z`
  );
}

export function stemPath(x1: number, y1: number, x2: number, y2: number, width: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  return (
    `M ${(x1 + nx).toFixed(2)} ${(y1 + ny).toFixed(2)}` +
    ` L ${(x2 + nx).toFixed(2)} ${(y2 + ny).toFixed(2)}` +
    ` L ${(x2 - nx).toFixed(2)} ${(y2 - ny).toFixed(2)}` +
    ` L ${(x1 - nx).toFixed(2)} ${(y1 - ny).toFixed(2)} Z`
  );
}
