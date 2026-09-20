import type { ExpenseStatus, PaymentTransactionStatus } from "@/types/finance";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export const PAYMENT_TXN_STATUS_TONE: Record<PaymentTransactionStatus, Tone> = {
  "Pending Verification": "warning",
  Verified: "success",
  Rejected: "danger",
  Cancelled: "neutral",
};

export const EXPENSE_STATUS_TONE: Record<ExpenseStatus, Tone> = {
  Active: "success",
  Void: "neutral",
};

export const PAYMENT_TXN_STATUS_OPTIONS: PaymentTransactionStatus[] = [
  "Pending Verification",
  "Verified",
  "Rejected",
  "Cancelled",
];
