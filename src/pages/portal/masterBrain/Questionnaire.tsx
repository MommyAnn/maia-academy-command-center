import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import { QUESTIONNAIRE_STEP_LABELS } from "@/types/masterBrain";
import type { MasterBrainSubmission } from "@/types/masterBrain";
import { Step1BusinessFoundation } from "@/components/portal/masterBrainSteps/Step1BusinessFoundation";
import { Step2Founder } from "@/components/portal/masterBrainSteps/Step2Founder";
import { Step3ProductsServices } from "@/components/portal/masterBrainSteps/Step3ProductsServices";
import { Step4TargetMarket } from "@/components/portal/masterBrainSteps/Step4TargetMarket";
import { Step5CustomerProblems } from "@/components/portal/masterBrainSteps/Step5CustomerProblems";
import { Step6CustomerDesires } from "@/components/portal/masterBrainSteps/Step6CustomerDesires";
import { Step7BrandPositioning } from "@/components/portal/masterBrainSteps/Step7BrandPositioning";
import { Step8PersonalityVoice } from "@/components/portal/masterBrainSteps/Step8PersonalityVoice";
import { Step9MarketingSales } from "@/components/portal/masterBrainSteps/Step9MarketingSales";
import { Step10Competitors } from "@/components/portal/masterBrainSteps/Step10Competitors";
import { Step11GoalsGrowth } from "@/components/portal/masterBrainSteps/Step11GoalsGrowth";
import { Step12FinalReview } from "@/components/portal/masterBrainSteps/Step12FinalReview";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

const TOTAL_STEPS = 12;

const STEP_COMPONENTS: { [step: number]: (props: StepProps) => React.JSX.Element } = {
  1: Step1BusinessFoundation,
  2: Step2Founder,
  3: Step3ProductsServices,
  4: Step4TargetMarket,
  5: Step5CustomerProblems,
  6: Step6CustomerDesires,
  7: Step7BrandPositioning,
  8: Step8PersonalityVoice,
  9: Step9MarketingSales,
  10: Step10Competitors,
  11: Step11GoalsGrowth,
};

export function Questionnaire() {
  const { student } = useStudentPortal();
  const { getSubmissionForStudent, startSubmission, updateSubmission, saveProgress, submitAssessment, resubmitAfterRevision } =
    useMasterBrainStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const stored = getSubmissionForStudent(student.id) ?? startSubmission(student.id);
  const [draft, setDraft] = useState<MasterBrainSubmission>(stored);
  const [step, setStep] = useState<number>(() => {
    const fromUrl = Number(searchParams.get("step"));
    return fromUrl >= 1 && fromUrl <= TOTAL_STEPS ? fromUrl : stored.currentStep || 1;
  });
  const [furthest, setFurthest] = useState(Math.max(step, stored.currentStep || 1));
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setSearchParams({ step: String(step) }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function persistAt(newFurthest: number) {
    const progressPercent = Math.round((newFurthest / TOTAL_STEPS) * 100);
    const patch = { ...draft, currentStep: newFurthest, progressPercent };
    updateSubmission(draft.id, patch);
    saveProgress(draft.id, newFurthest, progressPercent);
    setDraft(patch);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function goToStep(next: number) {
    if (next < 1 || next > TOTAL_STEPS) return;
    const newFurthest = Math.max(furthest, next);
    persistAt(newFurthest);
    setFurthest(newFurthest);
    setStep(next);
  }

  function handleSaveDraft() {
    persistAt(furthest);
  }

  function handleSubmit() {
    updateSubmission(draft.id, draft);
    if (draft.status === "Needs Revision") {
      resubmitAfterRevision(draft.id);
      navigate("/portal/master-brain");
      return;
    }
    const result = submitAssessment(draft.id);
    if (result.ok) {
      navigate("/portal/master-brain");
    }
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);
  const StepComponent = STEP_COMPONENTS[step];
  const onChange = (patch: Partial<MasterBrainSubmission>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex flex-col gap-4 pb-24 sm:pb-6">
      <div className="rounded-2xl border border-maia-border bg-maia-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-maia-ink">
            Step {step} of {TOTAL_STEPS}
          </p>
          <p className="font-display text-sm font-bold text-maia-gold-deep">{progressPercent}%</p>
        </div>
        <p className="mt-1 text-xs text-maia-ink-soft">{QUESTIONNAIRE_STEP_LABELS[step - 1]}</p>
        <div className="mt-3">
          <ProgressBar percent={progressPercent} />
        </div>

        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {QUESTIONNAIRE_STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const reachable = n <= furthest;
            return (
              <button
                key={label}
                disabled={!reachable}
                onClick={() => reachable && goToStep(n)}
                title={label}
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  n === step
                    ? "bg-maia-gold text-maia-black"
                    : reachable
                      ? "border border-maia-border text-maia-ink-soft hover:border-maia-gold hover:text-maia-gold-deep"
                      : "border border-maia-border/50 text-maia-ink-soft/40"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {step === TOTAL_STEPS ? (
        <Step12FinalReview draft={draft} onChange={onChange} onEditStep={goToStep} onSubmit={handleSubmit} />
      ) : (
        StepComponent && <StepComponent draft={draft} onChange={onChange} />
      )}

      {/* Sticky mobile-friendly controls */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-maia-border bg-maia-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <Button variant="secondary" onClick={() => goToStep(step - 1)} disabled={step === 1}>
          <ChevronLeft size={15} />
          PREVIOUS
        </Button>
        <div className="flex items-center gap-2">
          {justSaved && <span className="hidden text-xs font-medium text-maia-success sm:inline">Saved</span>}
          <Button variant="secondary" onClick={handleSaveDraft}>
            <Save size={14} />
            SAVE DRAFT
          </Button>
          {step < TOTAL_STEPS && (
            <Button onClick={() => goToStep(step + 1)}>
              NEXT
              <ChevronRight size={15} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
