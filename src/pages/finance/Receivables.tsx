import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertOctagon, ListFilter, Package, StickyNote, Users, Wallet } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { Modal } from "@/components/common/Modal";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { PAYMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { BATCH_OPTIONS, PACKAGE_OPTIONS } from "@/data/enrollmentConfig";
import { useFinanceStore } from "@/data/financeStore";
import { useStudentStore } from "@/data/studentStore";
import {
  getLastPaymentDate,
  getStudentFinanceSummary,
  getStudentsWithBalance,
  getTotalReceivables,
  isReceivableOverdue,
} from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { formatDate } from "@/utils/students";
import type { PaymentStatus, StudentRecord } from "@/types/student";

interface Filters {
  search: string;
  batch: string;
  pkg: string;
  status: string;
  minBalance: string;
  maxBalance: string;
}

const DEFAULT_FILTERS: Filters = { search: "", batch: "all", pkg: "all", status: "all", minBalance: "", maxBalance: "" };

const STATUS_OPTIONS: PaymentStatus[] = ["Unpaid", "Partial Payment", "Pending Verification"];

export function Receivables() {
  const { students } = useStudentStore();
  const { transactions, adjustments } = useFinanceStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    batch: searchParams.get("batch") ?? DEFAULT_FILTERS.batch,
    status: searchParams.get("status") ?? DEFAULT_FILTERS.status,
  }));
  const [recordFor, setRecordFor] = useState<StudentRecord | null>(null);
  const [noteFor, setNoteFor] = useState<StudentRecord | null>(null);

  const withBalance = useMemo(
    () => getStudentsWithBalance(students, transactions, adjustments),
    [students, transactions, adjustments],
  );

  const rows = useMemo(
    () =>
      withBalance.map((s) => ({
        student: s,
        summary: getStudentFinanceSummary(s, transactions, adjustments),
        lastPayment: getLastPaymentDate(s.id, transactions),
        overdue: isReceivableOverdue(s, transactions, adjustments),
      })),
    [withBalance, transactions, adjustments],
  );

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return rows.filter(({ student, summary }) => {
      if (search) {
        const haystack = `${student.studentId} ${student.fullName} ${student.facebookName} ${student.contactNumber}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filters.batch !== "all" && student.batch !== filters.batch) return false;
      if (filters.pkg !== "all" && student.package !== filters.pkg) return false;
      if (filters.status !== "all" && summary.status !== filters.status) return false;
      if (filters.minBalance && summary.balance < Number(filters.minBalance)) return false;
      if (filters.maxBalance && summary.balance > Number(filters.maxBalance)) return false;
      return true;
    });
  }, [rows, filters]);

  const totalReceivables = getTotalReceivables(students, transactions, adjustments);
  const overdueCount = rows.filter((r) => r.overdue).length;
  const partialCount = rows.filter((r) => r.summary.status === "Partial Payment").length;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Finance</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">RECEIVABLES</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">Students with outstanding balances, calculated automatically.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceStatCard label="Total Receivables" value={formatPeso(totalReceivables)} helperText="Outstanding student balances" icon={<Wallet size={18} />} accent="gold" />
        <FinanceStatCard label="Students with Balance" value={String(withBalance.length)} icon={<Users size={18} />} />
        <FinanceStatCard label="Overdue Balances" value={String(overdueCount)} helperText="30+ days since last payment" icon={<AlertOctagon size={18} />} accent="danger" />
        <FinanceStatCard label="Partial Payments" value={String(partialCount)} icon={<Wallet size={18} />} accent="warning" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
          placeholder="Search name, Student ID, Facebook name, or contact #..."
        />
        <FilterSelect
          value={filters.batch}
          onChange={(v) => setFilters((f) => ({ ...f, batch: v }))}
          options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]}
        />
        <FilterSelect
          icon={<Package size={15} />}
          value={filters.pkg}
          onChange={(v) => setFilters((f) => ({ ...f, pkg: v }))}
          options={[{ value: "all", label: "All Packages" }, ...PACKAGE_OPTIONS.map((p) => ({ value: p, label: p }))]}
        />
        <FilterSelect
          icon={<ListFilter size={15} />}
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={[{ value: "all", label: "All Statuses" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
        />
        <div className="flex items-center gap-2 rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm">
          <input
            type="number"
            placeholder="Min ₱"
            value={filters.minBalance}
            onChange={(e) => setFilters((f) => ({ ...f, minBalance: e.target.value }))}
            className="w-20 bg-transparent text-maia-ink outline-none"
          />
          <span className="text-maia-ink-soft">&ndash;</span>
          <input
            type="number"
            placeholder="Max ₱"
            value={filters.maxBalance}
            onChange={(e) => setFilters((f) => ({ ...f, maxBalance: e.target.value }))}
            className="w-20 bg-transparent text-maia-ink outline-none"
          />
        </div>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <Th>Student ID</Th>
                <Th>Student Name</Th>
                <Th>Batch</Th>
                <Th>Package</Th>
                <Th>Final Package Amount</Th>
                <Th>Total Paid</Th>
                <Th>Balance</Th>
                <Th>Last Payment</Th>
                <Th>Payment Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ student, summary, lastPayment, overdue }) => (
                <tr key={student.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <Td className="font-mono text-xs font-semibold text-maia-ink">{student.studentId}</Td>
                  <Td className="font-medium text-maia-ink">{student.fullName}</Td>
                  <Td className="text-maia-ink-soft">{student.batch}</Td>
                  <Td className="text-maia-ink-soft">{student.package}</Td>
                  <Td className="text-maia-ink-soft">{formatPeso(summary.finalPackageAmount)}</Td>
                  <Td className="text-maia-success">{formatPeso(summary.verifiedTotal)}</Td>
                  <Td className="font-semibold text-maia-danger">{formatPeso(summary.balance)}</Td>
                  <Td className="text-maia-ink-soft">
                    {lastPayment ? formatDate(lastPayment) : "—"}
                    {overdue && (
                      <Badge tone="danger">
                        <span className="ml-1">Overdue</span>
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[summary.status]}>{summary.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/students/${student.id}`)}>
                        VIEW
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRecordFor(student)}>
                        RECORD PAYMENT
                      </Button>
                      <button
                        title="Add follow-up note"
                        onClick={() => setNoteFor(student)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-maia-border text-maia-ink-soft hover:bg-maia-bg"
                      >
                        <StickyNote size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No outstanding balances match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {recordFor && <RecordPaymentModal open={Boolean(recordFor)} onClose={() => setRecordFor(null)} student={recordFor} />}
      {noteFor && <FollowUpNoteModal student={noteFor} onClose={() => setNoteFor(null)} />}
    </div>
  );
}

function FollowUpNoteModal({ student, onClose }: { student: StudentRecord; onClose: () => void }) {
  const { addAdminNote } = useStudentStore();
  const [text, setText] = useState("");

  function handleSave() {
    if (!text.trim()) return;
    addAdminNote(student.id, `Follow-up (Receivables): ${text.trim()}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add Follow-up Note — ${student.fullName}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            CANCEL
          </Button>
          <Button onClick={handleSave} disabled={!text.trim()}>
            SAVE NOTE
          </Button>
        </div>
      }
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. Messaged student about outstanding balance, promised to pay by Friday."
        className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
      />
    </Modal>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className ?? ""}`}>{children}</td>;
}

