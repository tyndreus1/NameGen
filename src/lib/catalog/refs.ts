import { prisma } from "../db";
import { referencesForBatch } from "../generate/references";
import { referenceDataUrl } from "./storage";
import { ensureCatalog } from "./seed";

export type CatalogRef = {
  id: string;
  writtenName: string | null;
  dataUrl: string;
};

function normalizeName(name: string): string {
  return name.normalize("NFC").trim().toLocaleLowerCase("tr-TR");
}

export async function loadCategoryRefs(
  name: string,
  slug: string,
  count: number,
): Promise<CatalogRef[]> {
  await ensureCatalog();
  if (count <= 0) return [];
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      references: {
        include: { reference: true },
      },
    },
  });
  if (!category) return [];
  const needle = normalizeName(name);
  const picked: CatalogRef[] = [];
  for (const link of category.references) {
    const ref = link.reference;
    if (!ref.enabled) continue;
    const written = ref.writtenName?.normalize("NFC").trim().toLocaleLowerCase("tr-TR");
    if (written && written === needle) continue;
    const dataUrl = referenceDataUrl(ref.id);
    if (!dataUrl) continue;
    picked.push({ id: ref.id, writtenName: ref.writtenName, dataUrl });
    if (picked.length >= count) break;
  }
  return picked;
}

export { referencesForBatch };
