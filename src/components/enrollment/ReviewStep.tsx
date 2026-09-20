import { Pencil } from "lucide-react";
import { SectionTitle } from "./StudentInfoStep";
import type { EnrollmentFormState } from "./formState";

export function ReviewStep({
  form,
  onEditStep,
}: {
  form: EnrollmentFormState;
  onEditStep: (stepIndex: number) => void;
}) {
  return (
    <div>
      <SectionTitle title="Review Your Information" />
      <p className="-mt-3 mb-5 text-sm text-maia-ink-soft">
        Please double-check your details before submitting your enrollment.
      </p>

      <ReviewSection title="Student Information" onEdit={() => onEditStep(0)}>
        <ReviewRow label="Facebook Name" value={form.facebookName} />
        <ReviewRow label="Real Full Name" value={form.fullName} />
        <ReviewRow label="Companion Name" value={form.companionName || "—"} />
        <ReviewRow label="Email Address" value={form.email} />
        <ReviewRow label="Contact Number" value={form.contactNumber} />
        <ReviewRow label="City / Location" value={form.city} />
      </ReviewSection>

      <ReviewSection title="Enrollment Information" onEdit={() => onEditStep(1)}>
        <ReviewRow label="Batch" value={form.batch} />
        <ReviewRow label="Package" value={form.package} />
        <ReviewRow label="Attendance Preference" value={form.attendance} />
      </ReviewSection>

      <ReviewSection title="Requirements" onEdit={() => onEditStep(2)}>
        <ReviewRow label="Valid ID Photo" value={form.validIdFile?.name ?? "—"} />
        <ReviewRow label="Proof of Payment" value={form.proofOfPaymentFile?.name ?? "—"} />
      </ReviewSection>

      <ReviewSection title="Terms & Conditions" onEdit={() => onEditStep(3)}>
        <ReviewRow label="Accepted" value={form.termsAccepted ? "Yes" : "No"} />
      </ReviewSection>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-maia-border bg-maia-bg px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-maia-ink-soft">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs font-semibold text-maia-gold-deep hover:text-maia-ink"
        >
          <Pencil size={12} />
          Edit
        </button>
      </div>
      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-maia-ink-soft/80">{label}</dt>
      <dd className="text-sm font-medium text-maia-ink">{value}</dd>
    </div>
  );
}
