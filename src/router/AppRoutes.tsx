import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { EnrollmentForm } from "@/pages/EnrollmentForm";
import { NewEnrollments } from "@/pages/students/NewEnrollments";
import { AllStudents } from "@/pages/students/AllStudents";
import { StudentProfile } from "@/pages/students/StudentProfile";
import { ComingSoon } from "@/pages/ComingSoon";
import { ProtectedRoute } from "./ProtectedRoute";
import { NAV_SECTIONS } from "@/data/navigation";

const BUILT_PATHS = new Set(["/dashboard", "/students/all", "/students/new-enrollments"]);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/enroll" element={<EnrollmentForm />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students/all" element={<AllStudents />} />
        <Route path="/students/new-enrollments" element={<NewEnrollments />} />
        <Route path="/students/:studentId" element={<StudentProfile />} />

        {NAV_SECTIONS.flatMap((section) => section.items)
          .filter((item) => !BUILT_PATHS.has(item.path))
          .map((item) => (
            <Route key={item.path} path={item.path} element={<ComingSoon title={item.label} />} />
          ))}

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
