import type { MasterBrainSubmission } from "@/types/masterBrain";

/** Shared prop contract for every questionnaire step component (Step1..Step11). `draft` is the wizard's local unsaved copy — see Questionnaire.tsx for why edits stay local until Save Draft/Next. */
export interface StepProps {
  draft: MasterBrainSubmission;
  onChange: (patch: Partial<MasterBrainSubmission>) => void;
}
