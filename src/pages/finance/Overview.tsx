import { useMemo, useState } from "react";
import {
  AlertCircle,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CalendarClock,
  CalendarRange,
  Hourglass,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { FinanceDateFilter, DEFAULT_DATE_FILTER } from "@/components/finance/FinanceDateFilter";
import { useFinanceStore } from "@/data/financeStore";
import { useStudentStore } from "@/data/studentStore";
import {
  getCollectionsThisMonth,
  getCollectionsToday,
  getNetCash,
  getPendingVerificationTransactions,
  getTotalExpenses,
  getTotalPackageValue,
  getTotalReceivables,
  getTotalVerifiedCollections,
  getVerifiedTransactions,
  matchesDateFilter,
} from "@/utils/finance";
import { formatPeso } from "@/utils/format";

export function Overview() {
  const { students } = useStudentStore();
  const { transactions, adjustments, expenses } = useFinanceStore();
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
  const [batch, setBatch] = useState("all");

  const scopedStudents = useMemo(
    () => (batch === "all" ? students : students.filter((s) => s.batch === batch)),
    [students, batch],
  );

  const batchTransactions = useMemo(
    () => (batch === "all" ? transactions : transactions.filter((t) => t.batch === batch)),
    [transactions, batch],
  );

  const rangedTransactions = useMemo(
    () => batchTransactions.filter((t) => matchesDateFilter(t.date, dateFilter)),
    [batchTransactions, dateFilter],
  );

  const batchExpenses = useMemo(
    () => (batch === "all" ? expenses : expenses.filter((e) => e.relatedBatch === batch)),
    [expenses, batch],
  );

  const rangedExpenses = useMemo(
    () => batchExpenses.filter((e) => matchesDateFilter(e.date, dateFilter)),
    [batchExpenses, dateFilter],
  );

  const totalPackageValue = getTotalPackageValue(scopedStudents, adjustments);
  const totalCollectionsInRange = getTotalVerifiedCollections(rangedTransactions);
  const collectionsToday = getCollectionsToday(batchTransactions);
  const collectionsThisMonth = getCollectionsThisMonth(batchTransactions);
  const totalReceivables = getTotalReceivables(scopedStudents, transactions, adjustments);
  const pendingVerificationCount = getPendingVerificationTransactions(rangedTransactions).length;
  const totalExpensesInRange = getTotalExpenses(rangedExpenses);
  const netCash = getNetCash(totalCollectionsInRange, totalExpensesInRange);
  const verifiedCountInRange = getVerifiedTransactions(rangedTransactions).length;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Finance</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">FINANCE OVERVIEW</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">A real-time snapshot calculated from actual transactions.</p>
        </div>
        <FinanceDateFilter value={dateFilter} onChange={setDateFilter} batch={batch} onBatchChange={setBatch} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceStatCard
          label="Total Package Value"
          value={formatPeso(totalPackageValue)}
          helperText="Value of enrolled packages"
          icon={<PiggyBank size={18} />}
          tooltip="Total value of enrolled student packages, after any discounts/adjustments. Not affected by the date filter."
        />
        <FinanceStatCard
          label="Total Collections"
          value={formatPeso(totalCollectionsInRange)}
          helperText="Verified, for selected period"
          icon={<BanknoteArrowUp size={18} />}
          accent="gold"
          tooltip="Actual verified money received in the selected date range and batch. This is not profit — expenses are shown separately."
        />
        <FinanceStatCard
          label="Collections This Month"
          value={formatPeso(collectionsThisMonth)}
          helperText="Always the current month"
          icon={<CalendarRange size={18} />}
        />
        <FinanceStatCard
          label="Collections Today"
          value={formatPeso(collectionsToday)}
          helperText="Always the current day"
          icon={<CalendarClock size={18} />}
        />
        <FinanceStatCard
          label="Total Receivables"
          value={formatPeso(totalReceivables)}
          helperText="Outstanding student balances"
          icon={<Wallet size={18} />}
          tooltip="Remaining balances owed by students, right now. A snapshot — not affected by the date filter."
        />
        <FinanceStatCard
          label="Pending Payment Verification"
          value={String(pendingVerificationCount)}
          helperText="For selected period"
          icon={<Hourglass size={18} />}
          accent="warning"
        />
        <FinanceStatCard
          label="Total Expenses"
          value={formatPeso(totalExpensesInRange)}
          helperText="Recorded, for selected period"
          icon={<BanknoteArrowDown size={18} />}
        />
        <FinanceStatCard
          label="Net Cash"
          value={formatPeso(netCash)}
          helperText="Collections − Expenses"
          icon={<Receipt size={18} />}
          accent={netCash >= 0 ? "neutral" : "danger"}
          tooltip="Net Cash = Verified Collections − Recorded Expenses for the selected period. This is a cash-flow figure, not a profit/loss statement."
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-maia-border bg-maia-surface px-4 py-3.5 text-sm text-maia-ink-soft">
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-maia-gold-deep" />
        <p>
          {verifiedCountInRange} verified payment{verifiedCountInRange === 1 ? "" : "s"} contribute to Total
          Collections for the selected period. All figures are calculated live from the Payments and Expenses
          ledgers &mdash; nothing here is a manually entered total.
        </p>
      </div>
    </div>
  );
}
