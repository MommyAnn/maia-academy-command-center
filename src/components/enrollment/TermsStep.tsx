import { useState } from "react";
import { TermsModal } from "./TermsModal";
import { SectionTitle } from "./StudentInfoStep";
import type { EnrollmentFormErrors, EnrollmentFormState } from "./formState";

export function TermsStep({
  form,
  errors,
  onChange,
}: {
  form: EnrollmentFormState;
  errors: EnrollmentFormErrors;
  onChange: (patch: Partial<EnrollmentFormState>) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <SectionTitle title="Terms & Conditions" />

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="mb-4 text-sm font-semibold text-maia-gold-deep underline underline-offset-2 hover:text-maia-ink"
      >
        READ FULL TERMS &amp; CONDITIONS
      </button>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-maia-border bg-maia-bg px-4 py-4">
        <input
          type="checkbox"
          checked={form.termsAccepted}
          onChange={(e) => onChange({ termsAccepted: e.target.checked })}
          className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 rounded border-maia-border accent-maia-gold-deep"
        />
        <span className="text-sm text-maia-ink">
          I have read, understood, and agree to the M.A.I.A. Enrollment Terms &amp; Conditions.
        </span>
      </label>
      {errors.termsAccepted && (
        <p className="mt-2 text-xs font-medium text-maia-danger">{errors.termsAccepted}</p>
      )}

      <TermsModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
