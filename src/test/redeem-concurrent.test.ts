import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { redeemCode } from "@/lib/credits";
import { signCode } from "@/lib/codes";

describe("concurrent single-use redemption", () => {
  beforeEach(async () => {
    await prisma.generation.deleteMany();
    await prisma.creditSpend.deleteMany();
    await prisma.creditCode.deleteMany();
    await prisma.user.deleteMany();
  });

  it("credits only once when the same code is redeemed twice at once", async () => {
    const userA = await prisma.user.create({
      data: {
        email: "a@example.com",
        passwordHash: await hashPassword("password12"),
        credits: 60,
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: "b@example.com",
        passwordHash: await hashPassword("password12"),
        credits: 60,
      },
    });
    const code = signCode(process.env.CODE_SECRET!, 240);
    await prisma.creditCode.create({ data: { code, credits: 240 } });

    const results = await Promise.allSettled([
      redeemCode(userA.id, code),
      redeemCode(userB.id, code),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
    const total = users.reduce((sum, user) => sum + user.credits, 0);
    expect(total).toBe(60 + 60 + 240);

    const row = await prisma.creditCode.findUniqueOrThrow({ where: { code } });
    expect(row.redeemedAt).not.toBeNull();
    expect([userA.id, userB.id]).toContain(row.redeemedById);
  });
});
