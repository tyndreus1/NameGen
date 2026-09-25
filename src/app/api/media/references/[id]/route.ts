import { readReferenceFile } from "@/lib/catalog/storage";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const row = await prisma.styleReference.findUnique({ where: { id } });
  if (!row) return new Response("Not found", { status: 404 });
  const buf = readReferenceFile(id);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
