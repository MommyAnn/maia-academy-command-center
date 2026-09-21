import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

export function Step7BrandPositioning({ draft, onChange }: StepProps) {
  const p = draft.positioning;
  const set = (patch: Partial<typeof p>) => onChange({ positioning: { ...p, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Brand Positioning" />
        <div className="flex flex-col gap-4">
          <TextAreaField label="How do you want customers to describe your brand?" value={p.howDescribed} onChange={(e) => set({ howDescribed: e.target.value })} />
          <TextAreaField label="What do you want to be known for?" value={p.knownFor} onChange={(e) => set({ knownFor: e.target.value })} />
          <TextAreaField label="Why should customers choose you instead of alternatives?" value={p.whyChooseUs} onChange={(e) => set({ whyChooseUs: e.target.value })} />
          <TextAreaField label="What makes your approach different?" value={p.whatMakesDifferent} onChange={(e) => set({ whatMakesDifferent: e.target.value })} />
          <TextAreaField label="What promise can your brand confidently make?" value={p.brandPromise} onChange={(e) => set({ brandPromise: e.target.value })} />
          <TextAreaField label="What should customers immediately understand about your brand?" value={p.immediateUnderstanding} onChange={(e) => set({ immediateUnderstanding: e.target.value })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Positioning Builder" subtitle="More structured fields the final document draws from directly." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Brand Category" value={p.brandCategory} onChange={(e) => set({ brandCategory: e.target.value })} />
          <TextField label="Market Position" value={p.marketPosition} onChange={(e) => set({ marketPosition: e.target.value })} />
          <div className="sm:col-span-2">
            <TextAreaField label="Unique Value Proposition" value={p.uniqueValueProposition} onChange={(e) => set({ uniqueValueProposition: e.target.value })} rows={2} required />
          </div>
          <div className="sm:col-span-2">
            <TextAreaField label="Core Promise" value={p.corePromise} onChange={(e) => set({ corePromise: e.target.value })} rows={2} />
          </div>
          <TextField label="Primary Differentiator" value={p.primaryDifferentiator} onChange={(e) => set({ primaryDifferentiator: e.target.value })} />
          <TextField label="Competitive Advantage" value={p.competitiveAdvantage} onChange={(e) => set({ competitiveAdvantage: e.target.value })} />
          <TextField label="Reason To Believe" value={p.reasonToBelieve} onChange={(e) => set({ reasonToBelieve: e.target.value })} />
          <TextField label="Proof / Credibility" value={p.proofCredibility} onChange={(e) => set({ proofCredibility: e.target.value })} />
          <div className="sm:col-span-2">
            <TextField label="Desired Market Perception" value={p.desiredPerception} onChange={(e) => set({ desiredPerception: e.target.value })} />
          </div>
        </div>
      </Card>
    </div>
  );
}
