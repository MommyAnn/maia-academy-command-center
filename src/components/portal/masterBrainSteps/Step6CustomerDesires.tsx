import { Card, CardHeader } from "@/components/common/Card";
import { TextAreaField } from "@/components/common/TextAreaField";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

export function Step6CustomerDesires({ draft, onChange }: StepProps) {
  const d = draft.desires;
  const set = (patch: Partial<typeof d>) => onChange({ desires: { ...d, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Customer Desires" />
        <div className="flex flex-col gap-4">
          <TextAreaField label="What does your customer ultimately want?" value={d.ultimateWant} onChange={(e) => set({ ultimateWant: e.target.value })} required />
          <TextAreaField label="What result are they looking for?" value={d.resultLookingFor} onChange={(e) => set({ resultLookingFor: e.target.value })} />
          <TextAreaField label="What would success look like?" value={d.successLooksLike} onChange={(e) => set({ successLooksLike: e.target.value })} />
          <TextAreaField label="What would make their life/business easier?" value={d.wouldMakeLifeEasier} onChange={(e) => set({ wouldMakeLifeEasier: e.target.value })} />
          <TextAreaField label="What emotional outcome do they want?" value={d.emotionalOutcome} onChange={(e) => set({ emotionalOutcome: e.target.value })} />
          <TextAreaField label="What transformation do they want?" value={d.transformation} onChange={(e) => set({ transformation: e.target.value })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Structured Desires" subtitle="These feed directly into the final Brand Master Brain document." />
        <div className="flex flex-col gap-4">
          <TextAreaField label="Goals" value={d.goals} onChange={(e) => set({ goals: e.target.value })} rows={2} />
          <TextAreaField label="Desires" value={d.desires} onChange={(e) => set({ desires: e.target.value })} rows={2} />
          <TextAreaField label="Dream Outcomes" value={d.dreamOutcomes} onChange={(e) => set({ dreamOutcomes: e.target.value })} rows={2} />
          <TextAreaField label="Emotional Desires" value={d.emotionalDesires} onChange={(e) => set({ emotionalDesires: e.target.value })} rows={2} />
          <TextAreaField label="Functional Desires" value={d.functionalDesires} onChange={(e) => set({ functionalDesires: e.target.value })} rows={2} />
        </div>
      </Card>
    </div>
  );
}
