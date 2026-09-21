import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { RepeatableCardList } from "@/components/portal/masterBrainSteps/RepeatableCardList";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";
import type { PainPointEntry } from "@/types/masterBrain";

function newPainPoint(): PainPointEntry {
  return {
    id: crypto.randomUUID(),
    painPoint: "",
    severity: "",
    customerSegment: "",
    currentSolution: "",
    whySolutionFails: "",
    emotionalImpact: "",
    businessImpact: "",
  };
}

export function Step5CustomerProblems({ draft, onChange }: StepProps) {
  const n = draft.problemsNarrative;
  const painPoints = draft.painPoints;
  const setN = (patch: Partial<typeof n>) => onChange({ problemsNarrative: { ...n, ...patch } });

  function updatePainPoint(index: number, patch: Partial<PainPointEntry>) {
    const next = [...painPoints];
    next[index] = { ...next[index], ...patch };
    onChange({ painPoints: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Customer Problems" subtitle="Tell us in detail what your customers struggle with." />
        <div className="flex flex-col gap-4">
          <TextAreaField label="What are your customer's biggest problems?" value={n.biggestProblems} onChange={(e) => setN({ biggestProblems: e.target.value })} required />
          <TextAreaField label="What frustrates them?" value={n.frustrations} onChange={(e) => setN({ frustrations: e.target.value })} />
          <TextAreaField label="What have they already tried?" value={n.triedBefore} onChange={(e) => setN({ triedBefore: e.target.value })} />
          <TextAreaField label="Why didn't those solutions work?" value={n.whyDidntWork} onChange={(e) => setN({ whyDidntWork: e.target.value })} />
          <TextAreaField label="What are they afraid might happen if the problem continues?" value={n.fearsIfUnresolved} onChange={(e) => setN({ fearsIfUnresolved: e.target.value })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="What Does The Problem Cost Them?" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Money" value={n.costMoney} onChange={(e) => setN({ costMoney: e.target.value })} />
          <TextField label="Time" value={n.costTime} onChange={(e) => setN({ costTime: e.target.value })} />
          <TextField label="Stress" value={n.costStress} onChange={(e) => setN({ costStress: e.target.value })} />
          <TextField label="Lost Opportunities" value={n.costOpportunities} onChange={(e) => setN({ costOpportunities: e.target.value })} />
          <TextField label="Confidence" value={n.costConfidence} onChange={(e) => setN({ costConfidence: e.target.value })} />
          <TextField label="Business Growth" value={n.costGrowth} onChange={(e) => setN({ costGrowth: e.target.value })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Pain Point Database" subtitle="Structured entries AI can later use for ads, hooks, content, and offers." />
        <RepeatableCardList
          items={painPoints}
          onAdd={() => onChange({ painPoints: [...painPoints, newPainPoint()] })}
          onRemove={(index) => onChange({ painPoints: painPoints.filter((_, i) => i !== index) })}
          onItemChange={updatePainPoint}
          addLabel="ADD PAIN POINT"
          emptyLabel="No pain points added yet."
          itemLabel={(item, index) => item.painPoint || `Pain Point ${index + 1}`}
          renderItem={(item, update) => (
            <>
              <TextField label="Pain Point" value={item.painPoint} onChange={(e) => update({ painPoint: e.target.value })} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  label="Severity"
                  value={item.severity}
                  onChange={(e) => update({ severity: e.target.value as PainPointEntry["severity"] })}
                  placeholder="Select severity"
                  options={[
                    { value: "Low", label: "Low" },
                    { value: "Medium", label: "Medium" },
                    { value: "High", label: "High" },
                  ]}
                />
                <TextField label="Customer Segment" value={item.customerSegment} onChange={(e) => update({ customerSegment: e.target.value })} />
              </div>
              <TextAreaField label="Current Solution" value={item.currentSolution} onChange={(e) => update({ currentSolution: e.target.value })} rows={2} />
              <TextAreaField label="Why Current Solution Fails" value={item.whySolutionFails} onChange={(e) => update({ whySolutionFails: e.target.value })} rows={2} />
              <TextAreaField label="Emotional Impact" value={item.emotionalImpact} onChange={(e) => update({ emotionalImpact: e.target.value })} rows={2} />
              <TextAreaField label="Business Impact" value={item.businessImpact} onChange={(e) => update({ businessImpact: e.target.value })} rows={2} />
            </>
          )}
        />
      </Card>
    </div>
  );
}
