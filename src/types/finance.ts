// Finance & Payment Management domain types for Step 3. Backed by demo/local
// state for now — see src/data/financeStore.tsx. A real payment transaction
// ledger (this file's core idea) replaces any notion of a single editable
// "Amount Paid" field: every peso received is its own PaymentTransaction,
// and totals/status are always calculated from that ledger.

import type { Batch, PackageType, UploadedFileMeta } from "@/types/student";

export type PaymentType =
  | "Reservation"
  | "Initial Payment"
  | "Partial Payment"
  | "Full Payment"
  | "Final Payment"
  | "Adjustment"
  | "Other";

export type PaymentMethod = "Bank Transfer" | "GCash" | "Maya" | "Credit Card" | "Cash" | "Other";

export type PaymentTransactionStatus = "Pending Verification" | "Verified" | "Rejected" | "Cancelled";

export interface PaymentTransaction {
  id: string; // e.g. PAY-B14-000001
  studentId: string; // internal StudentRecord.id
  studentDisplayId: string; // e.g. MAIA-B14-0006 (snapshot at time of payment)
  studentName: string; // snapshot at time of payment
  batch: Batch;
  package: PackageType;
  date: string; // ISO date the payment was made/recorded for
  type: PaymentType;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  status: PaymentTransactionStatus;
  proof: UploadedFileMeta | null;
  notes: string;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
}

export type AdjustmentType = "Discount" | "Scholarship" | "Special Rate" | "Manual Adjustment";

/** A package price adjustment. Never overwrites the original price — only reduces the final amount owed. */
export interface PackageAdjustment {
  id: string;
  studentId: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  createdBy: string;
  date: string;
  time: string;
  createdAt: string;
}

export type ExpenseCategory =
  | "Venue"
  | "Staff"
  | "Marketing"
  | "Facebook Ads"
  | "Food"
  | "Transportation"
  | "Training Materials"
  | "Printing"
  | "Certificates"
  | "Student IDs"
  | "Lanyards"
  | "Office Supplies"
  | "Utilities"
  | "Software"
  | "Subscriptions"
  | "Inventory"
  | "Professional Fees"
  | "Other";

export type ExpenseStatus = "Active" | "Void";

export interface Expense {
  id: string; // e.g. EXP-2026-000001
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
  recordedBy: string;
  status: ExpenseStatus;
  voidReason: string | null;
  createdAt: string;
}

/** Global finance audit trail, separate from a student's own Activity History tab. */
export interface FinanceActivityEntry {
  id: string;
  action: string;
  recordType: "payment" | "expense" | "adjustment";
  recordId: string;
  previousValue?: string;
  newValue?: string;
  user: string;
  date: string;
  time: string;
  createdAt: string;
}
