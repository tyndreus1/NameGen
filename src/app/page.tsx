import { getCurrentUser } from "@/lib/auth";
import { HomeApp } from "@/components/HomeApp";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  return <HomeApp user={user} />;
}
