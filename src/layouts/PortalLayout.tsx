import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useStudentStore } from "@/data/studentStore";
import { StudentPortalProvider } from "@/context/StudentPortalContext";
import { StudentSidebar, StudentSidebarDrawer } from "@/components/portal/StudentSidebar";
import { StudentTopHeader } from "@/components/portal/StudentTopHeader";
import { PORTAL_NAV_ITEMS } from "@/data/portalNavigation";

function resolvePageTitle(pathname: string): string {
  if (pathname === "/portal/master-brain/questionnaire") return "My Master Brain";
  if (pathname.startsWith("/portal/ai-tools/tools/")) return "AI Business Tools";
  if (pathname === "/portal/ai-tools/workspace") return "My AI Workspace";
  if (pathname === "/portal/ai-tools/projects" || pathname.startsWith("/portal/ai-tools/projects/")) return "My AI Projects";
  for (const item of PORTAL_NAV_ITEMS) {
    if (item.path === pathname) return item.label;
  }
  return "Home";
}

// Mounts the real (non-preview) Student Portal session. Resolves the
// logged-in student's own record from AuthenticatedUser.linkedStudentId —
// never from a route param — so a student can never view anyone else's
// data by editing the URL. See StudentPortalContext.tsx for why the
// student record flows through context rather than being re-resolved by
// every page.
export function PortalLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { getStudentById } = useStudentStore();

  const student = user?.linkedStudentId ? getStudentById(user.linkedStudentId) : undefined;

  if (!user || user.role !== "Student" || !student) {
    return <Navigate to="/login" replace />;
  }

  const pageTitle = resolvePageTitle(location.pathname);

  return (
    <StudentPortalProvider student={student} isPreview={false}>
      <div className="flex h-screen w-full overflow-hidden bg-maia-bg">
        <StudentSidebar />
        <StudentSidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <StudentTopHeader pageTitle={pageTitle} onMenuClick={() => setDrawerOpen(true)} />
          <main className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </StudentPortalProvider>
  );
}
