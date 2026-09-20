import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { ComingSoon } from "@/pages/ComingSoon";
import { ProtectedRoute } from "./ProtectedRoute";
import { NAV_SECTIONS } from "@/data/navigation";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        {NAV_SECTIONS.flatMap((section) => section.items)
          .filter((item) => item.path !== "/dashboard")
          .map((item) => (
            <Route key={item.path} path={item.path} element={<ComingSoon title={item.label} />} />
          ))}

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
