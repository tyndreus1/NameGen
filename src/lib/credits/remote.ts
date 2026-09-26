import { getCreditsApiKey, getCreditsApiUrl } from "../env";
import type { CreditWallet } from "./types";

/**
 * STUB — future HTTP client for the IdeaLaserStudio shared credit pool.
 *
 * Selected when `CREDITS_PROVIDER=remote`. Do **not** implement `fetch()` here
 * until that API is live. Fill these four methods with HTTP calls to
 * `CREDITS_API_URL` (auth via `CREDITS_API_KEY`). Callers already go through
 * `CreditWallet`, so this file is the only swap point.
 */
function remoteNotImplemented(method: string): never {
  const url = getCreditsApiUrl() ?? "(CREDITS_API_URL unset)";
  const keySet = Boolean(getCreditsApiKey());
  throw new Error(
    `credits.${method} remote provider is not implemented yet ` +
      `(CREDITS_API_URL=${url}, CREDITS_API_KEY ${keySet ? "set" : "unset"}). ` +
      `Set CREDITS_PROVIDER=local, or implement the HTTP client in src/lib/credits/remote.ts.`,
  );
}

export const remoteCreditWallet: CreditWallet = {
  async getBalance(_userId: string): Promise<number> {
    // TODO(remote-credits): GET {CREDITS_API_URL}/balance?userId=
    remoteNotImplemented("getBalance");
  },
  async spend(
    _userId: string,
    _feature: string,
    _amount: number,
    _idempotencyKey: string,
  ): Promise<string> {
    // TODO(remote-credits): POST {CREDITS_API_URL}/spend
    remoteNotImplemented("spend");
  },
  async refund(_spendId: string): Promise<void> {
    // TODO(remote-credits): POST {CREDITS_API_URL}/refund
    remoteNotImplemented("refund");
  },
  async redeem(_userId: string, _code: string) {
    // TODO(remote-credits): POST {CREDITS_API_URL}/redeem
    remoteNotImplemented("redeem");
  },
};
