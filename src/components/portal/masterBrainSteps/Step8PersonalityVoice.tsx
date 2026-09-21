import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { PERSONALITY_TRAITS, VOICE_STYLES } from "@/types/masterBrain";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

export function Step8PersonalityVoice({ draft, onChange }: StepProps) {
  const v = draft.personalityVoice;
  const set = (patch: Partial<typeof v>) => onChange({ personalityVoice: { ...v, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Brand Personality" subtitle="If your brand were a person, how would you describe it?" />
        <div className="flex flex-col gap-4">
          <ChipMultiSelect label="Select all traits that fit" options={PERSONALITY_TRAITS} value={v.traits} onChange={(next) => set({ traits: next })} />
          <TextField label="Custom Traits (optional)" value={v.customTraits} onChange={(e) => set({ customTraits: e.target.value })} placeholder="Add your own, comma-separated" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Brand Voice" subtitle="How should your brand communicate?" />
        <div className="flex flex-col gap-4">
          <ChipMultiSelect label="Voice Style" options={VOICE_STYLES} value={v.voiceStyles} onChange={(next) => set({ voiceStyles: next })} />
          <TextField label="Preferred Language" value={v.preferredLanguage} onChange={(e) => set({ preferredLanguage: e.target.value })} placeholder="e.g. Taglish, English, Filipino" />
          <TextAreaField label="Words/Phrases We Like" value={v.wordsWeLike} onChange={(e) => set({ wordsWeLike: e.target.value })} rows={2} />
          <TextAreaField label="Words/Phrases We Avoid" value={v.wordsWeAvoid} onChange={(e) => set({ wordsWeAvoid: e.target.value })} rows={2} />
          <TextField label="How We Address Customers" value={v.howWeAddressCustomers} onChange={(e) => set({ howWeAddressCustomers: e.target.value })} placeholder="e.g. Ate, Kuya, first names, Sir/Ma'am" />
          <TextAreaField label="Communication Style" value={v.communicationStyle} onChange={(e) => set({ communicationStyle: e.target.value })} rows={2} />
        </div>
      </Card>
    </div>
  );
}
