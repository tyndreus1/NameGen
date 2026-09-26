import { z } from "zod";
import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { CODE_VALUES } from "@/lib/constants";
import { signCode } from "@/lib/codes";
import { prisma } from "@/lib/db";
import { getCodeSecret } from "@/lib/env";

export async function GET() {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const codes = await prisma.creditCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { redeemedBy: { select: { email: true } } },
    take: 200,
  });
  return json({
    codes: codes.map((row) => ({
      id: row.id,
      code: row.code,
      credits: row.credits,
      createdAt: row.createdAt,
      redeemedAt: row.redeemedAt,
      redeemedBy: row.redeemedBy?.email ?? null,
    })),
  });
}

const schema = z.object({
  credits: z.union([z.literal(60), z.literal(120), z.literal(240)]),
  count: z.number().int().min(1).max(25).default(1),
});

export async function POST(request: Request) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(`Kredi değeri ${CODE_VALUES.join(", ")} olmalı`);
  }

  const secret = getCodeSecret();
  const created = [];
  for (let i = 0; i < parsed.data.count; i++) {
    const code = signCode(secret, parsed.data.credits);
    const row = await prisma.creditCode.create({
      data: { code, credits: parsed.data.credits },
    });
    created.push(row);
  }
  return json({ codes: created }, 201);
}
