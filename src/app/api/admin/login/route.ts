import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { setAdminCookie } from "@/lib/auth";
import { getAdminPassword } from "@/lib/env";
import { apiError, json } from "@/lib/api";

const schema = z.object({
  password: z.string().min(1),
});

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, Buffer.alloc(left.length));
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Şifre gerekli");
  if (!safeEqual(parsed.data.password, getAdminPassword())) {
    return apiError("Yanlış yönetici şifresi", 401);
  }
  await setAdminCookie();
  return json({ ok: true });
}
