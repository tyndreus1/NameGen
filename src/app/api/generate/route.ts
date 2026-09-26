import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, json } from "@/lib/api";
import { VARIATION_COUNT } from "@/lib/constants";
import { CreditError, generationCharge, refundGenerationCredits, reserveGenerationCredits } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { generateDesigns } from "@/lib/generate/pipeline";
import { ensureCatalog } from "@/lib/catalog/seed";
import { ticksToUsd } from "@/lib/cost";

const schema = z.object({
  name: z.string().min(1).max(18),
  style: z.string().min(1).max(60),
});

export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Giriş yapmalısınız", 401);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("İsim ve stil gerekli");
  }

  let reserved = false;
  try {
    await ensureCatalog();
    const category = await prisma.category.findFirst({
      where: { slug: parsed.data.style, enabled: true },
    });
    if (!category) return apiError("Geçersiz veya kapalı stil");

    const cost = await generationCharge();
    const creditsAfterReserve = await reserveGenerationCredits(user.id);
    reserved = true;

    const result = await generateDesigns(parsed.data.name, category.slug, VARIATION_COUNT);
    const apiCostUsd = result.apiCostUsd > 0 ? result.apiCostUsd : ticksToUsd(result.apiCostTicks);
    await prisma.generation.create({
      data: {
        userId: user.id,
        name: parsed.data.name.normalize("NFC").trim(),
        style: parsed.data.style,
        count: result.designs.length,
        grokAccepted: result.grokAccepted,
        fallbackCount: result.fallbackCount,
        attempts: result.attempts,
        apiCostUsd,
        apiCostTicks: BigInt(result.apiCostTicks),
        imageModel: result.imageModel,
        usedRefs: JSON.stringify(result.usedRefs),
      },
    });

    return json({
      credits: creditsAfterReserve,
      cost,
      usedGrok: result.usedGrok,
      grokAttempted: result.grokAttempted,
      grokAccepted: result.grokAccepted,
      fallbackCount: result.fallbackCount,
      apiCostUsd,
      apiCostTicks: result.apiCostTicks,
      designs: result.designs.map((design) => ({
        index: design.index,
        engine: design.engine,
        fallback: Boolean(design.fallback),
        components: design.components,
        png: design.png.toString("base64"),
        svg: design.svg,
      })),
    });
  } catch (error) {
    if (reserved) {
      await refundGenerationCredits(user.id).catch(() => undefined);
    }
    if (error instanceof CreditError) {
      return apiError(error.message, 402, { code: error.code });
    }
    const message = error instanceof Error ? error.message : "Üretim başarısız";
    return apiError(message, 500);
  }
}
