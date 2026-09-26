#!/usr/bin/env tsx
import "dotenv/config";
import { isCodeValue, signCode } from "../src/lib/codes";
import { prisma } from "../src/lib/db";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return fallback;
}

async function main() {
  const secret = process.env.CODE_SECRET;
  if (!secret) {
    console.error("CODE_SECRET is required");
    process.exit(1);
  }
  const credits = Number(arg("value", "60"));
  const count = Number(arg("count", "1"));
  if (!isCodeValue(credits)) {
    console.error("--value must be 60, 120, or 240");
    process.exit(1);
  }
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    console.error("--count must be 1-100");
    process.exit(1);
  }

  const persist = process.argv.includes("--persist") || process.argv.includes("--save");
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = signCode(secret, credits);
    codes.push(code);
    if (persist) {
      await prisma.creditCode.create({ data: { code, credits } });
    }
    console.log(code);
  }

  if (persist) {
    console.error(`Saved ${codes.length} code(s) of ${credits} credits to the database.`);
  } else {
    console.error("Printed only. Re-run with --persist to store them for redemption.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
