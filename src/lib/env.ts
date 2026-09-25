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
