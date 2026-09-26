import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

process.env.CODE_SECRET ??= "test-code-secret-please-change";
process.env.SESSION_SECRET ??= "test-session-secret-please-change";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.DATABASE_URL ??= "file:./test.db";
process.env.REFERENCE_STORAGE_DIR ??= "data/test-references";

const dbPath = path.join(process.cwd(), "prisma", "test.db");
if (process.env.DATABASE_URL === "file:./test.db") {
  if (!fs.existsSync(dbPath)) {
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
    });
  } else {
    execSync("npx prisma db push --skip-generate", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
    });
  }
}
