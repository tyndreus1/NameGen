import { json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureCatalog } from "@/lib/catalog/seed";
import { publicCategory } from "@/lib/catalog/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureCatalog();
  const rows = await prisma.category.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
    include: {
      references: {
        where: { reference: { enabled: true } },
        include: { reference: true },
      },
    },
  });
  return json({
    categories: rows.map((row) =>
      publicCategory({
        ...row,
        thumbId: row.references[0]?.referenceId ?? null,
      }),
    ),
  });
}
