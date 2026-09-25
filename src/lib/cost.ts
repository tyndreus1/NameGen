/** xAI `cost_in_usd_ticks`: 1e10 ticks = $1. */
export const USD_TICKS_PER_DOLLAR = 10_000_000_000;

export function usdToTicks(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd * USD_TICKS_PER_DOLLAR);
}

export function ticksToUsd(ticks: number | bigint | string): number {
  const n = typeof ticks === "bigint" ? Number(ticks) : Number(ticks);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / USD_TICKS_PER_DOLLAR;
}

export function addTicks(a: number, b: number): number {
  return Math.max(0, Math.round(a) + Math.round(b));
}
