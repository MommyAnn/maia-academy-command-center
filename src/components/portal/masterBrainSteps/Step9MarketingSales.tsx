import { Card, CardHeader } from "@/components/common/Card";
import { TextAreaField } from "@/components/common/TextAreaField";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { CONTENT_TYPES, MARKETING_CHANNELS, SALES_CHANNELS } from "@/types/masterBrain";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";

export function Step9MarketingSales({ draft, onChange }: StepProps) {
  const m = draft.marketingSales;
  const set = (patch: Partial<typeof m>) => onChange({ marketingSales: { ...m, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="How Customers Find & Buy From You" />
        <div className="flex flex-col gap-4">
          <TextAreaField label="Where do customers currently find you?" value={m.whereCustomersFindYou} onChange={(e) => set({ whereCustomersFindYou: e.target.value })} rows={2} />
          <TextAreaField label="How do you currently get leads?" value={m.howYouGetLeads} onChange={(e) => set({ howYouGetLeads: e.target.value })} rows={2} />
          <ChipMultiSelect label="How do customers buy?" options={SALES_CHANNELS} value={m.howCustomersBuy} onChange={(next) => set({ howCustomersBuy: next })} />
          <ChipMultiSelect label="Current marketing channels" options={MARKETING_CHANNELS} value={m.currentChannels} onChange={(next) => set({ currentChannels: next })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Sales Process" subtitle="Describe your current customer journey, e.g. Ad → Messenger → Inquiry → Offer → Payment → Delivery → Follow-up." />
        <div className="flex flex-col gap-4">
          <TextAreaField label="Describe your current customer journey" value={m.customerJourney} onChange={(e) => set({ customerJourney: e.target.value })} />
          <TextAreaField label="Where do customers usually drop off?" value={m.whereCustomersDropOff} onChange={(e) => set({ whereCustomersDropOff: e.target.value })} rows={2} />
          <TextAreaField label="What is your biggest sales challenge?" value={m.biggestSalesChallenge} onChange={(e) => set({ biggestSalesChallenge: e.target.value })} rows={2} />
          <TextAreaField label="What is your biggest marketing challenge?" value={m.biggestMarketingChallenge} onChange={(e) => set({ biggestMarketingChallenge: e.target.value })} rows={2} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Content Information" />
        <div className="flex flex-col gap-4">
          <TextAreaField label="What content do you currently create?" value={m.currentContent} onChange={(e) => set({ currentContent: e.target.value })} rows={2} />
          <TextAreaField label="What content performs best?" value={m.bestPerformingContent} onChange={(e) => set({ bestPerformingContent: e.target.value })} rows={2} />
          <TextAreaField label="What topics can you confidently teach?" value={m.topicsCanTeach} onChange={(e) => set({ topicsCanTeach: e.target.value })} rows={2} />
          <TextAreaField label="What questions do customers repeatedly ask?" value={m.repeatedQuestions} onChange={(e) => set({ repeatedQuestions: e.target.value })} rows={2} />
          <TextAreaField label="What misconceptions exist in your industry?" value={m.misconceptions} onChange={(e) => set({ misconceptions: e.target.value })} rows={2} />
          <ChipMultiSelect label="What content would you like AI to help create?" options={CONTENT_TYPES} value={m.contentWantAiToHelp} onChange={(next) => set({ contentWantAiToHelp: next })} />
        </div>
      </Card>
    </div>
  );
}
