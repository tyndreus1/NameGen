import { z } from "zod";
import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { adminCategory } from "@/lib/catalog/serialize";

const patchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  description: z.string().max(200).optional(),
  promptText: z.string().min(1).max(2000).optional(),
  ringCount: z.enum(["none", "one", "two"]).optional(),
  ringPosition: z.enum(["left", "right", "first-letter"]).optional(),
  enforceRings: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Geçersiz güncelleme");
  try {
    const updated = await prisma.category.update({
      where: { id },
      data: parsed.data,
      include: { references: true },
    });
    return json({ category: adminCategory(updated) });
  } catch {
    return apiError("Kategori bulunamadı", 404);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const { id } = await context.params;
  try {
    await prisma.category.delete({ where: { id } });
    return json({ ok: true });
  } catch {
    return apiError("Kategori bulunamadı", 404);
  }
}
