import { json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureCatalog } from "@/lib/catalog/seed";
import { publicCategory } from "@/lib/catalog/serialize";
import { resolveCreditPolicy } from "@/lib/catalog/settings";

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
    credits: await resolveCreditPolicy(),
    categories: rows.map((row, index) => {
      const refs = row.references;
      const thumb = refs.length ? refs[index % refs.length] : undefined;
      return publicCategory({
        ...row,
        thumbId: thumb?.referenceId ?? null,
      });
    }),
  });
}
