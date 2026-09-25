import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import { STYLE_LABELS, STYLES, type StyleId } from "../constants";
import { STYLE_ORNAMENTS } from "../generate/prompt";
import { REFERENCE_CATALOG } from "../generate/references";
import { writeReferenceFile } from "./storage";

const PREFERENCE: Record<StyleId, string[]> = {
  classic: ["charlotte", "zeynep", "merve", "aleyna"],
  hearts: ["aleyna", "zeynep", "charlotte", "merve"],
  star: ["aleyna", "charlotte", "zeynep", "merve"],
  butterfly: ["sophia", "aleyna", "charlotte", "zeynep"],
  elegant: ["charlotte", "merve", "zeynep", "aleyna"],
};

const DESCRIPTIONS: Record<StyleId, string> = {
  classic: "Kalın akıcı script; süs yok.",
  hearts: "Swash ve kıvrımlarda kalpler.",
  star: "Sağ kıvrımda küçük yıldız.",
  butterfly: "Son harfte kelebek + swash kalbi.",
  elegant: "Zarif / minimal, süs yok.",
};

function bundledPath(file: string): string {
  return path.join(process.cwd(), "assets", "references", file);
}

let seedInflight: Promise<void> | null = null;

export async function ensureCatalog(): Promise<void> {
  if (seedInflight) return seedInflight;
  seedInflight = seedCatalog().finally(() => {
    seedInflight = null;
  });
  return seedInflight;
}

async function seedCatalog(): Promise<void> {
  const existing = await prisma.category.count();
  if (existing > 0) return;

  const refIds: Record<string, string> = {};
  for (const item of REFERENCE_CATALOG) {
    const src = bundledPath(item.file);
    if (!fs.existsSync(src)) continue;
    const created = await prisma.styleReference.create({
      data: {
        filename: item.file,
        writtenName: item.names[0] ?? item.id,
        enabled: true,
        onePiece: true,
      },
    });
    writeReferenceFile(created.id, fs.readFileSync(src));
    refIds[item.id] = created.id;
  }

  for (const [index, slug] of STYLES.entries()) {
    const category = await prisma.category.create({
      data: {
        slug,
        label: STYLE_LABELS[slug],
        description: DESCRIPTIONS[slug],
        promptText: STYLE_ORNAMENTS[slug],
        enabled: true,
        sortOrder: index,
      },
    });
    const assigned = PREFERENCE[slug]
      .map((id) => refIds[id])
      .filter((id): id is string => Boolean(id));
    if (assigned.length) {
      await prisma.categoryReference.createMany({
        data: assigned.map((referenceId) => ({ categoryId: category.id, referenceId })),
      });
    }
  }
}

export function slugify(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `stil-${Date.now()}`;
}
