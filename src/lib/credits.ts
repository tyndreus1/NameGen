import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { GENERATION_COST, STARTING_CREDITS } from "./constants";
import { normalizeCode, verifyCode } from "./codes";
import { getCodeSecret } from "./env";
import { resolveCreditPolicy } from "./catalog/settings";

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

/**
 * Credit operations used by NameGen.
 *
 * Today this talks to the local `User.credits` column. Later NameGen will sit
 * inside IdeaLaserStudio and share one credit pool with other features
 * (3D generation, etc.). Swap `creditWallet` to that shared pool — callers
 * should only use these four methods:
 *
 * - `getBalance(userId)` — current remaining credits
 * - `spend(userId, amount)` — atomic deduct; throws INSUFFICIENT
 * - `refund(userId, amount)` — return credits after a failed job
 * - `redeem(userId, code)` — apply a one-time top-up code
 */
export type CreditWallet = {
  getBalance(userId: string): Promise<number>;
  spend(userId: string, amount: number): Promise<number>;
  refund(userId: string, amount: number): Promise<number>;
  redeem(userId: string, rawCode: string): Promise<{ credits: number; added: number; code: string }>;
};

async function localGetBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true },
  });
  return user.credits;
}

async function localSpend(userId: string, amount: number): Promise<number> {
  if (amount < 0) throw new Error("Credit spend amount must be >= 0");
  if (amount === 0) return localGetBalance(userId);
  const changed = await prisma.$executeRaw`
    UPDATE User
    SET credits = credits - ${amount}
    WHERE id = ${userId} AND credits >= ${amount}
  `;
  if (Number(changed) !== 1) {
    throw new CreditError("Yetersiz kredi", "INSUFFICIENT");
  }
  return localGetBalance(userId);
}

async function localRefund(userId: string, amount: number): Promise<number> {
  if (amount < 0) throw new Error("Credit refund amount must be >= 0");
  if (amount === 0) return localGetBalance(userId);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { credits: { increment: amount } },
    select: { credits: true },
  });
  return updated.credits;
}

async function localRedeem(userId: string, rawCode: string, db: Db = prisma) {
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

/** Local SQLite/Postgres wallet. Replace this export to call IdeaLaserStudio. */
export const localCreditWallet: CreditWallet = {
  getBalance: localGetBalance,
  spend: localSpend,
  refund: localRefund,
  redeem: (userId, rawCode) => localRedeem(userId, rawCode),
};

/** Active wallet used by routes and the rest of NameGen. */
export const creditWallet: CreditWallet = localCreditWallet;

export async function getBalance(userId: string): Promise<number> {
  return creditWallet.getBalance(userId);
}

export async function spend(userId: string, amount: number): Promise<number> {
  return creditWallet.spend(userId, amount);
}

export async function refund(userId: string, amount: number): Promise<number> {
  return creditWallet.refund(userId, amount);
}

export async function redeem(userId: string, rawCode: string) {
  return creditWallet.redeem(userId, rawCode);
}

export async function startingGrant(): Promise<number> {
  return (await resolveCreditPolicy()).startingCredits;
}

export async function generationCharge(): Promise<number> {
  return (await resolveCreditPolicy()).generationCost;
}

export async function reserveGenerationCredits(userId: string): Promise<number> {
  return spend(userId, await generationCharge());
}

export async function refundGenerationCredits(userId: string): Promise<number> {
  return refund(userId, await generationCharge());
}

/** @deprecated Prefer `redeem` — kept so existing callers/tests keep working. */
export const redeemCode = redeem;

export { GENERATION_COST, STARTING_CREDITS };
