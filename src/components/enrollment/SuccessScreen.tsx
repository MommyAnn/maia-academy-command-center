import { CheckCircle2 } from "lucide-react";

export function SuccessScreen({ studentId }: { studentId: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-maia-success-bg text-maia-success">
        <CheckCircle2 size={32} strokeWidth={1.75} />
      </div>
      <h2 className="font-display text-2xl font-extrabold text-maia-ink">ENROLLMENT SUBMITTED</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-maia-ink-soft">
        Thank you! Your enrollment information has been received. Our M.A.I.A. team will review your
        payment and requirements.
      </p>

      <div className="mt-6 rounded-xl border border-maia-gold/30 bg-maia-gold-bg px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-maia-gold-deep">Your Student ID</p>
        <p className="mt-1 font-mono text-2xl font-extrabold tracking-wide text-maia-ink">{studentId}</p>
      </div>

      <p className="mt-6 text-xs text-maia-ink-soft">
        Please keep this Student ID for your records &mdash; our team will use it to reference your
        enrollment.
      </p>
    </div>
  );
}
