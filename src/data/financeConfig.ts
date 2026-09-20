// Configuration/demo data for the Finance & Payment Management system.
// Kept separate from UI components so these can later be loaded from a real
// database/settings table instead of being hardcoded.

import type { AdjustmentType, ExpenseCategory, PaymentMethod, PaymentType } from "@/types/finance";

export const PAYMENT_TYPES: PaymentType[] = [
  "Reservation",
  "Initial Payment",
  "Partial Payment",
  "Full Payment",
  "Final Payment",
  "Adjustment",
  "Other",
];

export const PAYMENT_METHODS: PaymentMethod[] = ["Bank Transfer", "GCash", "Maya", "Credit Card", "Cash", "Other"];

export const ADJUSTMENT_TYPES: AdjustmentType[] = ["Discount", "Scholarship", "Special Rate", "Manual Adjustment"];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Venue",
  "Staff",
  "Marketing",
  "Facebook Ads",
  "Food",
  "Transportation",
  "Training Materials",
  "Printing",
  "Certificates",
  "Student IDs",
  "Lanyards",
  "Office Supplies",
  "Utilities",
  "Software",
  "Subscriptions",
  "Inventory",
  "Professional Fees",
  "Other",
];

export const CURRENT_DEMO_USER = "Mommy Ann";
