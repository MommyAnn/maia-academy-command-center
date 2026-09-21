import { useState } from "react";
import { AlertTriangle, CheckCircle2, Edit3 } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ProgressBar } from "@/components/common/ProgressBar";
import { computeCompletionPercent, getMissingRequiredFields } from "@/utils/masterBrain";
import type { MasterBrainSubmission } from "@/types/masterBrain";

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function FieldSummary({ obj }: { obj: object }) {
  const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
  });
  if (entries.length === 0) return <p className="text-sm text-maia-ink-soft">Not answered yet.</p>;
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{humanizeKey(k)}</dt>
          <dd className="mt-0.5 text-sm text-maia-ink">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewSection({
  title,
  step,
  onEditStep,
  children,
}: {
  title: string;
  step: number;
  onEditStep: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Button variant="secondary" size="sm" onClick={() => onEditStep(step)}>
            <Edit3 size={13} />
            EDIT SECTION
          </Button>
        }
      />
      {children}
    </Card>
  );
}

export function Step12FinalReview({
  draft,
  onEditStep,
  onSubmit,
}: {
  draft: MasterBrainSubmission;
  onChange: (patch: Partial<MasterBrainSubmission>) => void;
  onEditStep: (step: number) => void;
  onSubmit: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const completion = computeCompletionPercent(draft);
  const missing = getMissingRequiredFields(draft);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Final Review & Submission" subtitle="Review everything before sending your assessment to the M.A.I.A. team." />
        <div className="mb-2 flex items-end justify-between text-sm">
          <p className="font-medium text-maia-ink">Questionnaire Completion</p>
          <p className="font-display font-bold text-maia-gold-deep">{completion}%</p>
        </div>
        <ProgressBar percent={completion} />

        {missing.length > 0 ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-maia-danger/30 bg-maia-danger-bg px-4 py-3.5">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-maia-danger" />
            <div>
              <p className="text-sm font-semibold text-maia-danger">Missing required fields</p>
              <ul className="mt-1 list-inside list-disc text-sm text-maia-ink">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-maia-success/30 bg-maia-success-bg px-4 py-3.5">
            <CheckCircle2 size={16} className="flex-shrink-0 text-maia-success" />
            <p className="text-sm font-medium text-maia-success">All required fields are complete.</p>
          </div>
        )}
      </Card>

      <ReviewSection title="1. Business Foundation" step={1} onEditStep={onEditStep}>
        <FieldSummary obj={draft.businessFoundation} />
      </ReviewSection>

      <ReviewSection title="2. Founder / Business Owner" step={2} onEditStep={onEditStep}>
        <FieldSummary obj={draft.founder} />
      </ReviewSection>

      <ReviewSection title="3. Products & Services" step={3} onEditStep={onEditStep}>
        {draft.offers.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No products/services added yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {draft.offers.map((o) => (
              <li key={o.id} className="flex items-center gap-2 text-sm text-maia-ink">
                <Badge tone={o.isBestSeller ? "gold" : "neutral"}>{o.isBestSeller ? "Best Seller" : o.category || "Offer"}</Badge>
                {o.name || "Untitled offer"}
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      <ReviewSection title="4. Target Market" step={4} onEditStep={onEditStep}>
        {draft.avatars.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No customer avatars added yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {draft.avatars.map((a) => (
              <li key={a.id} className="text-sm text-maia-ink">
                <span className="font-semibold">{a.name || "Unnamed avatar"}</span>
                {a.description ? ` — ${a.description}` : ""}
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      <ReviewSection title="5. Customer Problems" step={5} onEditStep={onEditStep}>
        <FieldSummary obj={draft.problemsNarrative} />
        {draft.painPoints.length > 0 && (
          <p className="mt-3 text-xs text-maia-ink-soft">{draft.painPoints.length} pain point(s) logged.</p>
        )}
      </ReviewSection>

      <ReviewSection title="6. Customer Desires & Goals" step={6} onEditStep={onEditStep}>
        <FieldSummary obj={draft.desires} />
      </ReviewSection>

      <ReviewSection title="7. Brand Positioning" step={7} onEditStep={onEditStep}>
        <FieldSummary obj={draft.positioning} />
      </ReviewSection>

      <ReviewSection title="8. Brand Personality & Voice" step={8} onEditStep={onEditStep}>
        <FieldSummary obj={draft.personalityVoice} />
      </ReviewSection>

      <ReviewSection title="9. Marketing & Sales" step={9} onEditStep={onEditStep}>
        <FieldSummary obj={draft.marketingSales} />
      </ReviewSection>

      <ReviewSection title="10. Competitors & Differentiation" step={10} onEditStep={onEditStep}>
        {draft.competitors.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No competitors added yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {draft.competitors.map((c) => (
              <li key={c.id} className="text-sm text-maia-ink">
                {c.name || "Unnamed competitor"}
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      <ReviewSection title="11. Business Goals & Growth" step={11} onEditStep={onEditStep}>
        <FieldSummary obj={draft.goals} />
        {draft.challenges.selected.length > 0 && (
          <p className="mt-3 text-sm text-maia-ink">
            <span className="font-semibold">Challenges:</span> {draft.challenges.selected.join(", ")}
          </p>
        )}
        {draft.priorities.length > 0 && (
          <p className="mt-1.5 text-sm text-maia-ink">
            <span className="font-semibold">Priorities:</span> {draft.priorities.join(", ")}
          </p>
        )}
      </ReviewSection>

      <Card className="border-maia-gold/30 bg-maia-gold-bg/30">
        <p className="mb-4 text-sm text-maia-ink-soft">
          Once submitted, your assessment will be sent to the M.A.I.A. team for review. You may be asked for
          additional information before your final Brand Master Brain is completed.
        </p>
        <Button className="w-full sm:w-auto" onClick={() => setConfirmOpen(true)} disabled={missing.length > 0}>
          SUBMIT BRAND MASTER BRAIN ASSESSMENT
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onSubmit();
        }}
        title="Submit Brand Master Brain Assessment"
        description="Once submitted, your assessment will be sent to the M.A.I.A. team for review. You may be asked for additional information before your final Brand Master Brain is completed."
        confirmLabel="SUBMIT"
      />
    </div>
  );
}
