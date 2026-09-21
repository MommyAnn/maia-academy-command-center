import { Card, CardHeader } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { RepeatableCardList } from "@/components/portal/masterBrainSteps/RepeatableCardList";
import type { StepProps } from "@/components/portal/masterBrainSteps/types";
import type { OfferRecord } from "@/types/masterBrain";

function newOffer(): OfferRecord {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "",
    description: "",
    price: "",
    cost: "",
    targetCustomer: "",
    mainBenefit: "",
    problemSolved: "",
    features: "",
    outcome: "",
    uniqueSellingPoint: "",
    isBestSeller: false,
    isCurrent: true,
  };
}

export function Step3ProductsServices({ draft, onChange }: StepProps) {
  const offers = draft.offers;
  const primary = draft.primaryOffer;

  function updateOffer(index: number, patch: Partial<OfferRecord>) {
    const next = [...offers];
    next[index] = { ...next[index], ...patch };
    onChange({ offers: next });
  }

  function setPrimary(patch: Partial<typeof primary>) {
    onChange({ primaryOffer: { ...primary, ...patch } });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Products & Services" subtitle="Add every product or service you offer — you're not limited to one." />
        <RepeatableCardList
          items={offers}
          onAdd={() => onChange({ offers: [...offers, newOffer()] })}
          onRemove={(index) => onChange({ offers: offers.filter((_, i) => i !== index) })}
          onItemChange={updateOffer}
          addLabel="ADD ANOTHER PRODUCT OR SERVICE"
          emptyLabel="No products or services added yet."
          itemLabel={(item, index) => item.name || `Offer ${index + 1}`}
          renderItem={(item, update) => (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="Product / Service Name" value={item.name} onChange={(e) => update({ name: e.target.value })} required />
                <TextField label="Category" value={item.category} onChange={(e) => update({ category: e.target.value })} />
                <TextField label="Selling Price (₱)" value={item.price} onChange={(e) => update({ price: e.target.value })} />
                <TextField label="Cost (optional)" value={item.cost} onChange={(e) => update({ cost: e.target.value })} />
              </div>
              <TextAreaField label="Description" value={item.description} onChange={(e) => update({ description: e.target.value })} rows={2} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="Target Customer" value={item.targetCustomer} onChange={(e) => update({ targetCustomer: e.target.value })} />
                <TextField label="Main Benefit" value={item.mainBenefit} onChange={(e) => update({ mainBenefit: e.target.value })} />
                <TextField label="Problem Solved" value={item.problemSolved} onChange={(e) => update({ problemSolved: e.target.value })} />
                <TextField label="Customer Outcome" value={item.outcome} onChange={(e) => update({ outcome: e.target.value })} />
              </div>
              <TextAreaField label="Features" value={item.features} onChange={(e) => update({ features: e.target.value })} rows={2} />
              <TextAreaField label="Unique Selling Point" value={item.uniqueSellingPoint} onChange={(e) => update({ uniqueSellingPoint: e.target.value })} rows={2} />
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-maia-ink">
                  <input type="checkbox" checked={item.isBestSeller} onChange={(e) => update({ isBestSeller: e.target.checked })} className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep" />
                  Best Seller
                </label>
                <label className="flex items-center gap-2 text-sm text-maia-ink">
                  <input type="checkbox" checked={item.isCurrent} onChange={(e) => update({ isCurrent: e.target.checked })} className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep" />
                  Currently Offered (uncheck if planned)
                </label>
              </div>
            </>
          )}
        />
      </Card>

      {offers.length > 0 && (
        <Card>
          <CardHeader title="Primary Offer" subtitle="Which product/service is your main focus?" />
          <div className="flex flex-col gap-4">
            <SelectField
              label="Primary Offer"
              value={primary.primaryOfferId ?? ""}
              onChange={(e) => setPrimary({ primaryOfferId: e.target.value || null })}
              placeholder="Select your primary offer"
              options={offers.map((o) => ({ value: o.id, label: o.name || "Untitled offer" }))}
            />
            <TextAreaField label="Why is this your primary offer?" value={primary.why} onChange={(e) => setPrimary({ why: e.target.value })} rows={2} />
            <TextAreaField label="What is the main transformation or result it provides?" value={primary.transformation} onChange={(e) => setPrimary({ transformation: e.target.value })} rows={2} />
            <TextAreaField label="What makes customers choose this offer?" value={primary.whyCustomersChoose} onChange={(e) => setPrimary({ whyCustomersChoose: e.target.value })} rows={2} />
            <TextAreaField label="What objections do customers usually have?" value={primary.commonObjections} onChange={(e) => setPrimary({ commonObjections: e.target.value })} rows={2} />
            <TextAreaField label="What questions do customers usually ask before buying?" value={primary.commonQuestions} onChange={(e) => setPrimary({ commonQuestions: e.target.value })} rows={2} />
          </div>
        </Card>
      )}
    </div>
  );
}
