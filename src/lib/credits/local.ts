import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { normalizeCode, verifyCode } from "../codes";
import { getCodeSecret } from "../env";
import { CreditError, type CreditWallet } from "./types";

function assertSpendMatches(
  row: { userId: string; feature: string; amount: number },
  userId: string,
  feature: string,
  amount: number,
): void {
  if (row.userId !== userId || row.feature !== feature || row.amount !== amount) {
    throw new CreditError("Bu idempotency anahtarı başka bir harcama için kullanıldı", "IDEMPOTENCY_CONFLICT");
  }
}

async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true },
  });
  return user.credits;
}

async function spend(
  userId: string,
  feature: string,
  amount: number,
  idempotencyKey: string,
): Promise<string> {
  const key = idempotencyKey.trim();
  const feat = feature.trim();
  if (!key) throw new Error("idempotencyKey is required");
  if (!feat) throw new Error("feature is required");
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Credit spend amount must be an integer >= 0");
  }

  const existing = await prisma.creditSpend.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    assertSpendMatches(existing, userId, feat, amount);
    return existing.id;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const again = await tx.creditSpend.findUnique({ where: { idempotencyKey: key } });
      if (again) {
        assertSpendMatches(again, userId, feat, amount);
        return again.id;
      }

      if (amount > 0) {
        const changed = await tx.$executeRaw`
          UPDATE User
          SET credits = credits - ${amount}
          WHERE id = ${userId} AND credits >= ${amount}
        `;
        if (Number(changed) !== 1) {
          throw new CreditError("Yetersiz kredi", "INSUFFICIENT");
        }
      }

      const row = await tx.creditSpend.create({
        data: { userId, feature: feat, amount, idempotencyKey: key },
      });
      return row.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const row = await prisma.creditSpend.findUnique({ where: { idempotencyKey: key } });
      if (row) {
        assertSpendMatches(row, userId, feat, amount);
        return row.id;
      }
    }
    throw error;
  }
}

async function refund(spendId: string): Promise<void> {
  const id = spendId.trim();
  if (!id) throw new Error("spendId is required");

  await prisma.$transaction(async (tx) => {
    const row = await tx.creditSpend.findUnique({ where: { id } });
    if (!row) {
      throw new CreditError("Harcama bulunamadı", "UNKNOWN_SPEND");
    }
    if (row.refundedAt) return;

    const marked = await tx.creditSpend.updateMany({
      where: { id, refundedAt: null },
      data: { refundedAt: new Date() },
    });
    if (marked.count !== 1) return;
    if (row.amount <= 0) return;

    await tx.user.update({
      where: { id: row.userId },
      data: { credits: { increment: row.amount } },
    });
  });
}

async function redeem(userId: string, rawCode: string) {
  const secret = getCodeSecret();
  const parsed = verifyCode(secret, rawCode);
  if (!parsed) {
    throw new CreditError("Geçersiz kod", "INVALID_CODE");
  }
  const code = normalizeCode(rawCode);
  if (!code) {
    throw new CreditError("Geçersiz kod", "INVALID_CODE");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.creditCode.findUnique({ where: { code } });
      if (!existing) {
        throw new CreditError("Bu kod sistemde kayıtlı değil", "UNKNOWN_CODE");
      }
      if (existing.redeemedAt) {
        throw new CreditError("Bu kod daha önce kullanıldı", "ALREADY_REDEEMED");
      }

      const marked = await tx.creditCode.updateMany({
        where: { code, redeemedAt: null },
        data: { redeemedAt: new Date(), redeemedById: userId },
      });
      if (marked.count !== 1) {
        throw new CreditError("Bu kod daha önce kullanıldı", "ALREADY_REDEEMED");
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: existing.credits } },
        select: { credits: true },
      });

      return { credits: user.credits, added: existing.credits, code };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CreditError("Bu kod daha önce kullanıldı", "ALREADY_REDEEMED");
    }
    throw error;
  }
}

/** Default provider: local `User.credits` + `CreditSpend` ledger. */
export const localCreditWallet: CreditWallet = {
  getBalance,
  spend,
  refund,
  redeem,
};
