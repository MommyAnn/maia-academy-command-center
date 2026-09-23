// Normalization (spec section 10) — every function here returns a cleaned
// value for matching/storage while the ORIGINAL raw row is preserved
// unmodified in ImportRecord.rawDataJson, so a reviewer can always see
// exactly what the source spreadsheet actually said.

export function normalizeName(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function normalizePhone(value: string | undefined | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length > 0 ? digits : null;
}

export function isValidPhone(value: string): boolean {
  return value.length >= 7 && value.length <= 15;
}

/** Accepts ISO (YYYY-MM-DD) and unambiguous slash formats only — an ambiguous MM/DD vs DD/MM date is a validation error, never a guess. */
export function normalizeDate(value: string | undefined | null): { date: Date | null; ambiguous: boolean } {
  if (!value || value.trim().length === 0) return { date: null, ambiguous: false };
  const trimmed = value.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    return { date: Number.isNaN(date.getTime()) ? null : date, ambiguous: false };
  }

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = Number(slash[3]);
    // Unambiguous only when one side cannot possibly be a month (>12).
    if (first > 12 && second <= 12) {
      return { date: new Date(Date.UTC(year, second - 1, first)), ambiguous: false };
    }
    if (second > 12 && first <= 12) {
      return { date: new Date(Date.UTC(year, first - 1, second)), ambiguous: false };
    }
    return { date: null, ambiguous: true };
  }

  return { date: null, ambiguous: false };
}

/** Strips currency symbols/commas/whitespace; never rounds or guesses a missing amount. */
export function normalizeAmount(value: string | undefined | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (cleaned.length === 0) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  gcash: "GCash",
  "g-cash": "GCash",
  bank: "Bank Transfer",
  banktransfer: "Bank Transfer",
  "bank transfer": "Bank Transfer",
  cash: "Cash",
  paymaya: "Maya",
  maya: "Maya",
  card: "Card",
  creditcard: "Card",
};

export function normalizePaymentMethod(value: string | undefined | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase().replace(/\s+/g, "");
  return PAYMENT_METHOD_ALIASES[key] ?? normalizeName(value);
}
