import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { RepeatableCardList } from "@/components/portal/masterBrainSteps/RepeatableCardList";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";
import type { CustomerAvatar } from "@/types/masterBrain";

const ONLINE_CHANNEL_OPTIONS = ["Facebook", "Instagram", "TikTok", "YouTube", "Google", "Shopee", "Lazada", "Other"];

function newAvatar(): CustomerAvatar {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    ageRange: "",
    gender: "",
    location: "",
    occupation: "",
    businessType: "",
    incomeRange: "",
    lifestyle: "",
    interests: "",
    buyingBehavior: "",
    onlineChannels: [],
    triggers: "",
    problems: "",
    goals: "",
    fears: "",
    objections: "",
    buyingTriggers: "",
    desiredOutcome: "",
    preferredChannels: "",
  };
}

export function Step4TargetMarket({ draft, onChange }: StepProps) {
  const avatars = draft.avatars;

  function updateAvatar(index: number, patch: Partial<CustomerAvatar>) {
    const next = [...avatars];
    next[index] = { ...next[index], ...patch };
    onChange({ avatars: next });
  }

  return (
    <Card>
      <CardHeader
        title="Target Market — Customer Avatars"
        subtitle="Build a detailed profile for each type of ideal customer. Example: Avatar 1 — First-Time Entrepreneur, Avatar 2 — Existing Business Owner."
      />
      <RepeatableCardList
        items={avatars}
        onAdd={() => onChange({ avatars: [...avatars, newAvatar()] })}
        onRemove={(index) => onChange({ avatars: avatars.filter((_, i) => i !== index) })}
        onItemChange={updateAvatar}
        addLabel="ADD CUSTOMER AVATAR"
        emptyLabel="No customer avatars added yet — add at least one to describe your ideal customer."
        itemLabel={(item, index) => item.name || `Avatar ${index + 1}`}
        renderItem={(item, update) => (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Avatar Name" value={item.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. First-Time Entrepreneur" required />
              <TextField label="Age Range" value={item.ageRange} onChange={(e) => update({ ageRange: e.target.value })} />
              <TextField label="Gender (if relevant)" value={item.gender} onChange={(e) => update({ gender: e.target.value })} />
              <TextField label="Location" value={item.location} onChange={(e) => update({ location: e.target.value })} />
              <TextField label="Occupation" value={item.occupation} onChange={(e) => update({ occupation: e.target.value })} />
              <TextField label="Business Type (if B2B)" value={item.businessType} onChange={(e) => update({ businessType: e.target.value })} />
              <TextField label="Income / Budget Range (optional)" value={item.incomeRange} onChange={(e) => update({ incomeRange: e.target.value })} />
            </div>
            <TextAreaField label="Description" value={item.description} onChange={(e) => update({ description: e.target.value })} rows={2} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextAreaField label="Lifestyle" value={item.lifestyle} onChange={(e) => update({ lifestyle: e.target.value })} rows={2} />
              <TextAreaField label="Interests" value={item.interests} onChange={(e) => update({ interests: e.target.value })} rows={2} />
            </div>
            <TextAreaField label="Buying Behavior" value={item.buyingBehavior} onChange={(e) => update({ buyingBehavior: e.target.value })} rows={2} />
            <ChipMultiSelect
              label="Where do they spend time online?"
              options={ONLINE_CHANNEL_OPTIONS}
              value={item.onlineChannels}
              onChange={(next) => update({ onlineChannels: next })}
            />
            <TextAreaField label="What usually triggers them to look for your product/service?" value={item.triggers} onChange={(e) => update({ triggers: e.target.value })} rows={2} />

            <div className="border-t border-maia-border pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">This Avatar's Problems &amp; Desires</p>
              <div className="flex flex-col gap-4">
                <TextAreaField label="Problems" value={item.problems} onChange={(e) => update({ problems: e.target.value })} rows={2} />
                <TextAreaField label="Goals" value={item.goals} onChange={(e) => update({ goals: e.target.value })} rows={2} />
                <TextAreaField label="Fears" value={item.fears} onChange={(e) => update({ fears: e.target.value })} rows={2} />
                <TextAreaField label="Objections" value={item.objections} onChange={(e) => update({ objections: e.target.value })} rows={2} />
                <TextAreaField label="Buying Triggers" value={item.buyingTriggers} onChange={(e) => update({ buyingTriggers: e.target.value })} rows={2} />
                <TextAreaField label="Desired Outcome" value={item.desiredOutcome} onChange={(e) => update({ desiredOutcome: e.target.value })} rows={2} />
                <TextField label="Preferred Channels" value={item.preferredChannels} onChange={(e) => update({ preferredChannels: e.target.value })} />
              </div>
            </div>
          </>
        )}
      />
    </Card>
  );
}
