import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { BUSINESS_STAGES } from "@/types/masterBrain";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

export function Step1BusinessFoundation({ draft, onChange }: StepProps) {
  const bf = draft.businessFoundation;
  const set = (patch: Partial<typeof bf>) => onChange({ businessFoundation: { ...bf, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Business Basics" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Business Name" value={bf.businessName} onChange={(e) => set({ businessName: e.target.value })} required />
          <TextField label="Brand Name" value={bf.brandName} onChange={(e) => set({ brandName: e.target.value })} />
          <TextField label="Business Category / Industry" value={bf.category} onChange={(e) => set({ category: e.target.value })} />
          <TextField label="Business Type" value={bf.businessType} onChange={(e) => set({ businessType: e.target.value })} placeholder="e.g. Sole Proprietor, Partnership" />
          <TextField label="Business Location" value={bf.location} onChange={(e) => set({ location: e.target.value })} />
          <TextField label="Areas Served" value={bf.areasServed} onChange={(e) => set({ areasServed: e.target.value })} />
          <TextField label="Years in Business" value={bf.yearsInBusiness} onChange={(e) => set({ yearsInBusiness: e.target.value })} />
          <SelectField
            label="Current Business Stage"
            value={bf.stage}
            onChange={(e) => set({ stage: e.target.value as typeof bf.stage })}
            placeholder="Select a stage"
            options={BUSINESS_STAGES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Online Channels" subtitle="Leave any blank that don't apply." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Website" value={bf.website} onChange={(e) => set({ website: e.target.value })} />
          <TextField label="Facebook Page" value={bf.facebookPage} onChange={(e) => set({ facebookPage: e.target.value })} />
          <TextField label="Instagram" value={bf.instagram} onChange={(e) => set({ instagram: e.target.value })} />
          <TextField label="TikTok" value={bf.tiktok} onChange={(e) => set({ tiktok: e.target.value })} />
          <TextField label="Shopee" value={bf.shopee} onChange={(e) => set({ shopee: e.target.value })} />
          <TextField label="Lazada" value={bf.lazada} onChange={(e) => set({ lazada: e.target.value })} />
          <div className="sm:col-span-2">
            <TextField label="Other Channels" value={bf.otherChannels} onChange={(e) => set({ otherChannels: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tell Us About Your Business" />
        <div className="flex flex-col gap-4">
          <TextAreaField
            label="Describe your business in your own words"
            value={bf.description}
            onChange={(e) => set({ description: e.target.value })}
            required
          />
          <TextAreaField label="Why did you start this business?" value={bf.whyStarted} onChange={(e) => set({ whyStarted: e.target.value })} />
          <TextAreaField label="What problem does your business solve?" value={bf.problemSolved} onChange={(e) => set({ problemSolved: e.target.value })} />
          <TextAreaField label="What makes this business important to you?" value={bf.whyItMatters} onChange={(e) => set({ whyItMatters: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}
