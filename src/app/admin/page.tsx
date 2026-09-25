import { isAdminSession } from "@/lib/auth";
import { AdminApp } from "@/components/AdminApp";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return <AdminApp unlocked={await isAdminSession()} />;
}
