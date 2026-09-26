import type { Category, StyleReference } from "@prisma/client";

export function publicCategory(category: Category & { thumbId?: string | null }) {
  return {
    id: category.id,
    slug: category.slug,
    label: category.label,
    description: category.description,
    enabled: category.enabled,
    sortOrder: category.sortOrder,
    thumbUrl: category.thumbId ? `/api/media/references/${category.thumbId}` : null,
  };
}

export function adminCategory(
  category: Category & { references?: { referenceId: string }[] },
) {
  return {
    id: category.id,
    slug: category.slug,
    label: category.label,
    description: category.description,
    promptText: category.promptText,
    ringCount: category.ringCount,
    ringPosition: category.ringPosition,
    enforceRings: category.enforceRings,
    enabled: category.enabled,
    sortOrder: category.sortOrder,
    referenceIds: category.references?.map((link) => link.referenceId) ?? [],
  };
}

export function adminReference(
  ref: StyleReference & { categories?: { categoryId: string }[] },
) {
  return {
    id: ref.id,
    filename: ref.filename,
    writtenName: ref.writtenName,
    enabled: ref.enabled,
    onePiece: ref.onePiece,
    warning: ref.warning,
    createdAt: ref.createdAt,
    url: `/api/media/references/${ref.id}`,
    categoryIds: ref.categories?.map((link) => link.categoryId) ?? [],
  };
}
