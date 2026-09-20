import { useMemo, useState } from "react";
import { Archive, CalendarClock, CalendarRange, Eye, ListFilter, Pencil, Plus, Wallet } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DocumentPreviewModal } from "@/components/students/profile/DocumentPreviewModal";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { ExpenseModal } from "@/components/finance/ExpenseModal";
import { DatePresetSelect, DEFAULT_DATE_FILTER } from "@/components/finance/DatePresetSelect";
import { EXPENSE_STATUS_TONE } from "@/components/finance/financeStatusMeta";
import { EXPENSE_CATEGORIES } from "@/data/financeConfig";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { useFinanceStore } from "@/data/financeStore";
import {
  getExpensesThisMonth,
  getExpensesThisYear,
  getExpensesToday,
  getTotalExpenses,
  matchesDateFilter,
} from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { formatDate } from "@/utils/students";
import type { Expense, ExpenseStatus } from "@/types/finance";

interface Filters {
  search: string;
  category: string;
  batch: string;
  status: string;
}

const DEFAULT_FILTERS: Filters = { search: "", category: "all", batch: "all", status: "all" };
const EXPENSE_STATUS_OPTIONS: ExpenseStatus[] = ["Active", "Void"];

export function Expenses() {
  const { expenses, voidExpense } = useFinanceStore();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [receiptExpense, setReceiptExpense] = useState<Expense | null>(null);
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null);

  const sorted = useMemo(() => [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1)), [expenses]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return sorted.filter((e) => {
      if (search) {
        const haystack = `${e.id} ${e.description} ${e.paidTo} ${e.referenceNumber}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filters.category !== "all" && e.category !== filters.category) return false;
      if (filters.batch !== "all" && e.relatedBatch !== filters.batch) return false;
      if (filters.status !== "all" && e.status !== filters.status) return false;
      if (!matchesDateFilter(e.date, dateFilter)) return false;
      return true;
    });
  }, [sorted, filters, dateFilter]);

  const totalExpenses = getTotalExpenses(expenses);
  const expensesToday = getExpensesToday(expenses);
  const expensesThisMonth = getExpensesThisMonth(expenses);
  const expensesThisYear = getExpensesThisYear(expenses);

  function openAdd() {
    setEditingExpense(null);
    setModalOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Finance</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">EXPENSE MANAGEMENT</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">Record and track every business expense.</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} />
          ADD EXPENSE
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceStatCard label="Expenses Today" value={formatPeso(expensesToday)} icon={<CalendarClock size={18} />} />
        <FinanceStatCard label="Expenses This Month" value={formatPeso(expensesThisMonth)} icon={<CalendarRange size={18} />} />
        <FinanceStatCard label="Expenses This Year" value={formatPeso(expensesThisYear)} icon={<CalendarRange size={18} />} />
        <FinanceStatCard label="Total Expenses" value={formatPeso(totalExpenses)} helperText="All-time, excluding voided" icon={<Wallet size={18} />} accent="gold" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
          placeholder="Search description, paid to, reference, or ID..."
        />
        <FilterSelect
          value={filters.category}
          onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          options={[{ value: "all", label: "All Categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          value={filters.batch}
          onChange={(v) => setFilters((f) => ({ ...f, batch: v }))}
          options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]}
        />
        <FilterSelect
          icon={<ListFilter size={15} />}
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={[{ value: "all", label: "All Statuses" }, ...EXPENSE_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
        />
        <DatePresetSelect value={dateFilter} onChange={setDateFilter} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <Th>Expense ID</Th>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Paid To</Th>
                <Th>Batch</Th>
                <Th>Recorded By</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className={`border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40 ${e.status === "Void" ? "opacity-60" : ""}`}>
                  <Td className="font-mono text-xs font-semibold text-maia-ink">{e.id}</Td>
                  <Td className="text-maia-ink-soft">{formatDate(e.date)}</Td>
                  <Td className="text-maia-ink-soft">{e.category}</Td>
                  <Td className="max-w-[220px] truncate font-medium text-maia-ink" title={e.description}>
                    {e.description}
                  </Td>
                  <Td className="font-semibold text-maia-ink">{formatPeso(e.amount)}</Td>
                  <Td className="text-maia-ink-soft">{e.method}</Td>
                  <Td className="text-maia-ink-soft">{e.paidTo}</Td>
                  <Td className="text-maia-ink-soft">{e.relatedBatch || "—"}</Td>
                  <Td className="text-maia-ink-soft">{e.recordedBy}</Td>
                  <Td>
                    <Badge tone={EXPENSE_STATUS_TONE[e.status]}>{e.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <IconButton title="View receipt" onClick={() => setReceiptExpense(e)} disabled={!e.receipt}>
                        <Eye size={14} />
                      </IconButton>
                      <IconButton title="Edit expense" onClick={() => openEdit(e)} disabled={e.status === "Void"}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton title="Void expense" tone="danger" onClick={() => setVoidingExpense(e)} disabled={e.status === "Void"}>
                        <Archive size={14} />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No expenses match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ExpenseModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingExpense(null);
        }}
        editingExpense={editingExpense}
      />

      <DocumentPreviewModal
        open={receiptExpense !== null}
        onClose={() => setReceiptExpense(null)}
        title="Receipt / Attachment"
        file={receiptExpense?.receipt ?? null}
      />

      <ConfirmDialog
        open={voidingExpense !== null}
        onClose={() => setVoidingExpense(null)}
        onConfirm={(reason) => {
          if (voidingExpense && reason) voidExpense(voidingExpense.id, reason);
          setVoidingExpense(null);
        }}
        title="Void Expense"
        description={
          voidingExpense
            ? `Void ${voidingExpense.id} (${formatPeso(voidingExpense.amount)})? It stays in history marked VOID and is removed from expense totals — it is never deleted.`
            : ""
        }
        confirmLabel="VOID EXPENSE"
        tone="danger"
        requireReason
        reasonLabel="Reason for voiding"
      />
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: "danger";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        tone === "danger" ? "border-maia-danger/30 text-maia-danger hover:bg-maia-danger-bg" : "border-maia-border text-maia-ink-soft hover:bg-maia-bg"
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Td({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <td className={`whitespace-nowrap px-4 py-3 ${className ?? ""}`} title={title}>
      {children}
    </td>
  );
}

