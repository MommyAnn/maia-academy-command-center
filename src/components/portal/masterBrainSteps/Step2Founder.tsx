import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

export function Step2Founder({ draft, onChange }: StepProps) {
  const f = draft.founder;
  const set = (patch: Partial<typeof f>) => onChange({ founder: { ...f, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Founder / Business Owner" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Founder / Owner Name" value={f.founderName} onChange={(e) => set({ founderName: e.target.value })} required />
          <TextField label="Role in Business" value={f.role} onChange={(e) => set({ role: e.target.value })} />
          <TextField label="Photo / Profile Reference (optional)" value={f.photoReference} onChange={(e) => set({ photoReference: e.target.value })} hint="A link or filename — no upload pipeline yet." />
        </div>
      </Card>

      <Card>
        <CardHeader title="Your Story" />
        <div className="flex flex-col gap-4">
          <TextAreaField label="Founder Story" value={f.founderStory} onChange={(e) => set({ founderStory: e.target.value })} />
          <TextAreaField label="Experience" value={f.experience} onChange={(e) => set({ experience: e.target.value })} />
          <TextAreaField label="Skills" value={f.skills} onChange={(e) => set({ skills: e.target.value })} />
          <TextAreaField label="Expertise" value={f.expertise} onChange={(e) => set({ expertise: e.target.value })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Credibility & Values" />
        <div className="flex flex-col gap-4">
          <TextAreaField label="Why should customers trust you?" value={f.whyTrustYou} onChange={(e) => set({ whyTrustYou: e.target.value })} />
          <TextAreaField label="What inspired the business?" value={f.inspiration} onChange={(e) => set({ inspiration: e.target.value })} />
          <TextAreaField label="Personal values that influence the brand" value={f.personalValues} onChange={(e) => set({ personalValues: e.target.value })} />
          <TextAreaField label="What do you want to become known for?" value={f.wantToBeKnownFor} onChange={(e) => set({ wantToBeKnownFor: e.target.value })} />
        </div>
      </Card>
    </div>
  );
}
