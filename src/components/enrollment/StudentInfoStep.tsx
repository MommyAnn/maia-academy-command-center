import { TextField } from "@/components/common/TextField";
import type { EnrollmentFormErrors, EnrollmentFormState } from "./formState";

export function StudentInfoStep({
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
      <SectionTitle title="Student Information" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Facebook Name"
          required
          value={form.facebookName}
          error={errors.facebookName}
          onChange={(e) => onChange({ facebookName: e.target.value })}
          placeholder="e.g. Juana Dela Cruz"
        />
        <TextField
          label="Real Full Name"
          required
          value={form.fullName}
          error={errors.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          placeholder="Your complete legal name"
        />
        <TextField
          label="Companion Name (optional)"
          value={form.companionName}
          onChange={(e) => onChange({ companionName: e.target.value })}
          placeholder="If attending with a companion"
        />
        <TextField
          label="Email Address"
          type="email"
          required
          value={form.email}
          error={errors.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="you@email.com"
        />
        <TextField
          label="Contact Number"
          required
          value={form.contactNumber}
          error={errors.contactNumber}
          onChange={(e) => onChange({ contactNumber: e.target.value })}
          placeholder="09XX XXX XXXX"
        />
        <TextField
          label="City / Location"
          required
          value={form.city}
          error={errors.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="e.g. Quezon City"
        />
      </div>
    </div>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-5 font-display text-lg font-bold text-maia-ink">{title}</h2>
  );
}
