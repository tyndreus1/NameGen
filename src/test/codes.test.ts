import { describe, expect, it } from "vitest";
import { parseCode, signCode, verifyCode } from "@/lib/codes";

const SECRET = "unit-test-secret";
const OTHER = "other-secret";

describe("credit code signing", () => {
  it("signs and verifies 60/120/240 codes", () => {
    for (const credits of [60, 120, 240] as const) {
      const code = signCode(SECRET, credits);
      const parsed = verifyCode(SECRET, code);
      expect(parsed).not.toBeNull();
      expect(parsed?.credits).toBe(credits);
      expect(code.startsWith(`NG${credits}-`)).toBe(true);
    }
  });

  it("rejects tampered payload and wrong secret", () => {
    const code = signCode(SECRET, 120);
    expect(verifyCode(OTHER, code)).toBeNull();
    expect(verifyCode(SECRET, code.replace("NG120", "NG240"))).toBeNull();
    expect(verifyCode(SECRET, code.slice(0, -1) + "A")).toBeNull();
    expect(parseCode("NG60-ABCD-EFGH-JKLM-ABCDEFGH")).not.toBeNull();
    expect(verifyCode(SECRET, "NG60-ABCD-EFGH-JKLM-ABCDEFGH")).toBeNull();
  });

  it("is case-insensitive and ignores spaces", () => {
    const code = signCode(SECRET, 60);
    const spaced = code.toLowerCase().replace(/-/g, " - ");
    expect(verifyCode(SECRET, spaced)?.credits).toBe(60);
  });

  it("uses a readable alphabet without ambiguous characters", () => {
    const code = signCode(SECRET, 240);
    expect(code).toMatch(/^NG240-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{8}$/);
    expect(code.replace(/^NG240/, "")).not.toMatch(/[01IO]/);
  });
});
