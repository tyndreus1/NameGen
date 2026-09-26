import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ticksToUsd } from "@/lib/cost";

export async function GET() {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const [rows, categories] = await Promise.all([
    prisma.generation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true } } },
    }),
    prisma.category.findMany({ select: { slug: true, label: true } }),
  ]);
  const labels = new Map(categories.map((row) => [row.slug, row.label]));
  const totalCost = rows.reduce(
    (sum, row) => sum + (row.apiCostUsd > 0 ? row.apiCostUsd : ticksToUsd(row.apiCostTicks)),
    0,
  );
  const totalTicks = rows.reduce((sum, row) => sum + Number(row.apiCostTicks), 0);
  return json({
    totalCost,
    totalTicks,
    generations: rows.map((row) => {
      let usedRefs: { id: string; writtenName: string | null; filename: string }[] = [];
      try {
        const parsed = JSON.parse(row.usedRefs || "[]");
        if (Array.isArray(parsed)) usedRefs = parsed;
      } catch {
        usedRefs = [];
      }
      return {
        id: row.id,
        email: row.user.email,
        name: row.name,
        style: row.style,
        categoryLabel: labels.get(row.style) ?? row.style,
        grokAccepted: row.grokAccepted,
        fallbackCount: row.fallbackCount,
        attempts: row.attempts,
        apiCostUsd: row.apiCostUsd > 0 ? row.apiCostUsd : ticksToUsd(row.apiCostTicks),
        apiCostTicks: row.apiCostTicks.toString(),
        imageModel: row.imageModel,
        usedRefs: usedRefs.map((ref) => ({
          ...ref,
          url: `/api/media/references/${ref.id}`,
        })),
        createdAt: row.createdAt,
      };
    }),
  });
}
