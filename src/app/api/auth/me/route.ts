import { getCurrentUser } from "@/lib/auth";
import { apiError, json } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Oturum yok", 401);
  return json(user);
}
