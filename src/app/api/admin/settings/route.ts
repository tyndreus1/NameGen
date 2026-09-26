import { z } from "zod";
import { isAdminSession } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { envSettings, resolveGenerationSettings, saveGenerationSettings } from "@/lib/catalog/settings";
import { TECHNICAL_RULES } from "@/lib/generate/prompt";

const patchSchema = z.object({
  imageModel: z.string().min(1).max(80).nullable().optional(),
  quality: z.enum(["low", "medium", "high"]).nullable().optional(),
  refCount: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable().optional(),
  batches: z.number().int().min(1).max(8).nullable().optional(),
  nPerBatch: z.number().int().min(1).max(8).nullable().optional(),
  resolution: z.enum(["1k", "2k"]).nullable().optional(),
  maxRetries: z.number().int().min(0).max(8).nullable().optional(),
  basePrompt: z.string().min(1).max(8000).nullable().optional(),
});

export async function GET() {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  return json({
    settings: await resolveGenerationSettings(),
    envDefaults: envSettings(),
    technicalRules: TECHNICAL_RULES,
  });
}

export async function PUT(request: Request) {
  if (!(await isAdminSession())) return apiError("Yetkisiz", 401);
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Geçersiz ayar");
  const settings = await saveGenerationSettings(parsed.data);
  return json({ settings, envDefaults: envSettings() });
}
