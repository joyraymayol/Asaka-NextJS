import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Extra guard on top of the dashboard layout's session check -- still
  // defense in depth only, every DAL write also calls assertAdministrator.
  const session = await verifySession();
  if (!session.administrator) redirect("/map");

  return <div className="p-6">{children}</div>;
}
