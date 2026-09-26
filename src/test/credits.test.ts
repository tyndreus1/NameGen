import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createUser } from "@/lib/auth";
import {
  CreditError,
  creditWallet,
  generationCharge,
  getBalance,
  localCreditWallet,
  NAMEGEN_FEATURE,
  redeem,
  refund,
  remoteCreditWallet,
  spend,
} from "@/lib/credits";
import { saveGenerationSettings } from "@/lib/catalog/settings";
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
    await prisma.creditSpend.deleteMany();
    await prisma.creditCode.deleteMany();
    await prisma.user.deleteMany();
    await prisma.appSettings.deleteMany();
  });

  it("starts new users at 60 and deducts 3 atomically via spendId", async () => {
    const user = await makeUser("start@example.com");
    expect(user.credits).toBe(60);
    const spendId = await spend(user.id, NAMEGEN_FEATURE, 3, "gen-start-1");
    expect(spendId).toEqual(expect.any(String));
    expect(await getBalance(user.id)).toBe(57);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.credits).toBe(57);
    const row = await prisma.creditSpend.findUniqueOrThrow({ where: { id: spendId } });
    expect(row.feature).toBe("namegen");
    expect(row.amount).toBe(3);
    expect(row.refundedAt).toBeNull();
  });

  it("refuses deduction when balance is below the charge", async () => {
    const user = await makeUser("poor@example.com", 2);
    await expect(spend(user.id, NAMEGEN_FEATURE, 3, "gen-poor-1")).rejects.toMatchObject({
      code: "INSUFFICIENT",
    } satisfies Partial<CreditError>);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.credits).toBe(2);
    expect(await prisma.creditSpend.count()).toBe(0);
  });

  it("refunds by spendId so a failed generation is not charged", async () => {
    const user = await makeUser("refund@example.com", 6);
    const spendId = await spend(user.id, NAMEGEN_FEATURE, 3, "gen-refund-1");
    expect(await getBalance(user.id)).toBe(3);
    await refund(spendId);
    expect(await getBalance(user.id)).toBe(6);
    const row = await prisma.creditSpend.findUniqueOrThrow({ where: { id: spendId } });
    expect(row.refundedAt).not.toBeNull();
  });

  it("is a no-op to refund the same spendId twice", async () => {
    const user = await makeUser("double-refund@example.com", 6);
    const spendId = await spend(user.id, NAMEGEN_FEATURE, 3, "gen-double-refund");
    await refund(spendId);
    await refund(spendId);
    expect(await getBalance(user.id)).toBe(6);
  });

  it("does not charge twice for the same idempotency key", async () => {
    const user = await makeUser("idem@example.com", 9);
    const first = await spend(user.id, NAMEGEN_FEATURE, 3, "same-key");
    const second = await spend(user.id, NAMEGEN_FEATURE, 3, "same-key");
    expect(second).toBe(first);
    expect(await getBalance(user.id)).toBe(6);
    expect(await prisma.creditSpend.count()).toBe(1);
  });

  it("rejects the same idempotency key used with different spend arguments", async () => {
    const user = await makeUser("conflict@example.com", 20);
    await spend(user.id, NAMEGEN_FEATURE, 3, "shared-key");
    await expect(spend(user.id, NAMEGEN_FEATURE, 5, "shared-key")).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    expect(await getBalance(user.id)).toBe(17);
  });

  it("charges only once when the same key is spent concurrently", async () => {
    const user = await makeUser("race@example.com", 12);
    const results = await Promise.all([
      spend(user.id, NAMEGEN_FEATURE, 3, "race-key"),
      spend(user.id, NAMEGEN_FEATURE, 3, "race-key"),
    ]);
    expect(results[0]).toBe(results[1]);
    expect(await getBalance(user.id)).toBe(9);
    expect(await prisma.creditSpend.count()).toBe(1);
  });

  it("follows spend → work-fails → refund(spendId) without a leftover charge", async () => {
    const user = await makeUser("flow@example.com", 9);
    const key = crypto.randomUUID();
    const spendId = await spend(user.id, NAMEGEN_FEATURE, 3, key);
    expect(await getBalance(user.id)).toBe(6);
    try {
      throw new Error("Grok failed");
    } catch {
      await refund(spendId);
    }
    expect(await getBalance(user.id)).toBe(9);
    // Replay of the refunded request must not charge again.
    expect(await spend(user.id, NAMEGEN_FEATURE, 3, key)).toBe(spendId);
    expect(await getBalance(user.id)).toBe(9);
  });

  it("redeems a signed 120 code once and rejects the second attempt", async () => {
    const user = await makeUser("redeem@example.com", 60);
    const code = signCode(process.env.CODE_SECRET!, 120);
    await prisma.creditCode.create({ data: { code, credits: 120 } });

    const first = await redeem(user.id, code);
    expect(first.added).toBe(120);
    expect(first.credits).toBe(180);

    await expect(redeem(user.id, code)).rejects.toMatchObject({
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
    await expect(redeem(user.id, forged)).rejects.toMatchObject({ code: "INVALID_CODE" });

    const real = signCode(process.env.CODE_SECRET!, 60);
    await expect(redeem(user.id, real)).rejects.toMatchObject({ code: "UNKNOWN_CODE" });
    expect(GENERATION_COST).toBe(3);
    expect(STARTING_CREDITS).toBe(60);
  });

  it("exposes getBalance / spend / refund / redeem on the wallet", async () => {
    const user = await makeUser("wallet@example.com", 10);
    expect(Object.keys(creditWallet).sort()).toEqual(["getBalance", "redeem", "refund", "spend"]);
    expect(creditWallet).toBe(localCreditWallet);
    expect(await getBalance(user.id)).toBe(10);
    const spendId = await spend(user.id, NAMEGEN_FEATURE, 4, "wallet-spend");
    expect(await getBalance(user.id)).toBe(6);
    await refund(spendId);
    expect(await getBalance(user.id)).toBe(10);
  });

  it("uses the admin starting-credit and generation-cost settings", async () => {
    await saveGenerationSettings({ startingCredits: 0, generationCost: 5 });
    const user = await createUser("zero@example.com", "password12");
    expect(user.credits).toBe(0);

    const rich = await makeUser("rich@example.com", 10);
    expect(await generationCharge()).toBe(5);
    const spendId = await spend(rich.id, NAMEGEN_FEATURE, await generationCharge(), "admin-cost");
    expect(await getBalance(rich.id)).toBe(5);
    await refund(spendId);
    expect(await getBalance(rich.id)).toBe(10);
  });

  it("leaves the remote provider as a not-implemented stub", async () => {
    await expect(remoteCreditWallet.getBalance("user-1")).rejects.toThrow(/not implemented yet/);
    await expect(remoteCreditWallet.spend("user-1", NAMEGEN_FEATURE, 3, "k")).rejects.toThrow(
      /not implemented yet/,
    );
    await expect(remoteCreditWallet.refund("spend-1")).rejects.toThrow(/not implemented yet/);
    await expect(remoteCreditWallet.redeem("user-1", "NG60-X")).rejects.toThrow(/not implemented yet/);
  });
});
