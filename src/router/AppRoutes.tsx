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
import { AdminStudentPortalPreview } from "@/pages/students/AdminStudentPortalPreview";
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
import { Announcements as AdminAnnouncements } from "@/pages/communication/Announcements";
import { SupportRequests as AdminSupportRequests } from "@/pages/communication/SupportRequests";
import { Overview as MasterBrainOverview } from "@/pages/masterbrain/Overview";
import { Submissions as MasterBrainSubmissions } from "@/pages/masterbrain/Submissions";
import { SubmissionDetail as MasterBrainSubmissionDetail } from "@/pages/masterbrain/SubmissionDetail";
import { DocumentEditor as MasterBrainDocumentEditor } from "@/pages/masterbrain/DocumentEditor";
import { Templates as MasterBrainTemplates } from "@/pages/masterbrain/Templates";
import { ComingSoon } from "@/pages/ComingSoon";
import { ProtectedRoute } from "./ProtectedRoute";
import { StudentProtectedRoute } from "./StudentProtectedRoute";
import { PortalLayout } from "@/layouts/PortalLayout";
import { Home as PortalHome } from "@/pages/portal/Home";
import { Enrollment as PortalEnrollment } from "@/pages/portal/Enrollment";
import { Payments as PortalPayments } from "@/pages/portal/Payments";
import { Requirements as PortalRequirements } from "@/pages/portal/Requirements";
import { Taobao as PortalTaobao } from "@/pages/portal/Taobao";
import { MasterBrain as PortalMasterBrain } from "@/pages/portal/MasterBrain";
import { Questionnaire as PortalMasterBrainQuestionnaire } from "@/pages/portal/masterBrain/Questionnaire";
import { Training as PortalTraining } from "@/pages/portal/Training";
import { Courses as PortalCourses } from "@/pages/portal/Courses";
import { Certificates as PortalCertificates } from "@/pages/portal/Certificates";
import { Announcements as PortalAnnouncements } from "@/pages/portal/Announcements";
import { Profile as PortalProfile } from "@/pages/portal/Profile";
import { Support as PortalSupport } from "@/pages/portal/Support";
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
  "/communication/announcements",
  "/communication/support-requests",
  "/master-brain/overview",
  "/master-brain/submissions",
  "/master-brain/templates",
]);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/enroll" element={<EnrollmentForm />} />

      <Route
        element={
          <StudentProtectedRoute>
            <PortalLayout />
          </StudentProtectedRoute>
        }
      >
        <Route path="/portal" element={<PortalHome />} />
        <Route path="/portal/enrollment" element={<PortalEnrollment />} />
        <Route path="/portal/payments" element={<PortalPayments />} />
        <Route path="/portal/requirements" element={<PortalRequirements />} />
        <Route path="/portal/taobao" element={<PortalTaobao />} />
        <Route path="/portal/master-brain" element={<PortalMasterBrain />} />
        <Route path="/portal/master-brain/questionnaire" element={<PortalMasterBrainQuestionnaire />} />
        <Route path="/portal/training" element={<PortalTraining />} />
        <Route path="/portal/courses" element={<PortalCourses />} />
        <Route path="/portal/certificates" element={<PortalCertificates />} />
        <Route path="/portal/announcements" element={<PortalAnnouncements />} />
        <Route path="/portal/profile" element={<PortalProfile />} />
        <Route path="/portal/support" element={<PortalSupport />} />
      </Route>

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
        <Route path="/students/:studentId/portal-preview" element={<AdminStudentPortalPreview />} />

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

        <Route path="/communication/announcements" element={<AdminAnnouncements />} />
        <Route path="/communication/support-requests" element={<AdminSupportRequests />} />

        <Route path="/master-brain/overview" element={<MasterBrainOverview />} />
        <Route path="/master-brain/submissions" element={<MasterBrainSubmissions />} />
        <Route path="/master-brain/submissions/:submissionId" element={<MasterBrainSubmissionDetail />} />
        <Route path="/master-brain/submissions/:submissionId/editor/:documentId" element={<MasterBrainDocumentEditor />} />
        <Route path="/master-brain/templates" element={<MasterBrainTemplates />} />

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
