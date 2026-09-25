function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getCodeSecret(): string {
  return required("CODE_SECRET");
}

export function getSessionSecret(): string {
  return required("SESSION_SECRET");
}

export function getAdminPassword(): string {
  return required("ADMIN_PASSWORD");
}

export function getXaiApiKey(): string | undefined {
  const key = process.env.XAI_API_KEY?.trim();
  return key ? key : undefined;
}

export const DEFAULT_XAI_IMAGE_MODEL = "grok-imagine-image-2.0";

export function getXaiImageModel(): string {
  const model = process.env.XAI_IMAGE_MODEL?.trim();
  return model || DEFAULT_XAI_IMAGE_MODEL;
}

export const DEFAULT_XAI_TEXT_MODEL = "grok-4.6";

export function getXaiTextModel(): string {
  const model = process.env.XAI_TEXT_MODEL?.trim();
  return model || DEFAULT_XAI_TEXT_MODEL;
}

export const XAI_IMAGE_MODELS = [
  "grok-imagine-image",
  "grok-imagine-image-2.0",
  "grok-imagine-image-quality",
] as const;
export type XaiImageModel = (typeof XAI_IMAGE_MODELS)[number];

/** 0 = text-only /images/generations; 1 or 2 = /images/edits with that many refs. */
export function getXaiRefCount(): 0 | 1 | 2 {
  const raw = process.env.XAI_REF_COUNT?.trim();
  if (raw === "0") return 0;
  if (raw === "2") return 2;
  return 1;
}

export function getXaiResolution(): "1k" | "2k" {
  const raw = process.env.XAI_RESOLUTION?.trim().toLowerCase();
  return raw === "2k" ? "2k" : "1k";
}

/** Extra rounds after the first batch. Default 2 (3 rounds max). */
export function getXaiMaxRetries(): number {
  const n = Number.parseInt(process.env.XAI_MAX_RETRIES ?? "", 10);
  if (!Number.isFinite(n) || n < 0) return 2;
  return Math.min(8, n);
}
