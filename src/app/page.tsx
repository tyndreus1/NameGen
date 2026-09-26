import { getCurrentUser } from "@/lib/auth";
import { HomeApp } from "@/components/HomeApp";
import { resolveCreditPolicy } from "@/lib/catalog/settings";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [user, credits] = await Promise.all([getCurrentUser(), resolveCreditPolicy()]);
  return (
    <HomeApp
      user={user}
      startingCredits={credits.startingCredits}
      generationCost={credits.generationCost}
    />
  );
}
