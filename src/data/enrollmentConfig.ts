// Configuration/demo data for the Enrollment Form and Student Management
// dropdowns. Kept separate from UI components so these can later be loaded
// from a real database/settings table instead of being hardcoded.

import type { AttendancePreference, Batch, PackageType } from "@/types/student";

export const BATCH_OPTIONS: Batch[] = ["Batch 15", "Batch 14", "Batch 13", "Batch 12"];

export const PACKAGE_OPTIONS: PackageType[] = ["Premium", "VIP", "Dual VIP"];

// DEMO DATA: package pricing used only to populate the demo Payment Summary.
export const PACKAGE_PRICES: Record<PackageType, number> = {
  Premium: 25_000,
  VIP: 35_000,
  "Dual VIP": 48_000,
};

export const ATTENDANCE_OPTIONS: {
  value: AttendancePreference;
  label: string;
  description: string;
}[] = [
  {
    value: "Face-to-Face",
    label: "Face-to-Face",
    description: "Attending in person at the venue.",
  },
  {
    value: "Early Access via Zoom",
    label: "Early Access via Zoom",
    description: "Attending online via Zoom.",
  },
  {
    value: "Both",
    label: "Both",
    description: "Face-to-Face + Early Access Zoom",
  },
];

export const ACCEPTED_UPLOAD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];
export const ACCEPTED_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, demo limit only

export const CURRENT_TERMS_VERSION = "v1.0";

export const TERMS_AND_CONDITIONS_TEXT = `M.A.I.A. ENROLLMENT TERMS & CONDITIONS (${CURRENT_TERMS_VERSION})

1. ENROLLMENT & PAYMENT
   Enrollment is confirmed only after M.A.I.A. Business Solutions Academy has verified your proof of payment and submitted requirements.

2. REQUIREMENTS
   Students must submit a valid, government-issued ID and proof of payment. Submissions with unclear or invalid documents may be asked to resubmit.

3. ATTENDANCE
   Students must honor their selected attendance preference (Face-to-Face, Early Access via Zoom, or Both). Changes must be coordinated with the M.A.I.A. team.

4. DATA PRIVACY
   Information you provide is used solely for enrollment processing, training coordination, and academy records.

5. CONDUCT
   Students are expected to conduct themselves professionally during all training sessions, whether in person or online.

This is placeholder demo text for Step 2 of the M.A.I.A. Academy Command Center build. It will be replaced with the Academy's actual legal terms.`;
