import { verifySession } from "@/lib/dal/session";
import { logout } from "@/app/(auth)/login/actions";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: proxy.ts already redirects unauthenticated requests
  // away from this route group, but the DAL is the real authority.
  const session = await verifySession();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={{ name: session.name, administrator: session.administrator }}
        logoutAction={logout}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="relative min-h-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
