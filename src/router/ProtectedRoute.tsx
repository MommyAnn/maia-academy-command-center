import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Guards the Admin/Staff Command Center. A Student-role session is never
 * shown Admin routes — even a direct URL — it's bounced to the Student
 * Portal instead. This is a UI-layer guard only, as this whole build is
 * demo/local: a real production backend must enforce the same rule
 * server-side, since a client-side redirect alone cannot stop a student
 * from calling an API directly.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === "Student") {
    return <Navigate to="/portal" replace />;
  }
  return <>{children}</>;
}
