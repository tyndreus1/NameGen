import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { CreditError, redeemCode } from "@/lib/credits";

const schema = z.object({
  code: z.string().min(8).max(48),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Giriş yapmalısınız", 401);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("Kod girin");
  }

  try {
    const result = await redeemCode(user.id, parsed.data.code);
    return json(result);
  } catch (error) {
    if (error instanceof CreditError) {
      const status = error.code === "ALREADY_REDEEMED" ? 409 : 400;
      return apiError(error.message, status, { code: error.code });
    }
    throw error;
  }
}
