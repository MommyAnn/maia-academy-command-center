import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  AdjustmentType,
  Expense,
  ExpenseCategory,
  PackageAdjustment,
  PaymentMethod,
  PaymentTransaction,
  PaymentTransactionStatus,
  PaymentType,
} from "@/types/finance";
import type { Batch, StudentRecord, UploadedFileMeta } from "@/types/student";
import { DEMO_EXPENSES, DEMO_PACKAGE_ADJUSTMENTS, DEMO_PAYMENT_TRANSACTIONS } from "@/data/demoFinance";
import { CURRENT_DEMO_USER } from "@/data/financeConfig";
import { generateExpenseId, generatePaymentId, getFinalPackageAmount } from "@/utils/finance";
import { useStudentStore } from "@/data/studentStore";
import { formatPeso } from "@/utils/format";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as src/data/studentStore.tsx: this store keeps every payment
// transaction, package adjustment, and expense in React state and mirrors
// them to this browser's localStorage. It is NOT a real accounting system —
// not shared across devices/users, not encrypted or backed up, and cleared
// if browser data is cleared. Uploaded "proof of payment" / "receipt" files
// are never stored — only filename/size/type metadata, since no secure file
// storage backend exists yet.
//
// The core rule this store enforces in code (not just UI): a student's
// "amount paid" is NEVER a field you can set directly. It is always the sum
// of that student's Verified PaymentTransaction records. See
// src/utils/finance.ts for the shared calculation logic every Finance page
// reads from.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_finance_v1";

interface FinanceState {
  transactions: PaymentTransaction[];
  adjustments: PackageAdjustment[];
  expenses: Expense[];
}

function loadInitialState(): FinanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FinanceState;
      if (parsed && Array.isArray(parsed.transactions)) return parsed;
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  return {
    transactions: DEMO_PAYMENT_TRANSACTIONS,
    adjustments: DEMO_PACKAGE_ADJUSTMENTS,
    expenses: DEMO_EXPENSES,
  };
}

function persist(state: FinanceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowParts() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    date: d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
  };
}

export interface RecordPaymentInput {
  student: StudentRecord;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  referenceNumber: string;
  date: string; // yyyy-mm-dd from a date input
  proof: UploadedFileMeta | null;
  notes: string;
}

export interface RecordExpenseInput {
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  method: PaymentMethod;
  paidTo: string;
  referenceNumber: string;
  receipt: UploadedFileMeta | null;
  relatedBatch: Batch | "";
  relatedEvent: string;
  notes: string;
}

interface FinanceStoreValue {
  transactions: PaymentTransaction[];
  adjustments: PackageAdjustment[];
  expenses: Expense[];
  recordPayment: (input: RecordPaymentInput) => PaymentTransaction;
  verifyPayment: (transactionId: string) => void;
  rejectPayment: (transactionId: string, reason: string) => void;
  requestResubmission: (transactionId: string, reason: string) => void;
  cancelPayment: (transactionId: string) => void;
  applyAdjustment: (
    student: StudentRecord,
    input: { type: AdjustmentType; amount: number; reason: string },
  ) => void;
  recordExpense: (input: RecordExpenseInput) => Expense;
  editExpense: (expenseId: string, patch: Partial<RecordExpenseInput>) => void;
  voidExpense: (expenseId: string, reason: string) => void;
}

const FinanceStoreContext = createContext<FinanceStoreValue | undefined>(undefined);

export function FinanceStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(() => loadInitialState());
  const { appendActivity } = useStudentStore();

  const updateState = useCallback((updater: (prev: FinanceState) => FinanceState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const recordPayment = useCallback(
    (input: RecordPaymentInput): PaymentTransaction => {
      const { iso } = nowParts();
      let created!: PaymentTransaction;

      updateState((prev) => {
        const id = generatePaymentId(input.student.batch, prev.transactions);
        created = {
          id,
          studentId: input.student.id,
          studentDisplayId: input.student.studentId,
          studentName: input.student.fullName,
          batch: input.student.batch,
          package: input.student.package,
          date: input.date,
          type: input.type,
          amount: input.amount,
          method: input.method,
          referenceNumber: input.referenceNumber,
          status: "Pending Verification",
          proof: input.proof,
          notes: input.notes,
          recordedBy: CURRENT_DEMO_USER,
          verifiedBy: null,
          verifiedAt: null,
          rejectedReason: null,
          createdAt: iso,
        };
        return { ...prev, transactions: [created, ...prev.transactions] };
      });

      appendActivity(
        input.student.id,
        `Payment recorded: ${formatPeso(input.amount)} (${input.type}) — ${created.id}, pending verification`,
      );

      return created;
    },
    [updateState, appendActivity],
  );

  const verifyPayment = useCallback(
    (transactionId: string) => {
      const { iso } = nowParts();
      let studentId: string | null = null;
      let amountLabel = "";

      updateState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => {
          if (t.id !== transactionId) return t;
          studentId = t.studentId;
          amountLabel = formatPeso(t.amount);
          return { ...t, status: "Verified" as PaymentTransactionStatus, verifiedBy: CURRENT_DEMO_USER, verifiedAt: iso };
        }),
      }));

      if (studentId) {
        appendActivity(studentId, `Payment verified: ${amountLabel} (${transactionId}) by ${CURRENT_DEMO_USER}`);
      }
    },
    [updateState, appendActivity],
  );

  const rejectPayment = useCallback(
    (transactionId: string, reason: string) => {
      const { iso } = nowParts();
      let studentId: string | null = null;

      updateState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => {
          if (t.id !== transactionId) return t;
          studentId = t.studentId;
          return {
            ...t,
            status: "Rejected" as PaymentTransactionStatus,
            verifiedBy: CURRENT_DEMO_USER,
            verifiedAt: iso,
            rejectedReason: reason,
          };
        }),
      }));

      if (studentId) {
        appendActivity(studentId, `Payment rejected: ${transactionId} — ${reason}`);
      }
    },
    [updateState, appendActivity],
  );

  const requestResubmission = useCallback(
    (transactionId: string, reason: string) => {
      const { iso } = nowParts();
      let studentId: string | null = null;

      updateState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => {
          if (t.id !== transactionId) return t;
          studentId = t.studentId;
          return {
            ...t,
            status: "Rejected" as PaymentTransactionStatus,
            verifiedBy: CURRENT_DEMO_USER,
            verifiedAt: iso,
            rejectedReason: reason,
          };
        }),
      }));

      if (studentId) {
        appendActivity(studentId, `Payment resubmission requested: ${transactionId} — ${reason}`);
      }
    },
    [updateState, appendActivity],
  );

  const cancelPayment = useCallback(
    (transactionId: string) => {
      let studentId: string | null = null;

      updateState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => {
          if (t.id !== transactionId) return t;
          studentId = t.studentId;
          return { ...t, status: "Cancelled" as PaymentTransactionStatus };
        }),
      }));

      if (studentId) {
        appendActivity(studentId, `Payment cancelled: ${transactionId}`);
      }
    },
    [updateState, appendActivity],
  );

  const applyAdjustment = useCallback(
    (student: StudentRecord, input: { type: AdjustmentType; amount: number; reason: string }) => {
      const { iso, date, time } = nowParts();

      updateState((prev) => {
        const adjustment: PackageAdjustment = {
          id: crypto.randomUUID(),
          studentId: student.id,
          type: input.type,
          amount: input.amount,
          reason: input.reason,
          createdBy: CURRENT_DEMO_USER,
          date,
          time,
          createdAt: iso,
        };
        const nextAdjustments = [...prev.adjustments, adjustment];
        const previousFinal = getFinalPackageAmount(student, prev.adjustments);
        const newFinal = getFinalPackageAmount(student, nextAdjustments);

        appendActivity(
          student.id,
          `${input.type} applied: -${formatPeso(input.amount)} (${formatPeso(previousFinal)} → ${formatPeso(newFinal)}) — ${input.reason}`,
        );

        return { ...prev, adjustments: nextAdjustments };
      });
    },
    [updateState, appendActivity],
  );

  const recordExpense = useCallback(
    (input: RecordExpenseInput): Expense => {
      const { iso } = nowParts();
      let created!: Expense;

      updateState((prev) => {
        const id = generateExpenseId(input.date, prev.expenses);
        created = {
          id,
          date: input.date,
          category: input.category,
          description: input.description,
          amount: input.amount,
          method: input.method,
          paidTo: input.paidTo,
          referenceNumber: input.referenceNumber,
          receipt: input.receipt,
          relatedBatch: input.relatedBatch,
          relatedEvent: input.relatedEvent,
          notes: input.notes,
          recordedBy: CURRENT_DEMO_USER,
          status: "Active",
          voidReason: null,
          createdAt: iso,
        };
        return { ...prev, expenses: [created, ...prev.expenses] };
      });

      return created;
    },
    [updateState],
  );

  const editExpense = useCallback(
    (expenseId: string, patch: Partial<RecordExpenseInput>) => {
      updateState((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) => (e.id === expenseId ? { ...e, ...patch } : e)),
      }));
    },
    [updateState],
  );

  const voidExpense = useCallback(
    (expenseId: string, reason: string) => {
      updateState((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) => (e.id === expenseId ? { ...e, status: "Void", voidReason: reason } : e)),
      }));
    },
    [updateState],
  );

  const value = useMemo<FinanceStoreValue>(
    () => ({
      transactions: state.transactions,
      adjustments: state.adjustments,
      expenses: state.expenses,
      recordPayment,
      verifyPayment,
      rejectPayment,
      requestResubmission,
      cancelPayment,
      applyAdjustment,
      recordExpense,
      editExpense,
      voidExpense,
    }),
    [
      state,
      recordPayment,
      verifyPayment,
      rejectPayment,
      requestResubmission,
      cancelPayment,
      applyAdjustment,
      recordExpense,
      editExpense,
      voidExpense,
    ],
  );

  return <FinanceStoreContext.Provider value={value}>{children}</FinanceStoreContext.Provider>;
}

export function useFinanceStore() {
  const ctx = useContext(FinanceStoreContext);
  if (!ctx) throw new Error("useFinanceStore must be used within a FinanceStoreProvider");
  return ctx;
}
