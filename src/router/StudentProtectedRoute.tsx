import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Guards the Student Portal (`/portal/*`). Only a Student-role session may
 * enter — Owner/Staff sessions are bounced to the Admin Dashboard (they use
 * "VIEW AS STUDENT" from a Student Profile to preview the portal instead,
 * a clearly-labeled separate route — see AdminStudentPortalPreview). Same
 * caveat as ProtectedRoute: this is a client-side demo guard, not a
 * substitute for server-side authorization.
 */
export function StudentProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== "Student") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
