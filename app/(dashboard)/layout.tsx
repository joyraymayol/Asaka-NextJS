import Link from "next/link";
import { verifySession } from "@/lib/dal/session";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: proxy.ts already redirects unauthenticated requests
  // away from this route group, but the DAL is the real authority.
  const session = await verifySession();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-6 border-b px-6 py-3">
        <span className="font-medium">Asaka</span>
        <nav className="flex flex-1 items-center gap-4 text-sm">
          <Link href="/map" className="text-muted-foreground hover:text-foreground">
            Map
          </Link>
          {session.administrator && (
            <>
              <Link href="/admin/users" className="text-muted-foreground hover:text-foreground">
                Users
              </Link>
              <Link href="/admin/devices" className="text-muted-foreground hover:text-foreground">
                Devices
              </Link>
            </>
          )}
        </nav>
        <span className="text-muted-foreground text-sm">{session.name}</span>
        <ThemeToggle />
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </header>
      <main className="relative min-h-0 flex-1">{children}</main>
    </div>
  );
}
