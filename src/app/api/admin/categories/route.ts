import { z } from "zod";
import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureCatalog, slugify } from "@/lib/catalog/seed";
import { adminCategory } from "@/lib/catalog/serialize";

const createSchema = z.object({
  label: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  promptText: z.string().min(1).max(2000),
  ringCount: z.enum(["none", "one", "two"]).optional(),
  ringPosition: z.enum(["left", "right", "first-letter"]).optional(),
  enforceRings: z.boolean().optional(),
  enabled: z.boolean().optional(),
  slug: z.string().min(1).max(60).optional(),
});

export async function GET() {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  await ensureCatalog();
  const rows = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { references: true },
  });
  return json({ categories: rows.map(adminCategory) });
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  await ensureCatalog();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Geçersiz kategori");
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  let slug = parsed.data.slug?.trim() || slugify(parsed.data.label);
  const clash = await prisma.category.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  const created = await prisma.category.create({
    data: {
      slug,
      label: parsed.data.label.trim(),
      description: parsed.data.description?.trim() ?? "",
      promptText: parsed.data.promptText.trim(),
      ringCount: parsed.data.ringCount ?? "two",
      ringPosition: parsed.data.ringPosition ?? "left",
      enforceRings: parsed.data.enforceRings ?? true,
      enabled: parsed.data.enabled ?? true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    include: { references: true },
  });
  return json({ category: adminCategory(created) }, 201);
}

export async function PUT(request: Request) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const parsed = z.object({ ids: z.array(z.string().min(1)) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Sıra listesi gerekli");
  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.category.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  const rows = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { references: true },
  });
  return json({ categories: rows.map(adminCategory) });
}
