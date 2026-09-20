import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, SidebarDrawer } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { NAV_SECTIONS } from "@/data/navigation";

function resolvePageTitle(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.path === pathname) return item.label;
    }
  }
  return "Dashboard";
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const pageTitle = resolvePageTitle(location.pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-maia-bg">
      <Sidebar />
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader pageTitle={pageTitle} onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
