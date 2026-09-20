import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, CalendarClock, ClipboardCheck } from "lucide-react";
import { useTaskStore } from "@/data/taskStore";
import { useFinanceStore } from "@/data/financeStore";
import { isTaskDueToday, isTaskOverdue } from "@/utils/staffTasks";

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
    for (const t of overdueTasks.slice(0, 4)) {
      list.push({
        id: `overdue-${t.id}`,
        message: `Overdue: "${t.title}" (${t.assignedToName})`,
        icon: <AlertTriangle size={15} className="text-maia-danger" />,
        onClick: () => navigate(`/team/tasks/${encodeURIComponent(t.id)}`),
      });
    }

    const dueTodayTasks = tasks.filter((t) => isTaskDueToday(t));
    for (const t of dueTodayTasks.slice(0, 3)) {
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

    return list.slice(0, 8);
  }, [tasks, transactions, navigate]);

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
