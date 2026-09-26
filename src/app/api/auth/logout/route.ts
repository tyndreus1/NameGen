import { clearUserCookie } from "@/lib/auth";
import { json } from "@/lib/api";

export async function POST() {
  await clearUserCookie();
  return json({ ok: true });
}
