import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Award, CheckCircle2, Search, Star, UploadCloud } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { InfoTooltip } from "@/components/common/InfoTooltip";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { useFeedbackStore } from "@/data/feedbackStore";
import { useWebinarStore } from "@/data/webinarStore";
import { normalizeEmail } from "@/utils/webinar";
import { WEBINAR_MARKETING_CONSENT_STATEMENT } from "@/types/webinar";
import { MARKETING_PERMITTED_ASSETS, CURRENT_CONSENT_VERSION } from "@/types/feedback";
import type { MarketingPermittedAsset } from "@/types/feedback";

const WRITTEN_LIMIT = 2000;

/**
 * Public, non-authenticated feedback form for a Free Webinar Lead — no
 * Student login exists for them yet (spec section 29). Identifies the
 * person by email against the leads list, then reuses the SAME
 * feedbackStore.submitFeedback()/saveDraft() as the Student portal, with
 * leadId set and studentId left null — never a second feedback database.
 */
export function WebinarFeedbackSubmit() {
  const { requestId } = useParams<{ requestId: string }>();
  const { requests, saveDraft, submitFeedback, grantMarketingConsent, incentives } = useFeedbackStore();
  const { leads } = useWebinarStore();
  const navigate = useNavigate();

  const request = requests.find((r) => r.id === requestId);

  const [emailInput, setEmailInput] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);

  const [rating, setRating] = useState<number | null>(null);
  const [written, setWritten] = useState("");
  const [videoFileName, setVideoFileName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [allowMarketing, setAllowMarketing] = useState(false);
  const [permittedAssets, setPermittedAssets] = useState<MarketingPermittedAsset[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [bonusUnlocked, setBonusUnlocked] = useState(false);

  if (!request || request.status !== "Open") {
    return <Navigate to="/webinar/register" replace />;
  }

  const lead = leadId ? leads.find((l) => l.id === leadId) : undefined;

  function handleLookup() {
    const match = leads.find((l) => normalizeEmail(l.email) === normalizeEmail(emailInput));
    if (!match) {
      setLookupError("We couldn't find a webinar registration with that email. Please use the email you registered with.");
      return;
    }
    setLookupError("");
    setLeadId(match.id);
  }

  function buildInput() {
    return {
      requestId: request!.id,
      studentId: null,
      leadId: lead!.id,
      sourceType: request!.sourceType,
      sourceId: request!.sourceId,
      sourceLabel: request!.sourceLabel,
      batch: "" as const,
      rating,
      writtenFeedback: written,
      videoAsset: videoFileName
        ? { fileName: videoFileName, fileSizeLabel: "—", fileType: "video/mp4", uploadedAt: new Date().toISOString() }
        : null,
      answers: request!.questions.map((q) => ({ questionId: q.id, questionText: q.text, answer: answers[q.id] ?? "" })),
      incentiveId: request!.incentiveId,
    };
  }

  function handleSaveDraft() {
    saveDraft(null, buildInput());
    setLeadId(null);
    setEmailInput("");
  }

  function handleSubmit() {
    const result = submitFeedback(null, buildInput());
    if (allowMarketing && permittedAssets.length > 0) {
      grantMarketingConsent(result.feedbackId, lead!.id, permittedAssets, CURRENT_CONSENT_VERSION);
    }
    const hasGenuineSubmission = written.trim().length > 0 || Boolean(videoFileName);
    setBonusUnlocked(Boolean(request!.incentiveId) && hasGenuineSubmission);
    setSubmitted(true);
  }

  if (submitted) {
    const incentive = request.incentiveId ? incentives.find((i) => i.id === request.incentiveId) : undefined;
    return (
      <div className="flex min-h-screen items-center justify-center bg-maia-bg px-4 py-10">
        <Card className="mx-auto max-w-lg text-center">
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 size={40} className="text-maia-success" />
            <p className="font-display text-lg font-bold text-maia-ink">Thank you for your feedback!</p>
            <p className="text-sm text-maia-ink-soft">Your response has been received and helps us keep improving M.A.I.A. Academy.</p>
            {bonusUnlocked && incentive && (
              <div className="mt-2 flex w-full flex-col items-center gap-2 rounded-xl border border-maia-gold/40 bg-maia-gold-bg px-4 py-4">
                <Award size={22} className="text-maia-gold-deep" />
                <p className="text-sm font-bold text-maia-ink">🎁 YOUR BONUS IS READY!</p>
                <p className="text-xs text-maia-ink-soft">{incentive.name}</p>
                <p className="text-[11px] text-maia-ink-soft">Our team will reach out with delivery details once you're confirmed.</p>
              </div>
            )}
            <Button className="mt-2" onClick={() => navigate("/webinar/register")}>
              BACK TO M.A.I.A. ACADEMY
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-maia-bg px-4 py-10">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader title={request.title} subtitle="Enter the email you used to register so we can find your webinar record." />
          <div className="flex flex-col gap-3">
            <TextField
              label="Email Address"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
            />
            {lookupError && <p className="text-xs text-maia-danger">{lookupError}</p>}
            <Button onClick={handleLookup} disabled={!emailInput.trim()}>
              <Search size={14} />
              FIND MY REGISTRATION
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-maia-bg px-4 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader title={request.title} subtitle={request.message} />
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="gold">{request.sourceType}</Badge>
            <Badge tone="neutral">{request.sourceLabel}</Badge>
          </div>
          <p className="mt-2 text-xs text-maia-ink-soft">Responding as {lead.fullName} ({lead.email})</p>
        </Card>

        <Card>
          <CardHeader title="Your Rating (optional)" />
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} onClick={() => setRating(rating === i + 1 ? null : i + 1)}>
                <Star size={26} className={i < (rating ?? 0) ? "fill-maia-gold text-maia-gold" : "text-maia-border"} />
              </button>
            ))}
            {rating && (
              <button onClick={() => setRating(null)} className="ml-2 text-xs text-maia-ink-soft hover:underline">
                Clear
              </button>
            )}
          </div>
        </Card>

        {request.allowWritten && (
          <Card>
            <CardHeader title="Written Feedback" />
            <textarea
              value={written}
              onChange={(e) => setWritten(e.target.value.slice(0, WRITTEN_LIMIT))}
              rows={5}
              placeholder="Tell us about your experience — the good, and anything we could improve..."
              className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
            />
            <p className="mt-1 text-right text-xs text-maia-ink-soft">{written.length}/{WRITTEN_LIMIT}</p>
          </Card>
        )}

        {request.allowVideo && (
          <Card>
            <div className="mb-2 flex items-center gap-1.5">
              <CardHeader title="Video Testimonial (optional)" />
              <InfoTooltip text="Demo only — no real secure upload/storage backend exists yet. Do not treat this as production-ready video storage." />
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-maia-border px-4 py-6 text-center hover:border-maia-gold">
              <UploadCloud size={22} className="text-maia-gold-deep" />
              <span className="text-sm font-semibold text-maia-ink">{videoFileName || "Tap to select a video (30s–3min recommended)"}</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setVideoFileName(e.target.files?.[0]?.name ?? "")}
              />
            </label>
          </Card>
        )}

        {request.questions.length > 0 && (
          <Card>
            <CardHeader title="A Few Questions" />
            <div className="flex flex-col gap-3">
              {request.questions.map((q) => (
                <div key={q.id}>
                  <label className="mb-1.5 block text-sm font-semibold text-maia-ink">{q.text}</label>
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="border-maia-gold/30">
          <CardHeader title="Marketing Permission (Optional — Separate From Your Feedback)" />
          <label className="flex items-start gap-2.5 text-sm text-maia-ink">
            <input
              type="checkbox"
              checked={allowMarketing}
              onChange={(e) => {
                setAllowMarketing(e.target.checked);
                if (!e.target.checked) setPermittedAssets([]);
              }}
              className="mt-0.5 h-4 w-4 rounded border-maia-border accent-maia-gold-deep"
            />
            <span>{WEBINAR_MARKETING_CONSENT_STATEMENT}</span>
          </label>
          {allowMarketing && (
            <div className="mt-3">
              <ChipMultiSelect
                label="What can we use?"
                hint="Select only what you're comfortable sharing publicly."
                options={MARKETING_PERMITTED_ASSETS}
                value={permittedAssets}
                onChange={(v) => setPermittedAssets(v as MarketingPermittedAsset[])}
              />
            </div>
          )}
          <p className="mt-3 text-xs text-maia-ink-soft">
            You can submit your feedback WITHOUT allowing marketing use — this section is completely optional.
          </p>
        </Card>

        <div className="flex justify-end gap-2 pb-4">
          <Button variant="secondary" onClick={handleSaveDraft}>
            SAVE DRAFT
          </Button>
          <Button onClick={handleSubmit}>SUBMIT FEEDBACK</Button>
        </div>
      </div>
    </div>
  );
}
