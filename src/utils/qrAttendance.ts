// ---------------------------------------------------------------------------
// QR ATTENDANCE — DATA MODEL ONLY, NOT A REAL SCANNER
// ---------------------------------------------------------------------------
// Spec for Step 6 explicitly asks to "prepare the architecture" for a future
// QR-code check-in flow without building a fake/insecure one now. This file
// is that preparation: a single, stable identifier derivation that a real
// QR flow would encode, so quick/manual attendance (built now) and a future
// QR scanner can both resolve to the exact same student record.
//
// There is no camera integration, no QR image generation, and no scanning
// here — Quick Attendance (src/pages/training/Attendance.tsx) is manual
// search-and-tap, by design, until a real QR pipeline is built.
// ---------------------------------------------------------------------------

/** The value a future QR code would encode — derived from the student's existing Student ID so no new identifier needs to be issued. */
export function getStudentQrPayload(studentDisplayId: string): string {
  return `MAIA-QR:${studentDisplayId}`;
}

/** The inverse of getStudentQrPayload — what a future scanner would call after reading a code, to resolve back to a Student ID. Returns null for anything that isn't a value this app generated. */
export function resolveStudentIdFromQrPayload(payload: string): string | null {
  const prefix = "MAIA-QR:";
  return payload.startsWith(prefix) ? payload.slice(prefix.length) : null;
}
