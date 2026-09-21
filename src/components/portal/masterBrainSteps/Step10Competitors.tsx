import { AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { RepeatableCardList } from "@/components/portal/masterBrainSteps/RepeatableCardList";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";
import type { CompetitorRecord } from "@/types/masterBrain";

function newCompetitor(): CompetitorRecord {
  return {
    id: crypto.randomUUID(),
    name: "",
    websiteOrPage: "",
    productsServices: "",
    priceRange: "",
    strengths: "",
    weaknesses: "",
    whatCustomersLike: "",
    whatMakesUsDifferent: "",
  };
}

export function Step10Competitors({ draft, onChange }: StepProps) {
  const competitors = draft.competitors;

  function updateCompetitor(index: number, patch: Partial<CompetitorRecord>) {
    const next = [...competitors];
    next[index] = { ...next[index], ...patch };
    onChange({ competitors: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-maia-warning/30 bg-maia-warning-bg/30">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-maia-warning" />
          <p className="text-sm text-maia-ink-soft">
            These are your own observations about competitors — not independently verified facts. They&rsquo;ll be
            treated as your perspective, not confirmed research.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Competitors & Differentiation" />
        <RepeatableCardList
          items={competitors}
          onAdd={() => onChange({ competitors: [...competitors, newCompetitor()] })}
          onRemove={(index) => onChange({ competitors: competitors.filter((_, i) => i !== index) })}
          onItemChange={updateCompetitor}
          addLabel="ADD COMPETITOR"
          emptyLabel="No competitors added yet."
          itemLabel={(item, index) => item.name || `Competitor ${index + 1}`}
          renderItem={(item, update) => (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="Competitor Name" value={item.name} onChange={(e) => update({ name: e.target.value })} />
                <TextField label="Website / Page" value={item.websiteOrPage} onChange={(e) => update({ websiteOrPage: e.target.value })} />
                <TextField label="Products / Services" value={item.productsServices} onChange={(e) => update({ productsServices: e.target.value })} />
                <TextField label="Price Range" value={item.priceRange} onChange={(e) => update({ priceRange: e.target.value })} />
              </div>
              <TextAreaField label="Strengths" value={item.strengths} onChange={(e) => update({ strengths: e.target.value })} rows={2} />
              <TextAreaField label="Weaknesses" value={item.weaknesses} onChange={(e) => update({ weaknesses: e.target.value })} rows={2} />
              <TextAreaField label="What customers like about them" value={item.whatCustomersLike} onChange={(e) => update({ whatCustomersLike: e.target.value })} rows={2} />
              <TextAreaField label="What makes us different" value={item.whatMakesUsDifferent} onChange={(e) => update({ whatMakesUsDifferent: e.target.value })} rows={2} />
            </>
          )}
        />
      </Card>
    </div>
  );
}
