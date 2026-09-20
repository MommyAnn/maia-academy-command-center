import { ATTENDANCE_OPTIONS, BATCH_OPTIONS, PACKAGE_OPTIONS } from "@/data/enrollmentConfig";
import { AttendanceOptionCard } from "./AttendanceOptionCard";
import { SectionTitle } from "./StudentInfoStep";
import type { EnrollmentFormErrors, EnrollmentFormState } from "./formState";

export function EnrollmentInfoStep({
  form,
  errors,
  onChange,
}: {
  form: EnrollmentFormState;
  errors: EnrollmentFormErrors;
  onChange: (patch: Partial<EnrollmentFormState>) => void;
}) {
  return (
    <div>
      <SectionTitle title="Enrollment Information" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">
            Batch Number<span className="ml-0.5 text-maia-danger">*</span>
          </label>
          <select
            value={form.batch}
            onChange={(e) => onChange({ batch: e.target.value as EnrollmentFormState["batch"] })}
            className="w-full rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          >
            <option value="" disabled>
              Select a batch
            </option>
            {BATCH_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {errors.batch && <p className="mt-1 text-xs font-medium text-maia-danger">{errors.batch}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">
            Package Enrolled<span className="ml-0.5 text-maia-danger">*</span>
          </label>
          <select
            value={form.package}
            onChange={(e) => onChange({ package: e.target.value as EnrollmentFormState["package"] })}
            className="w-full rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          >
            <option value="" disabled>
              Select a package
            </option>
            {PACKAGE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.package && <p className="mt-1 text-xs font-medium text-maia-danger">{errors.package}</p>}
        </div>
      </div>

      <div className="mt-7">
        <p className="mb-1 text-sm font-semibold text-maia-ink">
          How do you plan to join us?<span className="ml-0.5 text-maia-danger">*</span>
        </p>
        <p className="mb-3 text-xs text-maia-ink-soft">Select one option.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ATTENDANCE_OPTIONS.map((opt) => (
            <AttendanceOptionCard
              key={opt.value}
              value={opt.value}
              label={opt.label}
              description={opt.description}
              selected={form.attendance === opt.value}
              onSelect={() => onChange({ attendance: opt.value })}
            />
          ))}
        </div>
        {errors.attendance && <p className="mt-2 text-xs font-medium text-maia-danger">{errors.attendance}</p>}
      </div>
    </div>
  );
}
