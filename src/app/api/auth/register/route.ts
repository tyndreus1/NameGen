import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createUser, setUserCookie } from "@/lib/auth";
import { apiError, json } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("Geçerli bir e-posta ve en az 8 karakterlik şifre girin");
  }
  try {
    const user = await createUser(parsed.data.email, parsed.data.password);
    await setUserCookie(user.id);
    return json({ id: user.id, email: user.email, credits: user.credits }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("Bu e-posta zaten kayıtlı", 409);
    }
    throw error;
  }
}
