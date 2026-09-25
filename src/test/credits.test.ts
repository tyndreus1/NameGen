import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { CreditError, redeemCode, refundGenerationCredits, reserveGenerationCredits } from "@/lib/credits";
import { signCode } from "@/lib/codes";
import { GENERATION_COST, STARTING_CREDITS } from "@/lib/constants";

async function makeUser(email: string, credits = STARTING_CREDITS) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("password12"),
      credits,
    },
  });
}

describe("credit deduction and redemption", () => {
  beforeEach(async () => {
    await prisma.generation.deleteMany();
    await prisma.creditCode.deleteMany();
    await prisma.user.deleteMany();
  });

  it("starts new users at 60 and deducts 3 atomically", async () => {
    const user = await makeUser("start@example.com");
    expect(user.credits).toBe(60);
    const after = await reserveGenerationCredits(user.id);
    expect(after).toBe(57);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.credits).toBe(57);
  });

  it("refuses deduction when balance is below 3", async () => {
    const user = await makeUser("poor@example.com", 2);
    await expect(reserveGenerationCredits(user.id)).rejects.toMatchObject({
      code: "INSUFFICIENT",
    } satisfies Partial<CreditError>);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.credits).toBe(2);
  });

  it("refunds a failed generation so the user is not charged", async () => {
    const user = await makeUser("refund@example.com", 6);
    await reserveGenerationCredits(user.id);
    const after = await refundGenerationCredits(user.id);
    expect(after).toBe(6);
  });

  it("redeems a signed 120 code once and rejects the second attempt", async () => {
    const user = await makeUser("redeem@example.com", 60);
    const code = signCode(process.env.CODE_SECRET!, 120);
    await prisma.creditCode.create({ data: { code, credits: 120 } });

    const first = await redeemCode(user.id, code);
    expect(first.added).toBe(120);
    expect(first.credits).toBe(180);

    await expect(redeemCode(user.id, code)).rejects.toMatchObject({
      code: "ALREADY_REDEEMED",
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.credits).toBe(180);
    const row = await prisma.creditCode.findUniqueOrThrow({ where: { code } });
    expect(row.redeemedById).toBe(user.id);
    expect(row.redeemedAt).not.toBeNull();
  });

  it("does not accept a forged or unknown code", async () => {
    const user = await makeUser("forge@example.com");
    const forged = signCode("wrong-secret", 240);
    await expect(redeemCode(user.id, forged)).rejects.toMatchObject({ code: "INVALID_CODE" });

    const real = signCode(process.env.CODE_SECRET!, 60);
    await expect(redeemCode(user.id, real)).rejects.toMatchObject({ code: "UNKNOWN_CODE" });
    expect(GENERATION_COST).toBe(3);
  });
});
