import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  BanknoteArrowDown,
  BanknoteArrowUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { useTaskStore } from "@/data/taskStore";
import { useInventoryStore } from "@/data/inventoryStore";
import { useTrainingStore } from "@/data/trainingStore";
import { usePortalStore } from "@/data/portalStore";
import { useLmsStore } from "@/data/lmsStore";
import { useFeedbackStore } from "@/data/feedbackStore";
import { useWebinarStore } from "@/data/webinarStore";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { FinanceDateFilter, DEFAULT_DATE_FILTER } from "@/components/finance/FinanceDateFilter";
import { ActionCenterCard, ACTION_CENTER_ICONS, type ActionCenterItem } from "@/components/dashboard/ActionCenterCard";
import { CurrentBatchPerformanceCard } from "@/components/dashboard/CurrentBatchPerformanceCard";
import { EnrollmentAnalyticsCard } from "@/components/dashboard/EnrollmentAnalyticsCard";
import { FinancialPerformanceCard } from "@/components/dashboard/FinancialPerformanceCard";
import { CollectionsByBatchTable } from "@/components/dashboard/CollectionsByBatchTable";
import { StudentPipelineCard } from "@/components/dashboard/StudentPipelineCard";
import { StatusBreakdownCard } from "@/components/dashboard/StatusBreakdownCard";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { StaffTaskSnapshotCard } from "@/components/dashboard/StaffTaskSnapshotCard";
import { InventorySnapshotCard } from "@/components/dashboard/InventorySnapshotCard";
import { TrainingAttendanceSnapshotCard } from "@/components/dashboard/TrainingAttendanceSnapshotCard";
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { StudentPortalSnapshotCard } from "@/components/dashboard/StudentPortalSnapshotCard";
import { LmsFeedbackSnapshotCard } from "@/components/dashboard/LmsFeedbackSnapshotCard";
import { WebinarFunnelSnapshotCard } from "@/components/dashboard/WebinarFunnelSnapshotCard";
import { CommunicationsSnapshotCard } from "@/components/dashboard/CommunicationsSnapshotCard";
import { AiToolsSnapshotCard } from "@/components/dashboard/AiToolsSnapshotCard";
import { ProductionBackendKpiCard } from "@/components/dashboard/ProductionBackendKpiCard";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import {
  getActionCenterCounts,
  getMasterBrainCounts,
  getPaymentStatusBreakdown,
  getRequirementsCounts,
  getTaobaoCounts,
  getTodaysActivity,
} from "@/utils/dashboard";
import { getTaskSnapshot } from "@/utils/staffTasks";
import { getCurrentStock, getInventoryItemStatus, getInventoryValue } from "@/utils/inventory";
import {
  getNetCash,
  getTotalExpenses,
  getTotalReceivables,
  getTotalVerifiedCollections,
  matchesDateFilter,
} from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { computeCourseProgress } from "@/utils/lms";
import { isAttendedStatus, isFollowUpOverdue, isHighIntentLead } from "@/utils/webinar";
import type { Batch } from "@/types/student";

const MASTER_BRAIN_COLORS: Record<string, string> = {
  "Not Started": "#c7c2b3",
  "In Progress": "#3b6ea8",
  Submitted: "#b3781c",
  "Under Review": "#c8a44d",
  "Needs Revision": "#b3402f",
  "Approved for Generation": "#3b6ea8",
  Generating: "#3b6ea8",
  "Draft Ready": "#c8a44d",
  "Final Review": "#c8a44d",
  Completed: "#2f7d5a",
  Published: "#2f7d5a",
};

const TAOBAO_COLORS: Record<string, string> = {
  "Not Yet Created": "#c7c2b3",
  "For Account Creation": "#b3781c",
  "Login Details Ready": "#3b6ea8",
  "Login Details Given to Student": "#2f7d5a",
};

const REQUIREMENTS_COLORS: Record<string, string> = {
  Verified: "#2f7d5a",
  "For Verification": "#b3781c",
  "Needs Resubmission": "#b3402f",
  Missing: "#c7c2b3",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  "Fully Paid": "#2f7d5a",
  "Partial Payment": "#b3781c",
  Unpaid: "#b3402f",
  "Pending Verification": "#3b6ea8",
};

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { students } = useStudentStore();
  const { transactions, adjustments, expenses } = useFinanceStore();
  const { tasks } = useTaskStore();
  const { items: inventoryItems, transactions: inventoryTransactions } = useInventoryStore();
  const { sessions, enrollments, certificates } = useTrainingStore();
  const { getPortalAccess, updateRequests, supportRequests } = usePortalStore();
  const { courses: lmsCourses, lessons: lmsLessons, lessonProgress } = useLmsStore();
  const { submissions: feedbackSubmissions } = useFeedbackStore();
  const { sessions: webinarSessions, leads: webinarLeads, registrations: webinarRegistrations, followUps: webinarFollowUps } = useWebinarStore();
  const { automationRules, communicationLogs, syncLogs } = useCommunicationsStore();
  const { generations: aiGenerations, projects: aiProjects } = useAiToolsStore();
  const aiActiveUsers = new Set(aiGenerations.map((g) => g.studentId)).size;
  const aiFailedGenerations = aiGenerations.filter((g) => g.status === "Failed").length;

  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
  const [batch, setBatch] = useState("all");

  const scopedStudents = useMemo(
    () => (batch === "all" ? students : students.filter((s) => s.batch === batch)),
    [students, batch],
  );
  const scopedTransactions = useMemo(
    () => (batch === "all" ? transactions : transactions.filter((t) => t.batch === batch)),
    [transactions, batch],
  );
  const scopedExpenses = useMemo(
    () => (batch === "all" ? expenses : expenses.filter((e) => e.relatedBatch === batch)),
    [expenses, batch],
  );

  const rangedTransactions = useMemo(
    () => scopedTransactions.filter((t) => matchesDateFilter(t.date, dateFilter)),
    [scopedTransactions, dateFilter],
  );
  const rangedExpenses = useMemo(
    () => scopedExpenses.filter((e) => matchesDateFilter(e.date, dateFilter)),
    [scopedExpenses, dateFilter],
  );
  const newEnrollmentsInRange = useMemo(
    () => scopedStudents.filter((s) => matchesDateFilter(s.dateSubmitted, dateFilter)),
    [scopedStudents, dateFilter],
  );

  const totalCollections = getTotalVerifiedCollections(rangedTransactions);
  const totalReceivables = getTotalReceivables(scopedStudents, transactions, adjustments);
  const totalExpensesInRange = getTotalExpenses(rangedExpenses);
  const netCash = getNetCash(totalCollections, totalExpensesInRange);
  const collectionsThisMonth = getTotalVerifiedCollections(
    scopedTransactions.filter((t) => matchesDateFilter(t.date, { preset: "this_month" })),
  );
  const pendingVerificationCount = scopedStudents.filter((s) => s.enrollmentStatus === "Pending Verification").length;
  const activeBatchStudents = scopedStudents.filter((s) => s.enrollmentStatus === "Active Student").length;
  const newThisMonth = scopedStudents.filter((s) => matchesDateFilter(s.dateSubmitted, { preset: "this_month" })).length;

  const currentBatch: Batch = batch === "all" ? BATCH_OPTIONS[0] : (batch as Batch);

  const masterBrainCounts = getMasterBrainCounts(scopedStudents);
  const taobaoCounts = getTaobaoCounts(scopedStudents);
  const requirementsCounts = getRequirementsCounts(scopedStudents);
  const paymentBreakdown = getPaymentStatusBreakdown(scopedStudents, transactions, adjustments);
  const actionCounts = getActionCenterCounts(scopedStudents, transactions, adjustments);
  const taskSnapshot = getTaskSnapshot(tasks);
  const priorityTasks = [...tasks]
    .filter((t) => t.status !== "Completed" && t.status !== "Cancelled")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);
  const todaysActivity = getTodaysActivity(scopedStudents, scopedExpenses).map((a) => ({
    id: a.id,
    message: a.message,
    timestamp: a.timestamp,
  }));

  const inventoryRows = inventoryItems.map((item) => {
    const stock = getCurrentStock(item.id, inventoryTransactions);
    return { item, stock, status: getInventoryItemStatus(item, stock) };
  });
  const lowStockRows = inventoryRows.filter((r) => r.status === "Low Stock" || r.status === "Out of Stock");
  const inventorySnapshot = {
    totalItems: inventoryItems.length,
    lowStock: inventoryRows.filter((r) => r.status === "Low Stock").length,
    outOfStock: inventoryRows.filter((r) => r.status === "Out of Stock").length,
    inventoryValue: getInventoryValue(inventoryItems, inventoryTransactions),
  };
  const lowStockAlerts = lowStockRows.map((r) => ({
    id: r.item.id,
    item: r.item.name,
    remaining: r.stock,
    reorderLevel: r.item.reorderLevel,
  }));

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingSessions = sessions.filter((s) => s.status === "Scheduled" && s.date >= todayIso).length;
  const sessionsThisMonth = sessions.filter((s) => matchesDateFilter(s.date, { preset: "this_month" })).length;
  const todaysSessionIds = new Set(sessions.filter((s) => s.date === todayIso).map((s) => s.id));
  const todaysEnrollments = enrollments.filter((e) => todaysSessionIds.has(e.sessionId));
  const expectedToday = todaysEnrollments.length;
  const checkedInToday = todaysEnrollments.filter((e) =>
    ["Present", "Late", "Online Attended"].includes(e.attendanceStatus),
  ).length;
  const absentToday = todaysEnrollments.filter((e) => e.attendanceStatus === "Absent").length;

  const attendancePending = enrollments.filter((e) => {
    const session = sessions.find((s) => s.id === e.sessionId);
    return session && session.date <= todayIso && session.status !== "Cancelled" && e.attendanceStatus === "Registered";
  }).length;
  const certsForPrep = certificates.filter((c) => c.status === "For Preparation").length;
  const certsReady = certificates.filter((c) => c.status === "Ready").length;
  const certsIssued = certificates.filter((c) => c.status === "Issued").length;

  const publishedCourses = lmsCourses.filter((c) => c.status === "Published");
  const scopedCourseProgress = scopedStudents.flatMap((s) =>
    publishedCourses.map((c) => computeCourseProgress(s.id, c.id, lmsLessons, lessonProgress)),
  );
  const coursesActive = publishedCourses.length;
  const studentsLearning = new Set(
    scopedStudents
      .filter((s) => publishedCourses.some((c) => computeCourseProgress(s.id, c.id, lmsLessons, lessonProgress).status === "In Progress"))
      .map((s) => s.id),
  ).size;
  const coursesCompletedCount = scopedCourseProgress.filter((p) => p.status === "Completed").length;
  const scopedFeedback = feedbackSubmissions.filter((s) => !s.isDraft && scopedStudents.some((st) => st.id === s.studentId));
  const feedbackReceivedCount = scopedFeedback.length;
  const videoTestimonialsCount = scopedFeedback.filter((s) => s.videoAsset).length;
  const testimonialsForReviewCount = scopedFeedback.filter((s) => s.status === "Submitted").length;

  const portalAccountsActive = scopedStudents.filter((s) => getPortalAccess(s.id).activated).length;
  const neverLoggedIn = scopedStudents.filter((s) => getPortalAccess(s.id).lastLogin === null).length;
  const pendingStudentActions = updateRequests.filter(
    (r) => r.status === "Pending" && scopedStudents.some((s) => s.id === r.studentId),
  ).length;
  const openSupportRequests = supportRequests.filter(
    (r) => r.status === "Open" && scopedStudents.some((s) => s.id === r.studentId),
  ).length;
  const masterBrainNotStarted = masterBrainCounts["Not Started"] ?? 0;

  const webinarUpcoming = webinarSessions.filter((s) => s.status === "Open for Registration" || s.status === "Registration Closed").length;
  const webinarRegistrationsCount = webinarRegistrations.length;
  const webinarAttended = webinarRegistrations.filter((r) => isAttendedStatus(r.attendanceStatus)).length;
  const webinarInterested = webinarLeads.filter((l) => l.status === "Interested").length;
  const webinarReservationsPaid = webinarLeads.filter((l) => l.status === "Reservation Paid").length;
  const webinarEnrolled = webinarLeads.filter((l) => l.status === "Enrolled" || l.convertedToStudentId).length;
  const webinarFollowUpsOverdue = webinarFollowUps.filter((f) => isFollowUpOverdue(f)).length;
  const webinarFollowUpsDueTotal = webinarLeads.filter((l) => l.status === "Follow-up Needed").length;
  const webinarPaymentsToVerify = webinarLeads.filter((l) => l.reservation && l.reservation.verificationStatus === "Pending Verification").length;
  const webinarHighIntentLeads = webinarLeads.filter((l) => isHighIntentLead(l)).length;
  const webinarNoShowFollowUp = webinarRegistrations.filter((r) => {
    if (r.attendanceStatus !== "No Show") return false;
    const lead = webinarLeads.find((l) => l.id === r.leadId);
    return lead && (lead.status === "Follow-up Needed" || lead.status === "Not Contacted");
  }).length;

  const automationsActive = automationRules.filter((r) => r.status === "Active").length;
  const communicationFailures = communicationLogs.filter((c) => c.status === "Failed").length;
  const ghlSyncErrors = syncLogs.filter((s) => s.status === "Failed" || s.status === "Needs Review").length;

  const attentionItems = [
    {
      id: "payments-verify",
      label: "Payments Need Verification",
      count: actionCounts.paymentsToVerify,
      severity: "high" as const,
      onClick: () => navigate(`/finance/payments?status=${encodeURIComponent("Pending Verification")}`),
    },
    {
      id: "incomplete-requirements",
      label: "Students with Incomplete Requirements",
      count: actionCounts.incompleteRequirements,
      severity: "medium" as const,
      onClick: () => navigate(`/students/all?requirements=${encodeURIComponent("For Verification")}`),
    },
    {
      id: "taobao-processing",
      label: "Taobao Accounts to Process",
      count: actionCounts.taobaoToProcess,
      severity: "medium" as const,
      onClick: () => navigate(`/students/all?taobao=${encodeURIComponent("Not Yet Created")}`),
    },
    {
      id: "master-brain-review",
      label: "Master Brains Awaiting Review",
      count: actionCounts.masterBrainToReview,
      severity: "low" as const,
      onClick: () => navigate(`/master-brain/submissions?status=${encodeURIComponent("Under Review")}`),
    },
    {
      id: "master-brain-final-approval",
      label: "Master Brains Needing Final Approval",
      count: masterBrainCounts["Final Review"],
      severity: "medium" as const,
      onClick: () => navigate(`/master-brain/submissions?status=${encodeURIComponent("Final Review")}`),
    },
    {
      id: "students-balance",
      label: "Students with Outstanding Balance",
      count: actionCounts.studentsWithBalance,
      severity: "high" as const,
      onClick: () => navigate("/finance/receivables"),
    },
    {
      id: "staff-tasks-overdue",
      label: "Staff Tasks Overdue",
      count: taskSnapshot.overdue,
      severity: "high" as const,
      onClick: () => navigate("/team/tasks?view=overdue"),
    },
    {
      id: "inventory-low-stock",
      label: "Inventory Items Low Stock",
      count: inventorySnapshot.lowStock,
      severity: "low" as const,
      onClick: () => navigate("/inventory/low-stock"),
    },
    {
      id: "attendance-pending",
      label: "Attendance Pending",
      count: attendancePending,
      severity: "medium" as const,
      onClick: () => navigate("/training/attendance"),
    },
    {
      id: "certificates-to-prepare",
      label: "Certificates to Prepare",
      count: certsForPrep,
      severity: "low" as const,
      onClick: () => navigate("/training/certificates"),
    },
  ];

  const actionCenterItems: ActionCenterItem[] = [
    {
      key: "payments",
      label: "Payments to Verify",
      count: actionCounts.paymentsToVerify,
      icon: ACTION_CENTER_ICONS.payments,
      onClick: () => navigate(`/finance/payments?status=${encodeURIComponent("Pending Verification")}`),
    },
    {
      key: "requirements",
      label: "Incomplete Requirements",
      count: actionCounts.incompleteRequirements,
      icon: ACTION_CENTER_ICONS.requirements,
      onClick: () => navigate(`/students/all?requirements=${encodeURIComponent("For Verification")}`),
    },
    {
      key: "taobao",
      label: "Taobao to Process",
      count: actionCounts.taobaoToProcess,
      icon: ACTION_CENTER_ICONS.taobao,
      onClick: () => navigate(`/students/all?taobao=${encodeURIComponent("Not Yet Created")}`),
    },
    {
      key: "master-brain",
      label: "Master Brain to Review",
      count: actionCounts.masterBrainToReview,
      icon: ACTION_CENTER_ICONS.masterBrain,
      onClick: () => navigate(`/master-brain/submissions?status=${encodeURIComponent("Under Review")}`),
    },
    {
      key: "balance",
      label: "Students with Balance",
      count: actionCounts.studentsWithBalance,
      icon: ACTION_CENTER_ICONS.balance,
      onClick: () => navigate("/finance/receivables"),
    },
    {
      key: "tasks",
      label: "Overdue Tasks",
      count: taskSnapshot.overdue,
      icon: ACTION_CENTER_ICONS.tasks,
      onClick: () => navigate("/team/tasks?view=overdue"),
    },
    {
      key: "inventory",
      label: "Low Stock Items",
      count: inventorySnapshot.lowStock,
      icon: ACTION_CENTER_ICONS.inventory,
      onClick: () => navigate("/inventory/low-stock"),
    },
    {
      key: "attendance",
      label: "Attendance Pending",
      count: attendancePending,
      icon: ACTION_CENTER_ICONS.attendance,
      onClick: () => navigate("/training/attendance"),
    },
    {
      key: "certificates",
      label: "Certificates to Prepare",
      count: certsForPrep,
      icon: ACTION_CENTER_ICONS.certificates,
      onClick: () => navigate("/training/certificates"),
    },
    {
      key: "webinar-followups",
      label: "Webinar Follow-ups Due",
      count: webinarFollowUpsOverdue,
      icon: ACTION_CENTER_ICONS.webinarFollowUps,
      onClick: () => navigate("/webinar/follow-ups?queue=overdue"),
    },
    {
      key: "webinar-payments",
      label: "Webinar Payments to Verify",
      count: webinarPaymentsToVerify,
      icon: ACTION_CENTER_ICONS.webinarPayments,
      onClick: () => navigate("/webinar/conversion"),
    },
    {
      key: "webinar-high-intent",
      label: "High-Intent Leads",
      count: webinarHighIntentLeads,
      icon: ACTION_CENTER_ICONS.highIntentLeads,
      onClick: () => navigate("/webinar/follow-ups?queue=high-intent"),
    },
    {
      key: "webinar-no-show",
      label: "No-Show Follow-up",
      count: webinarNoShowFollowUp,
      icon: ACTION_CENTER_ICONS.noShowFollowUp,
      onClick: () => navigate(`/webinar/registrations?attendance=${encodeURIComponent("No Show")}`),
    },
    {
      key: "communication-failures",
      label: "Communication Failures",
      count: communicationFailures,
      icon: ACTION_CENTER_ICONS.communicationFailures,
      onClick: () => navigate("/communications/logs"),
    },
    {
      key: "ghl-sync-errors",
      label: "GHL Sync Errors",
      count: ghlSyncErrors,
      icon: ACTION_CENTER_ICONS.ghlSyncErrors,
      onClick: () => navigate("/communications/sync-logs"),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">
            M.A.I.A. Academy Command Center
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">
            Welcome back, {user?.name ?? "Mommy Ann"}.
          </h1>
          <p className="mt-1 text-sm text-maia-ink-soft">
            Business &amp; Student Operations Overview &middot;{" "}
            {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <FinanceDateFilter value={dateFilter} onChange={setDateFilter} batch={batch} onBatchChange={setBatch} />
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceStatCard
          label="Total Students"
          value={String(scopedStudents.length)}
          helperText={`+${newThisMonth} new this month`}
          icon={<Users size={18} />}
        />
        <FinanceStatCard
          label="New Enrollments"
          value={String(newEnrollmentsInRange.length)}
          helperText={`${pendingVerificationCount} pending verification`}
          icon={<UserPlus size={18} />}
        />
        <FinanceStatCard
          label="Total Collections"
          value={formatPeso(totalCollections)}
          helperText="Verified, selected period"
          icon={<BanknoteArrowUp size={18} />}
          accent="gold"
          tooltip="All verified student payment transactions. This is collections, not profit."
        />
        <FinanceStatCard
          label="Total Receivables"
          value={formatPeso(totalReceivables)}
          helperText="Outstanding student balances"
          icon={<Wallet size={18} />}
        />
        <FinanceStatCard label="Collections This Month" value={formatPeso(collectionsThisMonth)} helperText="Always the current month" icon={<BanknoteArrowUp size={18} />} />
        <FinanceStatCard
          label="Total Expenses"
          value={formatPeso(totalExpensesInRange)}
          helperText="Recorded, selected period"
          icon={<BanknoteArrowDown size={18} />}
        />
        <FinanceStatCard
          label="Net Cash"
          value={formatPeso(netCash)}
          helperText="Collections − Expenses"
          icon={<Wallet size={18} />}
          accent={netCash >= 0 ? "neutral" : "danger"}
          tooltip="Net Cash = Verified Collections − Recorded Expenses for the selected period. Not the same as revenue or profit."
        />
        <FinanceStatCard
          label="Active Batch Students"
          value={String(activeBatchStudents)}
          helperText="Currently Active Student status"
          icon={<BadgeCheck size={18} />}
        />
      </div>

      <ProductionBackendKpiCard />

      <ActionCenterCard items={actionCenterItems} />

      <CurrentBatchPerformanceCard batch={currentBatch} students={students} transactions={transactions} adjustments={adjustments} />

      <EnrollmentAnalyticsCard students={students} />

      <FinancialPerformanceCard students={students} transactions={transactions} adjustments={adjustments} expenses={expenses} />

      <CollectionsByBatchTable students={students} transactions={transactions} adjustments={adjustments} expenses={expenses} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StudentPipelineCard students={scopedStudents} />
        <NeedsAttentionCard items={attentionItems} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusBreakdownCard
          title="Master Brain Progress"
          segments={Object.entries(masterBrainCounts).map(([label, count]) => ({
            key: label,
            label,
            count,
            color: MASTER_BRAIN_COLORS[label],
            onClick: () => navigate(`/students/all?masterBrain=${encodeURIComponent(label)}`),
          }))}
        />
        <StatusBreakdownCard
          title="Taobao Account Status"
          segments={Object.entries(taobaoCounts).map(([label, count]) => ({
            key: label,
            label,
            count,
            color: TAOBAO_COLORS[label],
            onClick: () => navigate(`/students/all?taobao=${encodeURIComponent(label)}`),
          }))}
        />
        <StatusBreakdownCard
          title="Student Requirements"
          segments={Object.entries(requirementsCounts).map(([label, count]) => ({
            key: label,
            label,
            count,
            color: REQUIREMENTS_COLORS[label],
            onClick: () => navigate(`/students/all?requirements=${encodeURIComponent(label)}`),
          }))}
        />
        <StatusBreakdownCard
          title="Payment Status"
          segments={Object.entries(paymentBreakdown).map(([label, data]) => ({
            key: label,
            label,
            count: data.count,
            amountLabel: data.amount > 0 ? formatPeso(data.amount) : undefined,
            color: PAYMENT_STATUS_COLORS[label],
            onClick: () => (label === "Fully Paid" ? navigate("/students/all") : navigate("/finance/receivables")),
          }))}
        />
      </div>

      <QuickActionsCard />

      <StaffTaskSnapshotCard tasks={priorityTasks} snapshot={taskSnapshot} />

      <TrainingAttendanceSnapshotCard
        upcomingSessions={upcomingSessions}
        sessionsThisMonth={sessionsThisMonth}
        expectedToday={expectedToday}
        checkedInToday={checkedInToday}
        absentToday={absentToday}
        certsForPrep={certsForPrep}
        certsReady={certsReady}
        certsIssued={certsIssued}
      />

      <StudentPortalSnapshotCard
        portalAccountsActive={portalAccountsActive}
        neverLoggedIn={neverLoggedIn}
        pendingStudentActions={pendingStudentActions}
        openSupportRequests={openSupportRequests}
        masterBrainNotStarted={masterBrainNotStarted}
        requirementsMissing={actionCounts.incompleteRequirements}
      />

      <LmsFeedbackSnapshotCard
        coursesActive={coursesActive}
        studentsLearning={studentsLearning}
        coursesCompleted={coursesCompletedCount}
        feedbackReceived={feedbackReceivedCount}
        videoTestimonials={videoTestimonialsCount}
        testimonialsForReview={testimonialsForReviewCount}
      />

      <WebinarFunnelSnapshotCard
        upcomingWebinars={webinarUpcoming}
        registrations={webinarRegistrationsCount}
        attended={webinarAttended}
        interested={webinarInterested}
        reservationsPaid={webinarReservationsPaid}
        enrolled={webinarEnrolled}
        followUpsDue={webinarFollowUpsDueTotal}
      />

      <CommunicationsSnapshotCard
        followUpsDue={webinarFollowUpsDueTotal}
        automationsActive={automationsActive}
        communicationFailures={communicationFailures}
        ghlSyncErrors={ghlSyncErrors}
      />

      <AiToolsSnapshotCard
        activeUsers={aiActiveUsers}
        totalGenerations={aiGenerations.length}
        failedGenerations={aiFailedGenerations}
        activeProjects={aiProjects.length}
      />

      <InventorySnapshotCard snapshot={inventorySnapshot} lowStockItems={lowStockAlerts} />

      <RecentActivityCard
        items={todaysActivity}
        title="Today's Activity"
        emptyMessage="No activity recorded yet today."
        action={
          <button
            onClick={() => navigate("/team/activity")}
            className="text-xs font-semibold text-maia-gold-deep hover:text-maia-ink"
          >
            VIEW ALL ACTIVITY
          </button>
        }
      />
    </div>
  );
}
