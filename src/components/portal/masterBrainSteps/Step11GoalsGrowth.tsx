import { Card, CardHeader } from "@/components/common/Card";
import { TextAreaField } from "@/components/common/TextAreaField";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { BUSINESS_CHALLENGE_OPTIONS, STRATEGIC_PRIORITY_OPTIONS } from "@/types/masterBrain";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

export function Step11GoalsGrowth({ draft, onChange }: StepProps) {
  const g = draft.goals;
  const c = draft.challenges;
  const setGoals = (patch: Partial<typeof g>) => onChange({ goals: { ...g, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Business Goals" subtitle="What are your goals for the next..." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextAreaField label="3 Months" value={g.threeMonths} onChange={(e) => setGoals({ threeMonths: e.target.value })} rows={2} />
          <TextAreaField label="6 Months" value={g.sixMonths} onChange={(e) => setGoals({ sixMonths: e.target.value })} rows={2} />
          <TextAreaField label="12 Months" value={g.twelveMonths} onChange={(e) => setGoals({ twelveMonths: e.target.value })} rows={2} />
          <TextAreaField label="3 Years" value={g.threeYears} onChange={(e) => setGoals({ threeYears: e.target.value })} rows={2} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Business Challenges" subtitle="What is currently preventing you from growing?" />
        <div className="flex flex-col gap-4">
          <ChipMultiSelect
            label="Select all that apply"
            options={BUSINESS_CHALLENGE_OPTIONS}
            value={c.selected}
            onChange={(next) => onChange({ challenges: { ...c, selected: next } })}
          />
          <TextAreaField label="Explain" value={c.explanation} onChange={(e) => onChange({ challenges: { ...c, explanation: e.target.value } })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Strategic Priorities" subtitle="Select your top priorities." />
        <ChipMultiSelect
          label="Top Priorities"
          options={STRATEGIC_PRIORITY_OPTIONS}
          value={draft.priorities}
          onChange={(next) => onChange({ priorities: next })}
        />
      </Card>
    </div>
  );
}
