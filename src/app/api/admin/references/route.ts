import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureCatalog } from "@/lib/catalog/seed";
import { adminReference } from "@/lib/catalog/serialize";
import { cleanReferenceUpload, writeReferenceFile } from "@/lib/catalog/storage";

export async function GET() {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  await ensureCatalog();
  const rows = await prisma.styleReference.findMany({
    orderBy: { createdAt: "desc" },
    include: { categories: true },
  });
  return json({ references: rows.map(adminReference) });
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  await ensureCatalog();
  const form = await request.formData().catch(() => null);
  if (!form) return apiError("Dosya gerekli");
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length) return apiError("En az bir PNG/JPG yükleyin");
  const writtenName = String(form.get("writtenName") ?? "").trim() || null;
  const created = [];
  const warnings: string[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const cleaned = await cleanReferenceUpload(buf);
    const row = await prisma.styleReference.create({
      data: {
        filename: file.name || "reference.png",
        writtenName,
        enabled: true,
        onePiece: cleaned.onePiece,
        warning: cleaned.warning,
      },
      include: { categories: true },
    });
    writeReferenceFile(row.id, cleaned.png);
    created.push(adminReference(row));
    if (cleaned.warning) warnings.push(`${file.name}: ${cleaned.warning}`);
  }
  return json({ references: created, warnings }, 201);
}
