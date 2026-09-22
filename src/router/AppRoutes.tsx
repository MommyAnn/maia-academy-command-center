import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { EnrollmentForm } from "@/pages/EnrollmentForm";
import { WebinarRegistration } from "@/pages/WebinarRegistration";
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
import { Library as CourseLibrary } from "@/pages/courses/Library";
import { CourseBuilder } from "@/pages/courses/CourseBuilder";
import { CourseManage } from "@/pages/courses/CourseManage";
import { StudentAccess as CourseStudentAccess } from "@/pages/courses/StudentAccess";
import { Progress as CourseProgress } from "@/pages/courses/Progress";
import { Resources as CourseResources } from "@/pages/courses/Resources";
import { Overview as FeedbackOverview } from "@/pages/feedback/Overview";
import { Requests as FeedbackRequests } from "@/pages/feedback/Requests";
import { AllFeedback } from "@/pages/feedback/AllFeedback";
import { FeedbackDetail } from "@/pages/feedback/FeedbackDetail";
import { MarketingLibrary } from "@/pages/feedback/MarketingLibrary";
import { Incentives as FeedbackIncentives } from "@/pages/feedback/Incentives";
import { Settings as FeedbackSettings } from "@/pages/feedback/Settings";
import { Dashboard as WebinarDashboard } from "@/pages/webinar/Dashboard";
import { Sessions as WebinarSessions } from "@/pages/webinar/Sessions";
import { Registrations as WebinarRegistrations } from "@/pages/webinar/Registrations";
import { Attendance as WebinarAttendance } from "@/pages/webinar/Attendance";
import { Pipeline as WebinarPipeline } from "@/pages/webinar/Pipeline";
import { LeadProfile as WebinarLeadProfile } from "@/pages/webinar/LeadProfile";
import { FollowUps as WebinarFollowUps } from "@/pages/webinar/FollowUps";
import { Conversion as WebinarConversion } from "@/pages/webinar/Conversion";
import { Feedback as WebinarFeedback } from "@/pages/webinar/Feedback";
import { Reports as WebinarReports } from "@/pages/webinar/Reports";
import { WebinarFeedbackSubmit } from "@/pages/WebinarFeedbackSubmit";
import { Center as CommunicationCenter } from "@/pages/communications/Center";
import { AutomationCenter } from "@/pages/communications/AutomationCenter";
import { AutomationRules } from "@/pages/communications/AutomationRules";
import { GhlIntegration } from "@/pages/communications/GhlIntegration";
import { ContactSync } from "@/pages/communications/ContactSync";
import { Templates as CommunicationTemplates } from "@/pages/communications/Templates";
import { Logs as CommunicationLogs } from "@/pages/communications/Logs";
import { SyncLogs } from "@/pages/communications/SyncLogs";
import { Settings as CommunicationSettings } from "@/pages/communications/Settings";
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
import { CoursePage as PortalCoursePage } from "@/pages/portal/CoursePage";
import { LessonPlayer as PortalLessonPlayer } from "@/pages/portal/LessonPlayer";
import { Certificates as PortalCertificates } from "@/pages/portal/Certificates";
import { Feedback as PortalFeedback } from "@/pages/portal/Feedback";
import { FeedbackSubmit as PortalFeedbackSubmit } from "@/pages/portal/FeedbackSubmit";
import { Announcements as PortalAnnouncements } from "@/pages/portal/Announcements";
import { Profile as PortalProfile } from "@/pages/portal/Profile";
import { Support as PortalSupport } from "@/pages/portal/Support";
import { Hub as PortalAiToolsHub } from "@/pages/portal/aiTools/Hub";
import { ToolRunner as PortalAiToolRunner } from "@/pages/portal/aiTools/ToolRunner";
import { Workspace as PortalAiWorkspace } from "@/pages/portal/aiTools/Workspace";
import { Projects as PortalAiProjects } from "@/pages/portal/aiTools/Projects";
import { ProjectDetail as PortalAiProjectDetail } from "@/pages/portal/aiTools/ProjectDetail";
import { Dashboard as AiToolsDashboard } from "@/pages/aiTools/Dashboard";
import { ToolLibrary as AiToolsLibrary } from "@/pages/aiTools/ToolLibrary";
import { ToolAccess as AiToolsAccess } from "@/pages/aiTools/ToolAccess";
import { Projects as AiToolsProjects } from "@/pages/aiTools/Projects";
import { Usage as AiToolsUsage } from "@/pages/aiTools/Usage";
import { PromptManager as AiToolsPromptManager } from "@/pages/aiTools/PromptManager";
import { Connections as AiToolsConnections } from "@/pages/aiTools/Connections";
import { Activity as AiToolsActivity } from "@/pages/aiTools/Activity";
import { Settings as AiToolsSettings } from "@/pages/aiTools/Settings";
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
  "/courses/library",
  "/courses/builder",
  "/courses/access",
  "/courses/progress",
  "/courses/resources",
  "/feedback/overview",
  "/feedback/requests",
  "/feedback/all",
  "/feedback/marketing-library",
  "/feedback/incentives",
  "/feedback/settings",
  "/webinar/dashboard",
  "/webinar/sessions",
  "/webinar/registrations",
  "/webinar/attendance",
  "/webinar/pipeline",
  "/webinar/follow-ups",
  "/webinar/conversion",
  "/webinar/feedback",
  "/webinar/reports",
  "/communications/center",
  "/communications/automation",
  "/communications/automation-rules",
  "/communications/ghl-integration",
  "/communications/contact-sync",
  "/communications/templates",
  "/communications/logs",
  "/communications/sync-logs",
  "/communications/settings",
  "/ai-tools/dashboard",
  "/ai-tools/library",
  "/ai-tools/access",
  "/ai-tools/projects",
  "/ai-tools/usage",
  "/ai-tools/prompts",
  "/ai-tools/connections",
  "/ai-tools/activity",
  "/ai-tools/settings",
]);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/enroll" element={<EnrollmentForm />} />
      <Route path="/webinar/register" element={<WebinarRegistration />} />
      <Route path="/webinar/feedback-form/:requestId" element={<WebinarFeedbackSubmit />} />

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
        <Route path="/portal/courses/:courseId" element={<PortalCoursePage />} />
        <Route path="/portal/courses/:courseId/lessons/:lessonId" element={<PortalLessonPlayer />} />
        <Route path="/portal/certificates" element={<PortalCertificates />} />
        <Route path="/portal/feedback" element={<PortalFeedback />} />
        <Route path="/portal/feedback/:requestId" element={<PortalFeedbackSubmit />} />
        <Route path="/portal/announcements" element={<PortalAnnouncements />} />
        <Route path="/portal/profile" element={<PortalProfile />} />
        <Route path="/portal/support" element={<PortalSupport />} />
        <Route path="/portal/ai-tools" element={<PortalAiToolsHub />} />
        <Route path="/portal/ai-tools/tools/:toolId" element={<PortalAiToolRunner />} />
        <Route path="/portal/ai-tools/workspace" element={<PortalAiWorkspace />} />
        <Route path="/portal/ai-tools/projects" element={<PortalAiProjects />} />
        <Route path="/portal/ai-tools/projects/:projectId" element={<PortalAiProjectDetail />} />
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

        <Route path="/courses/library" element={<CourseLibrary />} />
        <Route path="/courses/builder" element={<CourseBuilder />} />
        <Route path="/courses/access" element={<CourseStudentAccess />} />
        <Route path="/courses/progress" element={<CourseProgress />} />
        <Route path="/courses/resources" element={<CourseResources />} />
        <Route path="/courses/:courseId/edit" element={<CourseBuilder />} />
        <Route path="/courses/:courseId" element={<CourseManage />} />

        <Route path="/feedback/overview" element={<FeedbackOverview />} />
        <Route path="/feedback/requests" element={<FeedbackRequests />} />
        <Route path="/feedback/all" element={<AllFeedback />} />
        <Route path="/feedback/all/:feedbackId" element={<FeedbackDetail />} />
        <Route path="/feedback/marketing-library" element={<MarketingLibrary />} />
        <Route path="/feedback/incentives" element={<FeedbackIncentives />} />
        <Route path="/feedback/settings" element={<FeedbackSettings />} />

        <Route path="/webinar/dashboard" element={<WebinarDashboard />} />
        <Route path="/webinar/sessions" element={<WebinarSessions />} />
        <Route path="/webinar/registrations" element={<WebinarRegistrations />} />
        <Route path="/webinar/attendance" element={<WebinarAttendance />} />
        <Route path="/webinar/pipeline" element={<WebinarPipeline />} />
        <Route path="/webinar/leads/:leadId" element={<WebinarLeadProfile />} />
        <Route path="/webinar/follow-ups" element={<WebinarFollowUps />} />
        <Route path="/webinar/conversion" element={<WebinarConversion />} />
        <Route path="/webinar/feedback" element={<WebinarFeedback />} />
        <Route path="/webinar/reports" element={<WebinarReports />} />

        <Route path="/communications/center" element={<CommunicationCenter />} />
        <Route path="/communications/automation" element={<AutomationCenter />} />
        <Route path="/communications/automation-rules" element={<AutomationRules />} />
        <Route path="/communications/ghl-integration" element={<GhlIntegration />} />
        <Route path="/communications/contact-sync" element={<ContactSync />} />
        <Route path="/communications/templates" element={<CommunicationTemplates />} />
        <Route path="/communications/logs" element={<CommunicationLogs />} />
        <Route path="/communications/sync-logs" element={<SyncLogs />} />
        <Route path="/communications/settings" element={<CommunicationSettings />} />

        <Route path="/ai-tools/dashboard" element={<AiToolsDashboard />} />
        <Route path="/ai-tools/library" element={<AiToolsLibrary />} />
        <Route path="/ai-tools/access" element={<AiToolsAccess />} />
        <Route path="/ai-tools/projects" element={<AiToolsProjects />} />
        <Route path="/ai-tools/usage" element={<AiToolsUsage />} />
        <Route path="/ai-tools/prompts" element={<AiToolsPromptManager />} />
        <Route path="/ai-tools/connections" element={<AiToolsConnections />} />
        <Route path="/ai-tools/activity" element={<AiToolsActivity />} />
        <Route path="/ai-tools/settings" element={<AiToolsSettings />} />

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
