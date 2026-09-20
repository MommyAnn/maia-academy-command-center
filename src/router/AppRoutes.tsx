import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { EnrollmentForm } from "@/pages/EnrollmentForm";
import { NewEnrollments } from "@/pages/students/NewEnrollments";
import { AllStudents } from "@/pages/students/AllStudents";
import { Batches } from "@/pages/students/Batches";
import { StudentProfile } from "@/pages/students/StudentProfile";
import { Overview as FinanceOverview } from "@/pages/finance/Overview";
import { Payments } from "@/pages/finance/Payments";
import { Receivables } from "@/pages/finance/Receivables";
import { Expenses } from "@/pages/finance/Expenses";
import { Reports as FinanceReports } from "@/pages/finance/Reports";
import { ComingSoon } from "@/pages/ComingSoon";
import { ProtectedRoute } from "./ProtectedRoute";
import { NAV_SECTIONS } from "@/data/navigation";

const BUILT_PATHS = new Set([
  "/dashboard",
  "/students/all",
  "/students/new-enrollments",
  "/students/batches",
  "/finance/overview",
  "/finance/payments",
  "/finance/receivables",
  "/finance/expenses",
  "/finance/reports",
]);

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
        <Route path="/students/batches" element={<Batches />} />
        <Route path="/students/:studentId" element={<StudentProfile />} />

        <Route path="/finance/overview" element={<FinanceOverview />} />
        <Route path="/finance/payments" element={<Payments />} />
        <Route path="/finance/receivables" element={<Receivables />} />
        <Route path="/finance/expenses" element={<Expenses />} />
        <Route path="/finance/reports" element={<FinanceReports />} />

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
