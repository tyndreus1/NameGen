import { z } from "zod";
import { findUserByEmail, setUserCookie, verifyPassword } from "@/lib/auth";
import { apiError, json } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("E-posta ve şifre gerekli");
  }
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return apiError("E-posta veya şifre hatalı", 401);
  }
  await setUserCookie(user.id);
  return json({ id: user.id, email: user.email, credits: user.credits });
}
