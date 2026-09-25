import { z } from "zod";
import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { adminReference } from "@/lib/catalog/serialize";
import { deleteReferenceFile } from "@/lib/catalog/storage";

const patchSchema = z.object({
  writtenName: z.string().max(40).nullable().optional(),
  enabled: z.boolean().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Geçersiz güncelleme");
  const existing = await prisma.styleReference.findUnique({ where: { id } });
  if (!existing) return apiError("Referans bulunamadı", 404);

  if (parsed.data.categoryIds) {
    await prisma.categoryReference.deleteMany({ where: { referenceId: id } });
    if (parsed.data.categoryIds.length) {
      await prisma.categoryReference.createMany({
        data: parsed.data.categoryIds.map((categoryId) => ({ categoryId, referenceId: id })),
      });
    }
  }

  const updated = await prisma.styleReference.update({
    where: { id },
    data: {
      writtenName:
        parsed.data.writtenName === undefined
          ? undefined
          : parsed.data.writtenName?.trim() || null,
      enabled: parsed.data.enabled,
    },
    include: { categories: true },
  });
  return json({ reference: adminReference(updated) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const { id } = await context.params;
  try {
    await prisma.styleReference.delete({ where: { id } });
    deleteReferenceFile(id);
    return json({ ok: true });
  } catch {
    return apiError("Referans bulunamadı", 404);
  }
}
