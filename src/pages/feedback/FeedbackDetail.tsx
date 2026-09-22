import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Award, FileVideo, Star } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { useFeedbackStore } from "@/data/feedbackStore";
import { useStudentStore } from "@/data/studentStore";
import { useWebinarStore } from "@/data/webinarStore";
import { useStaffStore } from "@/data/staffStore";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/data/staffConfig";
import { MARKETING_TAGS } from "@/types/feedback";

export function FeedbackDetail() {
  const { feedbackId: id } = useParams<{ feedbackId: string }>();
  const navigate = useNavigate();
  const { submissions, consents, redemptions, incentives, markReviewed, approveForMarketing, keepPrivate, featureSubmission, archiveSubmission, addInternalNote, setMarketingTags } =
    useFeedbackStore();
  const { getStudentById } = useStudentStore();
  const { leads } = useWebinarStore();
  const { staff } = useStaffStore();
  const { user } = useAuth();
  const [noteText, setNoteText] = useState("");
  const [approveError, setApproveError] = useState("");

  const currentStaff = staff.find((s) => s.id === user?.linkedStaffId);
  // Marketing Staff normally hold "Feedback - Marketing" only, never "Feedback"
  // itself — private review actions (reviewing, keeping private, archiving)
  // stay gated behind the private "Feedback" permission (spec section 53).
  const canManagePrivateFeedback = currentStaff ? hasPermission(currentStaff.permissions, "Feedback", "edit") : false;
  const canManageMarketing = currentStaff ? hasPermission(currentStaff.permissions, "Feedback - Marketing", "edit") : false;

  const submission = submissions.find((s) => s.id === id);
  const student = submission?.studentId ? getStudentById(submission.studentId) : undefined;
  const lead = submission?.leadId ? leads.find((l) => l.id === submission.leadId) : undefined;
  const personName = student?.fullName ?? lead?.fullName;

  if (!submission || !personName) {
    return <Navigate to="/feedback/all" replace />;
  }

  const consent = consents.find((c) => c.feedbackId === submission.feedbackId);
  // Marketing Staff normally hold "Feedback - Marketing" only — spec section
  // 53 requires they never automatically gain access to private feedback
  // content, only what a granted consent has already made shareable.
  const marketingOnlyStaff = canManageMarketing && !canManagePrivateFeedback;
  const writtenIsShareable = consent?.status === "Granted" && consent.permittedAssets.includes("Written Feedback");
  const canViewWrittenFeedback = !marketingOnlyStaff || writtenIsShareable;
  const redemption = redemptions.find((r) => r.feedbackSubmissionId === submission.id);
  const incentive = submission.incentiveId ? incentives.find((i) => i.id === submission.incentiveId) : undefined;

  function handleApprove() {
    const result = approveForMarketing(submission!.id);
    if (!result.ok) setApproveError(result.reason ?? "Cannot approve.");
    else setApproveError("");
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate("/feedback/all")} className="flex items-center gap-1 text-xs font-semibold text-maia-ink-soft hover:text-maia-gold-deep">
        <ArrowLeft size={14} />
        BACK TO ALL FEEDBACK
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-maia-ink-soft">{submission.feedbackId}</p>
          <h2 className="font-display text-lg font-bold text-maia-ink">{personName} — {submission.sourceLabel}</h2>
          <p className="text-sm text-maia-ink-soft">{submission.sourceType} · {submission.batch} · Submitted {new Date(submission.submittedAt).toLocaleString("en-PH")}</p>
        </div>
        <Badge tone={submission.status === "Approved for Marketing" || submission.status === "Featured" ? "success" : "neutral"}>{submission.status}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Feedback" />
            {submission.rating !== null && (
              <div className="mb-3 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className={i < submission.rating! ? "fill-maia-gold text-maia-gold" : "text-maia-border"} />
                ))}
              </div>
            )}
            {submission.writtenFeedback && canViewWrittenFeedback && (
              <p className="whitespace-pre-line text-sm text-maia-ink">{submission.writtenFeedback}</p>
            )}
            {submission.writtenFeedback && !canViewWrittenFeedback && (
              <p className="rounded-lg bg-maia-bg px-3 py-2 text-xs text-maia-ink-soft">
                Private feedback content — requires Feedback permission, or the student's marketing consent, to view.
              </p>
            )}
            {submission.videoAsset && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-maia-border p-3">
                <FileVideo size={20} className="text-maia-gold-deep" />
                <div>
                  <p className="text-sm font-semibold text-maia-ink">{submission.videoAsset.fileName}</p>
                  <p className="text-xs text-maia-ink-soft">{submission.videoAsset.fileSizeLabel} · uploaded {new Date(submission.videoAsset.uploadedAt).toLocaleDateString("en-PH")}</p>
                  <p className="mt-1 text-[11px] text-maia-ink-soft">Demo metadata only — no real secure video storage backend exists yet.</p>
                </div>
              </div>
            )}
            {submission.answers.length > 0 && !marketingOnlyStaff && (
              <div className="mt-4 flex flex-col gap-3 border-t border-maia-border pt-4">
                {submission.answers.map((a, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{a.questionText}</p>
                    <p className="mt-0.5 text-sm text-maia-ink">{a.answer || "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {!marketingOnlyStaff && (
          <Card>
            <CardHeader title="Internal Notes" subtitle="Never shown to the student or the public." />
            <div className="flex flex-col gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                placeholder="Add an internal note..."
                className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
              />
              <Button
                size="sm"
                className="self-end"
                onClick={() => {
                  addInternalNote(submission.id, noteText);
                  setNoteText("");
                }}
                disabled={!noteText.trim()}
              >
                ADD NOTE
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {submission.internalNotes.map((n) => (
                <div key={n.id} className="rounded-lg bg-maia-bg px-3 py-2 text-sm">
                  <p className="text-maia-ink">{n.text}</p>
                  <p className="mt-1 text-[11px] text-maia-ink-soft">{n.author} · {new Date(n.timestamp).toLocaleString("en-PH")}</p>
                </div>
              ))}
              {submission.internalNotes.length === 0 && <p className="text-xs text-maia-ink-soft">No internal notes yet.</p>}
            </div>
          </Card>
          )}

          <Card>
            <ChipMultiSelect
              label="Internal Marketing Tags"
              hint="Internal organization only — never shown publicly."
              options={MARKETING_TAGS}
              value={submission.marketingTags}
              onChange={(tags) => setMarketingTags(submission.id, tags)}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Marketing Consent" />
            {consent ? (
              <div className="flex flex-col gap-2 text-sm">
                <Badge tone={consent.status === "Granted" ? "success" : "warning"}>{consent.status}</Badge>
                <p className="text-xs text-maia-ink-soft">Version {consent.consentVersion} · {new Date(consent.consentDate).toLocaleDateString("en-PH")}</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Permitted Assets</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {consent.permittedAssets.map((a) => (
                      <Badge key={a} tone="gold">{a}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-maia-ink-soft">
                <AlertCircle size={14} />
                No marketing consent on file. This feedback stays private only.
              </p>
            )}
          </Card>

          {incentive && (
            <Card>
              <CardHeader title="Incentive" />
              <p className="text-sm font-semibold text-maia-ink">{incentive.name}</p>
              <p className="mt-1 text-xs text-maia-ink-soft">{incentive.deliveryType}</p>
              {redemption && (
                <Badge tone={redemption.deliveryStatus === "Delivered" ? "success" : "gold"} >
                  <Award size={11} />
                  {redemption.deliveryStatus}
                </Badge>
              )}
            </Card>
          )}

          <Card>
            <CardHeader title="Actions" />
            {!canManagePrivateFeedback && !canManageMarketing && (
              <p className="mb-2 text-xs text-maia-ink-soft">Your role doesn't include Feedback edit permissions — actions below are disabled.</p>
            )}
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => markReviewed(submission.id)} disabled={!canManagePrivateFeedback}>
                MARK REVIEWED
              </Button>
              <Button
                variant="secondary"
                onClick={handleApprove}
                disabled={!canManageMarketing || !consent || consent.status !== "Granted"}
              >
                APPROVE FOR MARKETING
              </Button>
              {approveError && <p className="text-xs text-maia-danger">{approveError}</p>}
              <Button variant="secondary" onClick={() => keepPrivate(submission.id)} disabled={!canManagePrivateFeedback}>
                KEEP PRIVATE
              </Button>
              <Button variant="secondary" onClick={() => featureSubmission(submission.id)} disabled={!canManageMarketing}>
                FEATURE
              </Button>
              <Button variant="secondary" onClick={() => archiveSubmission(submission.id)} disabled={!canManagePrivateFeedback}>
                ARCHIVE
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
