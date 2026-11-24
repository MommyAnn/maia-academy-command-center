import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { VcAuthProvider, useVcAuth } from "./auth";
import { AdminLayout, CustomerLayout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from "./pages/AuthPages";
import { DashboardPage } from "./pages/DashboardPage";
import { CreateVideoPage } from "./pages/CreateVideoPage";
import { VideoDetailPage } from "./pages/VideoDetailPage";
import { MyVideosPage } from "./pages/MyVideosPage";
import { CreditsPage } from "./pages/CreditsPage";
import { AccountPage } from "./pages/AccountPage";
import { HelpPage } from "./pages/HelpPage";
import { AdminOverviewPage } from "./admin/AdminOverviewPage";
import { AdminCustomersPage } from "./admin/AdminCustomersPage";
import { AdminJobsPage } from "./admin/AdminJobsPage";
import { AdminSettingsPage } from "./admin/AdminSettingsPage";
import { AdminAuditPage } from "./admin/AdminAuditPage";

function RequireUser({ role, children }: { role: "customer" | "staff" | "any"; children: ReactNode }) {
  const { user, loading, isStaff } = useVcAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/studio/login" replace state={{ from: location.pathname }} />;
  if (role === "customer" && isStaff) return <Navigate to="/studio/admin" replace />;
  if (role === "staff" && !isStaff) return <Navigate to="/studio" replace />;
  return <>{children}</>;
}

function AccountRoute() {
  const { isStaff } = useVcAuth();
  return isStaff ? <AdminLayout /> : <CustomerLayout />;
}

export function VideoCreatorApp() {
  useEffect(() => {
    const prev = document.title;
    document.title = "M.A.I.A. AI Video Creator";
    document.documentElement.style.background = "#0A0908";
    return () => {
      document.title = prev;
      document.documentElement.style.background = "";
    };
  }, []);

  return (
    <VcAuthProvider>
      <div className="min-h-full bg-vc-black">
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireUser role="customer"><CustomerLayout /></RequireUser>}>
            <Route index element={<DashboardPage />} />
            <Route path="create" element={<CreateVideoPage />} />
            <Route path="videos" element={<MyVideosPage />} />
            <Route path="videos/:id" element={<VideoDetailPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>

          <Route element={<RequireUser role="any"><AccountRoute /></RequireUser>}>
            <Route path="account" element={<AccountPage />} />
          </Route>

          <Route path="admin" element={<RequireUser role="staff"><AdminLayout /></RequireUser>}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="jobs" element={<AdminJobsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Routes>
      </div>
    </VcAuthProvider>
  );
}
