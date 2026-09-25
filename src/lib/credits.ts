import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { GENERATION_COST } from "./constants";
import { normalizeCode, verifyCode } from "./codes";
import { getCodeSecret } from "./env";

type Db = PrismaClient | Prisma.TransactionClient;

export class CreditError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INSUFFICIENT"
      | "INVALID_CODE"
      | "ALREADY_REDEEMED"
      | "UNKNOWN_CODE"
      | "GENERATION_FAILED",
  ) {
    super(message);
    this.name = "CreditError";
  }
}

export async function reserveGenerationCredits(userId: string): Promise<number> {
  const changed = await prisma.$executeRaw`
    UPDATE User
    SET credits = credits - ${GENERATION_COST}
    WHERE id = ${userId} AND credits >= ${GENERATION_COST}
  `;
  if (Number(changed) !== 1) {
    throw new CreditError("Yetersiz kredi", "INSUFFICIENT");
  }
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true },
  });
  return updated.credits;
}

export async function refundGenerationCredits(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { credits: { increment: GENERATION_COST } },
    select: { credits: true },
  });
  return updated.credits;
}

export async function redeemCode(userId: string, rawCode: string, db: Db = prisma) {
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
    return await db.$transaction(async (tx) => {
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
