export const RING_COUNTS = ["none", "one", "two"] as const;
export type RingCount = (typeof RING_COUNTS)[number];

export const RING_POSITIONS = ["left", "right", "first-letter"] as const;
export type RingPosition = (typeof RING_POSITIONS)[number];

export type RingPolicy = {
  ringCount: RingCount;
  ringPosition: RingPosition;
  enforceRings: boolean;
};

export const DEFAULT_RING_POLICY: RingPolicy = {
  ringCount: "two",
  ringPosition: "left",
  enforceRings: true,
};

export function parseRingCount(value: string | null | undefined): RingCount {
  return RING_COUNTS.includes(value as RingCount) ? (value as RingCount) : DEFAULT_RING_POLICY.ringCount;
}

export function parseRingPosition(value: string | null | undefined): RingPosition {
  return RING_POSITIONS.includes(value as RingPosition)
    ? (value as RingPosition)
    : DEFAULT_RING_POLICY.ringPosition;
}

export function ringPolicyFrom(row: {
  ringCount?: string | null;
  ringPosition?: string | null;
  enforceRings?: boolean | null;
}): RingPolicy {
  return {
    ringCount: parseRingCount(row.ringCount),
    ringPosition: parseRingPosition(row.ringPosition),
    enforceRings: row.enforceRings !== false,
  };
}

export function ringInstruction(policy: RingPolicy): string {
  if (policy.ringCount === "none") {
    return "Do not add any rings, jump rings, or circular attachment holes.";
  }
  if (policy.ringCount === "one") {
    if (policy.ringPosition === "right") {
      return "Add exactly one small round open ring (circle with a hole) at the far right end of the design. Do not add a second ring.";
    }
    if (policy.ringPosition === "first-letter") {
      return "Add exactly one small round open ring (circle with a hole) on the first letter. Do not add a second ring.";
    }
    return "Add exactly one small round open ring (circle with a hole) at the far left end of the design. Do not add a second ring.";
  }
  return "Add a small round open ring (circle with a hole) at the far left end and the far right end.";
}

export function wantsLeftRing(policy: Pick<RingPolicy, "ringCount" | "ringPosition">): boolean {
  return (
    policy.ringCount === "two" ||
    (policy.ringCount === "one" && (policy.ringPosition === "left" || policy.ringPosition === "first-letter"))
  );
}

export function wantsRightRing(policy: Pick<RingPolicy, "ringCount" | "ringPosition">): boolean {
  return policy.ringCount === "two" || (policy.ringCount === "one" && policy.ringPosition === "right");
}
