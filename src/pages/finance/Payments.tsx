import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BanknoteArrowUp,
  CalendarClock,
  CheckCircle2,
  Eye,
  Hourglass,
  ListFilter,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DocumentPreviewModal } from "@/components/students/profile/DocumentPreviewModal";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { PAYMENT_TXN_STATUS_TONE, PAYMENT_TXN_STATUS_OPTIONS } from "@/components/finance/financeStatusMeta";
import { PAYMENT_METHODS } from "@/data/financeConfig";
import { BATCH_OPTIONS, PACKAGE_OPTIONS } from "@/data/enrollmentConfig";
import { useFinanceStore } from "@/data/financeStore";
import {
  getCollectionsToday,
  getPendingVerificationTransactions,
  getTotalVerifiedCollections,
  getVerifiedTransactions,
} from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { formatDate } from "@/utils/students";
import type { PaymentTransaction } from "@/types/finance";

interface Filters {
  search: string;
  batch: string;
  pkg: string;
  status: string;
  method: string;
}

const DEFAULT_FILTERS: Filters = { search: "", batch: "all", pkg: "all", status: "all", method: "all" };

export function Payments() {
  const { transactions, verifyPayment, rejectPayment, requestResubmission } = useFinanceStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    batch: searchParams.get("batch") ?? DEFAULT_FILTERS.batch,
    status: searchParams.get("status") ?? DEFAULT_FILTERS.status,
  }));
  const [recordOpen, setRecordOpen] = useState(false);
  const [proofTxn, setProofTxn] = useState<PaymentTransaction | null>(null);
  const [rejectTxn, setRejectTxn] = useState<PaymentTransaction | null>(null);
  const [resubmitTxn, setResubmitTxn] = useState<PaymentTransaction | null>(null);
  const [verifyTxn, setVerifyTxn] = useState<PaymentTransaction | null>(null);

  const sorted = useMemo(() => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)), [transactions]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return sorted.filter((t) => {
      if (search) {
        const haystack = `${t.id} ${t.studentDisplayId} ${t.studentName} ${t.referenceNumber}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filters.batch !== "all" && t.batch !== filters.batch) return false;
      if (filters.pkg !== "all" && t.package !== filters.pkg) return false;
      if (filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.method !== "all" && t.method !== filters.method) return false;
      return true;
    });
  }, [sorted, filters]);

  const totalCollections = getTotalVerifiedCollections(transactions);
  const collectionsToday = getCollectionsToday(transactions);
  const pendingCount = getPendingVerificationTransactions(transactions).length;
  const verifiedCount = getVerifiedTransactions(transactions).length;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Finance</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">PAYMENTS</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">Track, verify and manage student payment transactions.</p>
        </div>
        <Button onClick={() => setRecordOpen(true)}>
          <Plus size={16} />
          RECORD PAYMENT
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceStatCard label="Total Collections" value={formatPeso(totalCollections)} helperText="All verified payments" icon={<BanknoteArrowUp size={18} />} accent="gold" />
        <FinanceStatCard label="Payments Today" value={formatPeso(collectionsToday)} helperText="Verified today" icon={<CalendarClock size={18} />} />
        <FinanceStatCard label="Pending Verification" value={String(pendingCount)} helperText="Awaiting Finance review" icon={<Hourglass size={18} />} accent="warning" />
        <FinanceStatCard label="Verified Payments" value={String(verifiedCount)} helperText="All-time verified count" icon={<ShieldCheck size={18} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
          placeholder="Search student, transaction ID, or reference #..."
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
          options={[{ value: "all", label: "All Statuses" }, ...PAYMENT_TXN_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          value={filters.method}
          onChange={(v) => setFilters((f) => ({ ...f, method: v }))}
          options={[{ value: "all", label: "All Methods" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <Th>Transaction ID</Th>
                <Th>Date</Th>
                <Th>Student ID</Th>
                <Th>Student Name</Th>
                <Th>Batch</Th>
                <Th>Package</Th>
                <Th>Type</Th>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Reference #</Th>
                <Th>Status</Th>
                <Th>Verified By</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <Td className="font-mono text-xs font-semibold text-maia-ink">{t.id}</Td>
                  <Td className="text-maia-ink-soft">{formatDate(t.date)}</Td>
                  <Td className="font-mono text-xs text-maia-ink-soft">{t.studentDisplayId}</Td>
                  <Td className="font-medium text-maia-ink">{t.studentName}</Td>
                  <Td className="text-maia-ink-soft">{t.batch}</Td>
                  <Td className="text-maia-ink-soft">{t.package}</Td>
                  <Td className="text-maia-ink-soft">{t.type}</Td>
                  <Td className="font-semibold text-maia-ink">{formatPeso(t.amount)}</Td>
                  <Td className="text-maia-ink-soft">{t.method}</Td>
                  <Td className="text-maia-ink-soft">{t.referenceNumber || "—"}</Td>
                  <Td>
                    <Badge tone={PAYMENT_TXN_STATUS_TONE[t.status]}>{t.status}</Badge>
                  </Td>
                  <Td className="text-maia-ink-soft">{t.verifiedBy ?? "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <IconButton title="View proof of payment" onClick={() => setProofTxn(t)} disabled={!t.proof}>
                        <Eye size={15} />
                      </IconButton>
                      {t.status === "Pending Verification" && (
                        <>
                          <IconButton title="Verify payment" tone="success" onClick={() => setVerifyTxn(t)}>
                            <CheckCircle2 size={15} />
                          </IconButton>
                          <IconButton title="Reject payment" tone="danger" onClick={() => setRejectTxn(t)}>
                            <XCircle size={15} />
                          </IconButton>
                          <IconButton title="Request resubmission" tone="warning" onClick={() => setResubmitTxn(t)}>
                            <RotateCcw size={15} />
                          </IconButton>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/students/${t.studentId}`)}>
                        VIEW STUDENT
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No payment transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} />

      <DocumentPreviewModal
        open={proofTxn !== null}
        onClose={() => setProofTxn(null)}
        title="Proof of Payment"
        file={proofTxn?.proof ?? null}
      />

      <ConfirmDialog
        open={verifyTxn !== null}
        onClose={() => setVerifyTxn(null)}
        onConfirm={() => {
          if (verifyTxn) verifyPayment(verifyTxn.id);
          setVerifyTxn(null);
        }}
        title="Verify Payment"
        description={
          verifyTxn
            ? `Confirm ${formatPeso(verifyTxn.amount)} from ${verifyTxn.studentName} (${verifyTxn.id}) as verified. This will update their total paid and remaining balance.`
            : ""
        }
        confirmLabel="VERIFY PAYMENT"
      />

      <ConfirmDialog
        open={rejectTxn !== null}
        onClose={() => setRejectTxn(null)}
        onConfirm={(reason) => {
          if (rejectTxn && reason) rejectPayment(rejectTxn.id, reason);
          setRejectTxn(null);
        }}
        title="Reject Payment"
        description={rejectTxn ? `Reject ${formatPeso(rejectTxn.amount)} from ${rejectTxn.studentName} (${rejectTxn.id})? It will not count toward their collections.` : ""}
        confirmLabel="REJECT PAYMENT"
        tone="danger"
        requireReason
        reasonLabel="Reason for rejection"
      />

      <ConfirmDialog
        open={resubmitTxn !== null}
        onClose={() => setResubmitTxn(null)}
        onConfirm={(reason) => {
          if (resubmitTxn && reason) requestResubmission(resubmitTxn.id, reason);
          setResubmitTxn(null);
        }}
        title="Request Resubmission"
        description={resubmitTxn ? `Ask ${resubmitTxn.studentName} to resubmit proof for ${formatPeso(resubmitTxn.amount)} (${resubmitTxn.id}).` : ""}
        confirmLabel="REQUEST RESUBMISSION"
        requireReason
        reasonLabel="What needs to be resubmitted"
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
  tone?: "success" | "danger" | "warning";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        tone === "success"
          ? "border-maia-success/30 text-maia-success hover:bg-maia-success-bg"
          : tone === "danger"
            ? "border-maia-danger/30 text-maia-danger hover:bg-maia-danger-bg"
            : tone === "warning"
              ? "border-maia-warning/30 text-maia-warning hover:bg-maia-warning-bg"
              : "border-maia-border text-maia-ink-soft hover:bg-maia-bg"
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
