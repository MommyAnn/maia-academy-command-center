import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BanknoteArrowDown, BanknoteArrowUp, ClipboardList, PiggyBank, Receipt, Users, Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { TASK_STATUS_TONE } from "@/components/team/statusMeta";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { useTaskStore } from "@/data/taskStore";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import {
  getNetCash,
  getStudentFinanceSummary,
  getTotalExpenses,
  getTotalPackageValue,
  getTotalReceivables,
  getTotalVerifiedCollections,
} from "@/utils/finance";
import { isTaskActive, isTaskOverdue } from "@/utils/staffTasks";
import { formatPeso } from "@/utils/format";
import type { Batch, StudentRecord } from "@/types/student";
import type { PackageAdjustment, PaymentTransaction, Expense } from "@/types/finance";
import type { TaskRecord } from "@/types/task";

export function Batches() {
  const { students } = useStudentStore();
  const { transactions, adjustments, expenses } = useFinanceStore();
  const { tasks } = useTaskStore();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Students</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Batches</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">Financial and enrollment performance for every batch.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {BATCH_OPTIONS.map((batch) => (
          <BatchCard
            key={batch}
            batch={batch}
            students={students}
            transactions={transactions}
            adjustments={adjustments}
            expenses={expenses}
            tasks={tasks}
          />
        ))}
      </div>
    </div>
  );
}

function BatchCard({
  batch,
  students,
  transactions,
  adjustments,
  expenses,
  tasks,
}: {
  batch: Batch;
  students: StudentRecord[];
  transactions: PaymentTransaction[];
  adjustments: PackageAdjustment[];
  expenses: Expense[];
  tasks: TaskRecord[];
}) {
  const navigate = useNavigate();
  const batchStudents = students.filter((s) => s.batch === batch);
  const batchTransactions = transactions.filter((t) => t.batch === batch);
  const batchExpenses = expenses.filter((e) => e.relatedBatch === batch);
  const batchTasks = tasks.filter((t) => t.relatedBatch === batch);
  const activeBatchTasks = batchTasks.filter((t) => isTaskActive(t.status));
  const overdueBatchTasks = batchTasks.filter((t) => isTaskOverdue(t));

  const packageValue = getTotalPackageValue(batchStudents, adjustments);
  const verifiedCollections = getTotalVerifiedCollections(batchTransactions);
  const receivables = getTotalReceivables(batchStudents, transactions, adjustments);
  const totalExpenses = getTotalExpenses(batchExpenses);
  const netCash = getNetCash(verifiedCollections, totalExpenses);

  const summaries = batchStudents.map((s) => getStudentFinanceSummary(s, transactions, adjustments));
  const fullyPaid = summaries.filter((s) => s.status === "Fully Paid").length;
  const partial = summaries.filter((s) => s.status === "Partial Payment").length;
  const unpaid = summaries.filter((s) => s.status === "Unpaid").length;
  const pendingVerification = summaries.filter((s) => s.status === "Pending Verification").length;

  const batchParam = encodeURIComponent(batch);

  return (
    <Card id={`batch-${batch.replace(/\s+/g, "-")}`} className="scroll-mt-6">
      <CardHeader title={batch} subtitle={`${batchStudents.length} total students`} />

      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          icon={<Users size={15} />}
          label="Total Students"
          value={String(batchStudents.length)}
          onClick={() => navigate(`/students/all?batch=${batchParam}`)}
        />
        <MiniStat icon={<PiggyBank size={15} />} label="Package Value" value={formatPeso(packageValue)} />
        <MiniStat
          icon={<BanknoteArrowUp size={15} />}
          label="Verified Collections"
          value={formatPeso(verifiedCollections)}
          onClick={() => navigate(`/finance/payments?batch=${batchParam}&status=${encodeURIComponent("Verified")}`)}
        />
        <MiniStat
          icon={<Wallet size={15} />}
          label="Receivables"
          value={formatPeso(receivables)}
          onClick={() => navigate(`/finance/receivables?batch=${batchParam}`)}
        />
        <MiniStat
          icon={<BanknoteArrowDown size={15} />}
          label="Expenses"
          value={formatPeso(totalExpenses)}
          onClick={() => navigate(`/finance/expenses?batch=${batchParam}`)}
        />
        <MiniStat icon={<Receipt size={15} />} label="Net Cash" value={formatPeso(netCash)} />
      </div>

      <div className="mt-5 border-t border-maia-border pt-4">
        <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Student Payment Breakdown</p>
        <div className="grid grid-cols-2 gap-2">
          <BreakdownRow label="Fully Paid" value={fullyPaid} tone="success" onClick={() => navigate(`/students/all?batch=${batchParam}`)} />
          <BreakdownRow
            label="Partial Payment"
            value={partial}
            tone="warning"
            onClick={() => navigate(`/finance/receivables?batch=${batchParam}&status=${encodeURIComponent("Partial Payment")}`)}
          />
          <BreakdownRow
            label="Unpaid"
            value={unpaid}
            tone="danger"
            onClick={() => navigate(`/finance/receivables?batch=${batchParam}&status=${encodeURIComponent("Unpaid")}`)}
          />
          <BreakdownRow
            label="Pending Verification"
            value={pendingVerification}
            tone="info"
            onClick={() => navigate(`/finance/receivables?batch=${batchParam}&status=${encodeURIComponent("Pending Verification")}`)}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-maia-border pt-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">
            <ClipboardList size={13} />
            Operations / Tasks
          </p>
          <button
            onClick={() => navigate(`/team/tasks?batch=${batchParam}`)}
            className="text-xs font-semibold text-maia-gold-deep hover:underline"
          >
            View All
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            icon={<ClipboardList size={15} />}
            label="Active Tasks"
            value={String(activeBatchTasks.length)}
            onClick={() => navigate(`/team/tasks?batch=${batchParam}`)}
          />
          <MiniStat
            icon={<ClipboardList size={15} />}
            label="Overdue Tasks"
            value={String(overdueBatchTasks.length)}
            onClick={() => navigate(`/team/tasks?batch=${batchParam}&status=${encodeURIComponent("To Do")}`)}
          />
        </div>
        {batchTasks.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {batchTasks.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-maia-bg px-3 py-1.5 text-xs">
                <span className="truncate text-maia-ink">{t.title}</span>
                <Badge tone={TASK_STATUS_TONE[t.status]}>{t.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function MiniStat({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-lg bg-maia-bg px-3 py-2.5 text-left ${onClick ? "cursor-pointer transition-colors hover:bg-maia-gold-bg" : ""}`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">
        {icon}
        {label}
      </span>
      <span className="font-display text-sm font-bold text-maia-ink">{value}</span>
    </Comp>
  );
}

function BreakdownRow({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "info";
  onClick: () => void;
}) {
  const dotClass = {
    success: "bg-maia-success",
    warning: "bg-maia-warning",
    danger: "bg-maia-danger",
    info: "bg-maia-info",
  }[tone];

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-maia-bg"
    >
      <span className="flex items-center gap-2 text-maia-ink-soft">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span className="font-display font-bold text-maia-ink">{value}</span>
    </button>
  );
}
