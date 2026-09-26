export const NAMEGEN_FEATURE = "namegen";

export class CreditError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INSUFFICIENT"
      | "INVALID_CODE"
      | "ALREADY_REDEEMED"
      | "UNKNOWN_CODE"
      | "UNKNOWN_SPEND"
      | "IDEMPOTENCY_CONFLICT"
      | "GENERATION_FAILED",
  ) {
    super(message);
    this.name = "CreditError";
  }
}

/**
 * Shared credit-pool contract (IdeaLaserStudio / idea-mark).
 *
 * Callers must use only these four methods so a later HTTP client can replace
 * the local SQLite provider without touching routes or UI.
 *
 * - `getBalance(userId)` — remaining credits
 * - `spend(userId, feature, amount, idempotencyKey)` — atomic deduct; returns
 *   `spendId`. Throws `INSUFFICIENT` when the balance is too low. The same
 *   idempotency key is a no-op replay (same `spendId`, no second charge).
 * - `refund(spendId)` — return that spend; already-refunded is a no-op
 * - `redeem(userId, code)` — apply a one-time top-up code
 *
 * NameGen always passes `feature = "namegen"`. Never take balance or price
 * from the client — the server reads `generationCharge()` and the wallet.
 */
export type CreditWallet = {
  getBalance(userId: string): Promise<number>;
  spend(userId: string, feature: string, amount: number, idempotencyKey: string): Promise<string>;
  refund(spendId: string): Promise<void>;
  redeem(userId: string, code: string): Promise<{ credits: number; added: number; code: string }>;
};
