import { useState } from "react";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/common/Button";
import { StepIndicator } from "@/components/enrollment/StepIndicator";
import { StudentInfoStep } from "@/components/enrollment/StudentInfoStep";
import { EnrollmentInfoStep } from "@/components/enrollment/EnrollmentInfoStep";
import { RequirementsStep } from "@/components/enrollment/RequirementsStep";
import { TermsStep } from "@/components/enrollment/TermsStep";
import { ReviewStep } from "@/components/enrollment/ReviewStep";
import { SuccessScreen } from "@/components/enrollment/SuccessScreen";
import {
  INITIAL_ENROLLMENT_FORM_STATE,
  validateEnrollmentInfo,
  validateRequirements,
  validateStudentInfo,
  validateTerms,
  type EnrollmentFormErrors,
  type EnrollmentFormState,
} from "@/components/enrollment/formState";
import { useStudentStore } from "@/data/studentStore";
import { CURRENT_TERMS_VERSION } from "@/data/enrollmentConfig";
import { fileToMeta } from "@/utils/students";

const STEPS = [
  { label: "Student Info" },
  { label: "Enrollment" },
  { label: "Requirements" },
  { label: "Terms" },
  { label: "Review" },
];

export function EnrollmentForm() {
  const { submitEnrollment } = useStudentStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<EnrollmentFormState>(INITIAL_ENROLLMENT_FORM_STATE);
  const [errors, setErrors] = useState<EnrollmentFormErrors>({});
  const [submittedStudentId, setSubmittedStudentId] = useState<string | null>(null);

  function patchForm(patch: Partial<EnrollmentFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function setFieldError(field: keyof EnrollmentFormState, message: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function validateCurrentStep(): boolean {
    let stepErrors: EnrollmentFormErrors = {};
    if (stepIndex === 0) stepErrors = validateStudentInfo(form);
    if (stepIndex === 1) stepErrors = validateEnrollmentInfo(form);
    if (stepIndex === 2) stepErrors = validateRequirements(form);
    if (stepIndex === 3) stepErrors = validateTerms(form);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit() {
    if (!form.batch || !form.package || !form.attendance) return;

    const created = submitEnrollment({
      facebookName: form.facebookName.trim(),
      fullName: form.fullName.trim(),
      companionName: form.companionName.trim(),
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim(),
      city: form.city.trim(),
      batch: form.batch,
      package: form.package,
      attendance: form.attendance,
      validIdFile: form.validIdFile ? fileToMeta(form.validIdFile) : null,
      proofOfPaymentFile: form.proofOfPaymentFile ? fileToMeta(form.proofOfPaymentFile) : null,
      termsAccepted: form.termsAccepted,
      termsVersion: CURRENT_TERMS_VERSION,
    });

    setSubmittedStudentId(created.studentId);
  }

  return (
    <div className="min-h-screen bg-maia-bg">
      <header className="border-b border-maia-border bg-maia-black">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 py-8 text-center sm:py-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-maia-gold/40 bg-maia-black-soft">
            <span className="font-display text-lg font-bold text-maia-gold">M</span>
          </div>
          <p className="font-display text-xs font-bold tracking-[0.3em] text-maia-gold">M.A.I.A.</p>
          <p className="text-xs text-white/60">Mommy Ann Import Academy</p>
          <h1 className="mt-1 font-display text-xl font-extrabold text-white sm:text-2xl">
            STUDENT ENROLLMENT FORM
          </h1>
          {!submittedStudentId && (
            <p className="mt-1 max-w-md text-sm text-white/60">
              Complete your information below to begin your enrollment.
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <div className="rounded-2xl border border-maia-border bg-maia-surface p-5 shadow-sm sm:p-8">
          {submittedStudentId ? (
            <SuccessScreen studentId={submittedStudentId} />
          ) : (
            <>
              <div className="mb-8">
                <StepIndicator steps={STEPS} currentIndex={stepIndex} />
              </div>

              {stepIndex === 0 && <StudentInfoStep form={form} errors={errors} onChange={patchForm} />}
              {stepIndex === 1 && <EnrollmentInfoStep form={form} errors={errors} onChange={patchForm} />}
              {stepIndex === 2 && (
                <RequirementsStep form={form} errors={errors} onChange={patchForm} onFileError={setFieldError} />
              )}
              {stepIndex === 3 && <TermsStep form={form} errors={errors} onChange={patchForm} />}
              {stepIndex === 4 && <ReviewStep form={form} onEditStep={setStepIndex} />}

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-maia-border pt-6">
                <Button variant="secondary" onClick={handleBack} disabled={stepIndex === 0} className="flex-1 justify-center sm:flex-none">
                  <ChevronLeft size={16} />
                  BACK
                </Button>

                {stepIndex < STEPS.length - 1 ? (
                  <Button onClick={handleNext} className="flex-1 justify-center sm:flex-none">
                    NEXT
                    <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} className="flex-1 justify-center sm:flex-none">
                    <Send size={15} />
                    CONFIRM &amp; SUBMIT
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-maia-ink-soft">
          &copy; {new Date().getFullYear()} Mommy Ann Import Academy &middot; M.A.I.A. Business Solutions Academy
        </p>
      </main>
    </div>
  );
}
