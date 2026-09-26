import { GENERATION_COST, STARTING_CREDITS } from "../constants";
import { getCreditsProvider } from "../env";
import { resolveCreditPolicy } from "../catalog/settings";
import { localCreditWallet } from "./local";
import { remoteCreditWallet } from "./remote";
import type { CreditWallet } from "./types";

export { CreditError, NAMEGEN_FEATURE, type CreditWallet } from "./types";
export { localCreditWallet } from "./local";
export { remoteCreditWallet } from "./remote";
export { GENERATION_COST, STARTING_CREDITS };

/**
 * Active wallet. `CREDITS_PROVIDER=local` (default) uses SQLite.
 * `CREDITS_PROVIDER=remote` selects the IdeaLaserStudio stub — HTTP is not
 * implemented yet; see `remote.ts`.
 */
export const creditWallet: CreditWallet =
  getCreditsProvider() === "remote" ? remoteCreditWallet : localCreditWallet;

export async function getBalance(userId: string): Promise<number> {
  return creditWallet.getBalance(userId);
}

export async function spend(
  userId: string,
  feature: string,
  amount: number,
  idempotencyKey: string,
): Promise<string> {
  return creditWallet.spend(userId, feature, amount, idempotencyKey);
}

export async function refund(spendId: string): Promise<void> {
  return creditWallet.refund(spendId);
}

export async function redeem(userId: string, code: string) {
  return creditWallet.redeem(userId, code);
}

export async function startingGrant(): Promise<number> {
  return (await resolveCreditPolicy()).startingCredits;
}

export async function generationCharge(): Promise<number> {
  return (await resolveCreditPolicy()).generationCost;
}

/** @deprecated Prefer `redeem` — kept so existing callers/tests keep working. */
export const redeemCode = redeem;
