import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { EnrollmentForm } from "@/pages/EnrollmentForm";
import { NewEnrollments } from "@/pages/students/NewEnrollments";
import { AllStudents } from "@/pages/students/AllStudents";
import { Batches } from "@/pages/students/Batches";
import { BatchDetail } from "@/pages/students/BatchDetail";
import { StudentProfile } from "@/pages/students/StudentProfile";
import { Overview as FinanceOverview } from "@/pages/finance/Overview";
import { Payments } from "@/pages/finance/Payments";
import { Receivables } from "@/pages/finance/Receivables";
import { Expenses } from "@/pages/finance/Expenses";
import { Reports as FinanceReports } from "@/pages/finance/Reports";
import { StaffManagement } from "@/pages/team/StaffManagement";
import { StaffProfile } from "@/pages/team/StaffProfile";
import { StaffDashboardPreview } from "@/pages/team/StaffDashboardPreview";
import { TaskManagement } from "@/pages/team/TaskManagement";
import { TaskDetail } from "@/pages/team/TaskDetail";
import { TeamCalendar } from "@/pages/team/TeamCalendar";
import { Workload } from "@/pages/team/Workload";
import { ActivityLog } from "@/pages/team/ActivityLog";
import { AllItems } from "@/pages/inventory/AllItems";
import { StockIn } from "@/pages/inventory/StockIn";
import { StockOut } from "@/pages/inventory/StockOut";
import { LowStock } from "@/pages/inventory/LowStock";
import { Suppliers } from "@/pages/inventory/Suppliers";
import { InventoryHistory } from "@/pages/inventory/InventoryHistory";
import { TrainingSessions } from "@/pages/training/TrainingSessions";
import { SessionDetail } from "@/pages/training/SessionDetail";
import { Attendance } from "@/pages/training/Attendance";
import { Certificates } from "@/pages/training/Certificates";
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
  "/team/staff",
  "/team/tasks",
  "/team/calendar",
  "/team/workload",
  "/team/activity",
  "/inventory/all-items",
  "/inventory/stock-in",
  "/inventory/stock-out",
  "/inventory/low-stock",
  "/inventory/suppliers",
  "/inventory/history",
  "/training/sessions",
  "/training/attendance",
  "/training/certificates",
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
        <Route path="/students/batches/:batch" element={<BatchDetail />} />
        <Route path="/students/:studentId" element={<StudentProfile />} />

        <Route path="/finance/overview" element={<FinanceOverview />} />
        <Route path="/finance/payments" element={<Payments />} />
        <Route path="/finance/receivables" element={<Receivables />} />
        <Route path="/finance/expenses" element={<Expenses />} />
        <Route path="/finance/reports" element={<FinanceReports />} />

        <Route path="/team/staff" element={<StaffManagement />} />
        <Route path="/team/staff/:staffId" element={<StaffProfile />} />
        <Route path="/team/staff/:staffId/dashboard" element={<StaffDashboardPreview />} />
        <Route path="/team/tasks" element={<TaskManagement />} />
        <Route path="/team/tasks/:taskId" element={<TaskDetail />} />
        <Route path="/team/calendar" element={<TeamCalendar />} />
        <Route path="/team/workload" element={<Workload />} />
        <Route path="/team/activity" element={<ActivityLog />} />

        <Route path="/inventory/all-items" element={<AllItems />} />
        <Route path="/inventory/stock-in" element={<StockIn />} />
        <Route path="/inventory/stock-out" element={<StockOut />} />
        <Route path="/inventory/low-stock" element={<LowStock />} />
        <Route path="/inventory/suppliers" element={<Suppliers />} />
        <Route path="/inventory/history" element={<InventoryHistory />} />

        <Route path="/training/sessions" element={<TrainingSessions />} />
        <Route path="/training/sessions/:sessionId" element={<SessionDetail />} />
        <Route path="/training/attendance" element={<Attendance />} />
        <Route path="/training/certificates" element={<Certificates />} />

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
