import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const rows = await prisma.generation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });
  const totalCost = rows.reduce((sum, row) => sum + row.apiCostUsd, 0);
  const totalTicks = rows.reduce((sum, row) => sum + Number(row.apiCostTicks), 0);
  return json({
    totalCost,
    totalTicks,
    generations: rows.map((row) => ({
      id: row.id,
      email: row.user.email,
      name: row.name,
      style: row.style,
      grokAccepted: row.grokAccepted,
      fallbackCount: row.fallbackCount,
      attempts: row.attempts,
      apiCostUsd: row.apiCostUsd,
      apiCostTicks: row.apiCostTicks.toString(),
      imageModel: row.imageModel,
      createdAt: row.createdAt,
    })),
  });
}
