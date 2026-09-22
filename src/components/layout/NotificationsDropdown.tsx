import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Award, Bell, CalendarClock, ClipboardCheck, MessageSquareHeart, MessageSquareWarning, PackageX, PlugZap, Video, Webhook } from "lucide-react";
import { useTaskStore } from "@/data/taskStore";
import { useFinanceStore } from "@/data/financeStore";
import { useInventoryStore } from "@/data/inventoryStore";
import { useTrainingStore } from "@/data/trainingStore";
import { useFeedbackStore } from "@/data/feedbackStore";
import { useWebinarStore } from "@/data/webinarStore";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { isTaskDueToday, isTaskOverdue } from "@/utils/staffTasks";
import { getCurrentStock, getInventoryItemStatus } from "@/utils/inventory";
import { isFollowUpOverdue, isHighIntentLead } from "@/utils/webinar";

// ---------------------------------------------------------------------------
// PREPARED, NOT REAL-TIME
// ---------------------------------------------------------------------------
// This dropdown is computed from the same live student/finance/task stores
// as the rest of the app every time it's opened — it is real data, not a
// demo list. But it is NOT a push/real-time notification system: nothing
// here uses WebSockets or polling, so it only reflects state at the moment
// you open it (or the next time this component re-renders). A production
// build would replace this with a real notification service.
// ---------------------------------------------------------------------------

interface NotificationItem {
  id: string;
  message: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export function NotificationsDropdown() {
  const { tasks } = useTaskStore();
  const { transactions } = useFinanceStore();
  const { items: inventoryItems, transactions: inventoryTransactions } = useInventoryStore();
  const { sessions, enrollments, certificates } = useTrainingStore();
  const { submissions: feedbackSubmissions, consents } = useFeedbackStore();
  const { leads: webinarLeads, followUps: webinarFollowUps } = useWebinarStore();
  const { syncLogs, communicationLogs, webhookLog, automationRules } = useCommunicationsStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    const overdueTasks = tasks.filter((t) => isTaskOverdue(t));
    for (const t of overdueTasks.slice(0, 3)) {
      list.push({
        id: `overdue-${t.id}`,
        message: `Overdue: "${t.title}" (${t.assignedToName})`,
        icon: <AlertTriangle size={15} className="text-maia-danger" />,
        onClick: () => navigate(`/team/tasks/${encodeURIComponent(t.id)}`),
      });
    }

    const dueTodayTasks = tasks.filter((t) => isTaskDueToday(t));
    for (const t of dueTodayTasks.slice(0, 2)) {
      list.push({
        id: `due-today-${t.id}`,
        message: `Due today: "${t.title}" (${t.assignedToName})`,
        icon: <CalendarClock size={15} className="text-maia-gold-deep" />,
        onClick: () => navigate(`/team/tasks/${encodeURIComponent(t.id)}`),
      });
    }

    const pendingPayments = transactions.filter((t) => t.status === "Pending Verification");
    if (pendingPayments.length > 0) {
      list.push({
        id: "pending-payments",
        message: `${pendingPayments.length} payment(s) awaiting verification`,
        icon: <ClipboardCheck size={15} className="text-maia-info" />,
        onClick: () => navigate(`/finance/payments?status=${encodeURIComponent("Pending Verification")}`),
      });
    }

    const lowStockItems = inventoryItems.filter((item) => {
      const status = getInventoryItemStatus(item, getCurrentStock(item.id, inventoryTransactions));
      return status === "Low Stock" || status === "Out of Stock";
    });
    if (lowStockItems.length > 0) {
      list.push({
        id: "low-stock",
        message: `Low stock detected on ${lowStockItems.length} item(s)`,
        icon: <PackageX size={15} className="text-maia-danger" />,
        onClick: () => navigate("/inventory/low-stock"),
      });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
    const tomorrowSessions = sessions.filter((s) => s.status === "Scheduled" && s.date === tomorrowIso);
    for (const s of tomorrowSessions.slice(0, 2)) {
      list.push({
        id: `session-tomorrow-${s.id}`,
        message: `Training session tomorrow: "${s.title}"`,
        icon: <CalendarClock size={15} className="text-maia-gold-deep" />,
        onClick: () => navigate(`/training/sessions/${s.id}`),
      });
    }

    const attendancePendingCount = enrollments.filter((e) => {
      const session = sessions.find((s) => s.id === e.sessionId);
      return session && session.status !== "Cancelled" && session.date <= todayIso && e.attendanceStatus === "Registered";
    }).length;
    if (attendancePendingCount > 0) {
      list.push({
        id: "attendance-incomplete",
        message: `Attendance not yet recorded for ${attendancePendingCount} student(s)`,
        icon: <ClipboardCheck size={15} className="text-maia-info" />,
        onClick: () => navigate("/training/attendance"),
      });
    }

    const certsForPrep = certificates.filter((c) => c.status === "For Preparation").length;
    if (certsForPrep > 0) {
      list.push({
        id: "certs-for-prep",
        message: `${certsForPrep} certificate(s) ready for preparation`,
        icon: <Award size={15} className="text-maia-warning" />,
        onClick: () => navigate("/training/certificates"),
      });
    }

    const certsReady = certificates.filter((c) => c.status === "Ready").length;
    if (certsReady > 0) {
      list.push({
        id: "certs-ready",
        message: `${certsReady} certificate(s) ready for issuance`,
        icon: <Award size={15} className="text-maia-gold-deep" />,
        onClick: () => navigate("/training/certificates"),
      });
    }

    const pendingFeedback = feedbackSubmissions.filter((s) => !s.isDraft && s.status === "Submitted");
    if (pendingFeedback.length > 0) {
      list.push({
        id: "feedback-needs-review",
        message: `${pendingFeedback.length} feedback submission(s) need review`,
        icon: <MessageSquareHeart size={15} className="text-maia-gold-deep" />,
        onClick: () => navigate("/feedback/all?status=Submitted"),
      });
    }

    const newVideoFeedback = pendingFeedback.filter((s) => s.videoAsset);
    if (newVideoFeedback.length > 0) {
      list.push({
        id: "new-video-feedback",
        message: `${newVideoFeedback.length} new video testimonial(s) submitted`,
        icon: <Video size={15} className="text-maia-info" />,
        onClick: () => navigate("/feedback/all?type=Video"),
      });
    }

    const recentConsents = consents.filter((c) => c.status === "Granted");
    const pendingApproval = feedbackSubmissions.filter(
      (s) => !s.isDraft && s.status !== "Approved for Marketing" && s.status !== "Featured" && recentConsents.some((c) => c.feedbackId === s.feedbackId),
    );
    if (pendingApproval.length > 0) {
      list.push({
        id: "marketing-consent-granted",
        message: `${pendingApproval.length} feedback record(s) have marketing consent awaiting review`,
        icon: <Award size={15} className="text-maia-gold-deep" />,
        onClick: () => navigate("/feedback/all"),
      });
    }

    const overdueFollowUps = webinarFollowUps.filter((f) => isFollowUpOverdue(f));
    if (overdueFollowUps.length > 0) {
      list.push({
        id: "webinar-followups-overdue",
        message: `${overdueFollowUps.length} webinar follow-up(s) overdue`,
        icon: <AlertTriangle size={15} className="text-maia-danger" />,
        onClick: () => navigate("/webinar/follow-ups?queue=overdue"),
      });
    }

    const pendingReservations = webinarLeads.filter((l) => l.reservation && l.reservation.verificationStatus === "Pending Verification");
    if (pendingReservations.length > 0) {
      list.push({
        id: "webinar-reservations-pending",
        message: `${pendingReservations.length} webinar reservation payment(s) awaiting verification`,
        icon: <ClipboardCheck size={15} className="text-maia-info" />,
        onClick: () => navigate("/webinar/conversion"),
      });
    }

    const highIntentLeads = webinarLeads.filter((l) => isHighIntentLead(l));
    if (highIntentLeads.length > 0) {
      list.push({
        id: "webinar-high-intent",
        message: `${highIntentLeads.length} high-intent webinar lead(s) with no follow-up scheduled`,
        icon: <Video size={15} className="text-maia-gold-deep" />,
        onClick: () => navigate("/webinar/follow-ups?queue=high-intent"),
      });
    }

    const ghlSyncFailures = syncLogs.filter((s) => s.status === "Failed" || s.status === "Retry Pending");
    if (ghlSyncFailures.length > 0) {
      list.push({
        id: "ghl-sync-failures",
        message: `${ghlSyncFailures.length} GHL sync failure(s)`,
        icon: <PlugZap size={15} className="text-maia-danger" />,
        onClick: () => navigate("/communications/sync-logs"),
      });
    }

    const syncNeedsReview = syncLogs.filter((s) => s.status === "Needs Review");
    if (syncNeedsReview.length > 0) {
      list.push({
        id: "ghl-sync-needs-review",
        message: `${syncNeedsReview.length} GHL sync record(s) need manual review`,
        icon: <AlertTriangle size={15} className="text-maia-danger" />,
        onClick: () => navigate("/communications/sync-logs"),
      });
    }

    const failedAutomationRules = automationRules.filter((r) => r.status === "Active" && r.failed > 0);
    if (failedAutomationRules.length > 0) {
      list.push({
        id: "automation-failures",
        message: `${failedAutomationRules.length} automation rule(s) had a failed action`,
        icon: <MessageSquareWarning size={15} className="text-maia-danger" />,
        onClick: () => navigate("/communications/automation-rules"),
      });
    }

    const communicationFailures = communicationLogs.filter((c) => c.status === "Failed");
    if (communicationFailures.length >= 3) {
      list.push({
        id: "communication-failures-high",
        message: `${communicationFailures.length} communication failures recorded`,
        icon: <MessageSquareWarning size={15} className="text-maia-danger" />,
        onClick: () => navigate("/communications/logs"),
      });
    }

    const unverifiedWebhooks = webhookLog.filter((w) => !w.signatureVerified);
    if (unverifiedWebhooks.length > 0) {
      list.push({
        id: "webhook-unverified",
        message: `${unverifiedWebhooks.length} webhook delivery(ies) failed signature verification`,
        icon: <Webhook size={15} className="text-maia-danger" />,
        onClick: () => navigate("/communications/ghl-integration"),
      });
    }

    return list.slice(0, 10);
  }, [
    tasks,
    transactions,
    inventoryItems,
    inventoryTransactions,
    sessions,
    enrollments,
    certificates,
    feedbackSubmissions,
    consents,
    webinarLeads,
    webinarFollowUps,
    syncLogs,
    communicationLogs,
    webhookLog,
    automationRules,
    navigate,
  ]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-maia-ink-soft hover:bg-maia-bg"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-maia-danger ring-2 ring-maia-surface" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-maia-border bg-maia-surface shadow-lg">
          <div className="border-b border-maia-border px-4 py-3">
            <p className="text-sm font-semibold text-maia-ink">Notifications</p>
            <p className="text-[11px] text-maia-ink-soft">
              Live data, refreshed on open — not a real-time push system yet.
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-maia-ink-soft">Nothing needs your attention right now.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-maia-bg"
                >
                  <span className="mt-0.5 flex-shrink-0">{item.icon}</span>
                  <span className="text-maia-ink">{item.message}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
