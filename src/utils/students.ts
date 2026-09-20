import type { RequirementsSummary, StudentRecord, UploadedFileMeta } from "@/types/student";

export function getRequirementsSummary(student: StudentRecord): RequirementsSummary {
  const statuses = [student.validId.status, student.proofOfPayment.status];
  if (statuses.includes("Needs Resubmission")) return "Needs Resubmission";
  if (statuses.every((s) => s === "Verified")) return "Verified";
  return "For Verification";
}

export function getRemainingBalance(student: StudentRecord): number {
  return Math.max(0, student.payment.packagePrice - student.payment.amountPaid);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Captures lightweight metadata about a File the student selected during
 * enrollment. No real, secure storage backend exists yet, so only the name,
 * size, and type are kept — never the file's raw bytes.
 */
export function fileToMeta(file: File): UploadedFileMeta {
  return {
    fileName: file.name,
    fileSizeLabel: formatFileSize(file.size),
    fileType: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
