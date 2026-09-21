import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardEdit, History, Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import { useStudentStore } from "@/data/studentStore";
import { useStaffStore } from "@/data/staffStore";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/data/staffConfig";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import { QUESTIONNAIRE_STEP_LABELS } from "@/types/masterBrain";
import { formatDateTime } from "@/utils/students";

function humanizeKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function FieldSummary({ obj }: { obj: object }) {
  const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
  });
  if (entries.length === 0) return <p className="text-sm text-maia-ink-soft">Not answered.</p>;
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

export function SubmissionDetail() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { submissions, documents, requestRevision, approveForGeneration, startGeneration, completeGeneration, addAdminNote } =
    useMasterBrainStore();
  const { getStudentById } = useStudentStore();
  const { staff } = useStaffStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionSection, setRevisionSection] = useState<string>(QUESTIONNAIRE_STEP_LABELS[0]);
  const [revisionQuestion, setRevisionQuestion] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [generating, setGenerating] = useState(false);

  const currentStaff = staff.find((s) => s.id === user?.linkedStaffId);
  const canReview = currentStaff ? hasPermission(currentStaff.permissions, "Master Brain", "edit") : false;
  const canApprove = currentStaff ? hasPermission(currentStaff.permissions, "Master Brain", "verify") : false;

  const submission = submissions.find((s) => s.id === submissionId);
  const student = submission ? getStudentById(submission.studentId) : undefined;

  if (!submission || !student) {
    return <Navigate to="/master-brain/submissions" replace />;
  }

  function handleRequestRevision() {
    if (!revisionReason.trim()) return;
    requestRevision(submission!.id, { section: revisionSection, question: revisionQuestion.trim(), reason: revisionReason.trim() });
    setRevisionOpen(false);
    setRevisionQuestion("");
    setRevisionReason("");
  }

  function handleGenerate() {
    setGenerating(true);
    startGeneration(submission!.id);
    setTimeout(() => {
      const doc = completeGeneration(submission!.id);
      setGenerating(false);
      navigate(`/master-brain/submissions/${submission!.id}/editor/${doc.id}`);
    }, 1200);
  }

  const canRequestRevision = canReview && (submission.status === "Submitted" || submission.status === "Under Review");
  const canApproveForGeneration = canApprove && (submission.status === "Submitted" || submission.status === "Under Review");
  const canGenerate = canApprove && submission.status === "Approved for Generation";
  const latestDocument = documents
    .filter((d) => d.submissionId === submission.id)
    .sort((a, b) => b.documentVersion - a.documentVersion)[0];
  const hasDocumentToEdit = latestDocument && ["Draft Ready", "Final Review", "Completed", "Published"].includes(submission.status);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <button onClick={() => navigate("/master-brain/submissions")} className="flex w-fit items-center gap-1.5 text-sm font-medium text-maia-ink-soft hover:text-maia-ink">
        <ArrowLeft size={16} />
        Back to Submissions
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-extrabold text-maia-ink">{submission.businessFoundation.businessName || "Untitled Business"}</h1>
            <p className="mt-1 text-sm text-maia-ink-soft">
              {student.fullName} ({student.studentId}) &middot; {student.batch} &middot; {student.package}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={MASTER_BRAIN_STATUS_TONE[submission.status]}>{submission.status}</Badge>
            <span className="text-xs text-maia-ink-soft">v{submission.submissionVersion}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canRequestRevision && (
            <Button variant="secondary" onClick={() => setRevisionOpen(true)}>
              <AlertTriangle size={14} />
              REQUEST REVISION
            </Button>
          )}
          {canApproveForGeneration && (
            <Button onClick={() => approveForGeneration(submission.id)}>
              <CheckCircle2 size={14} />
              APPROVE FOR GENERATION
            </Button>
          )}
          {canGenerate && (
            <Button onClick={handleGenerate} disabled={generating}>
              <Sparkles size={14} />
              {generating ? "GENERATING..." : "GENERATE MASTER BRAIN DRAFT"}
            </Button>
          )}
          {hasDocumentToEdit && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/master-brain/submissions/${submission.id}/editor/${latestDocument!.id}`)}
            >
              {submission.status === "Published" ? "VIEW DOCUMENT" : "EDIT DRAFT"}
            </Button>
          )}
          {!canReview && !canApprove && (
            <p className="text-xs text-maia-ink-soft">You don&rsquo;t have permission to review Master Brain submissions.</p>
          )}
        </div>
      </Card>

      {submission.revisionRequests.length > 0 && (
        <Card>
          <CardHeader title="Revision History" />
          <div className="flex flex-col gap-2">
            {submission.revisionRequests.map((r) => (
              <div key={r.id} className={`rounded-lg px-3.5 py-2.5 ${r.resolved ? "bg-maia-bg" : "border border-maia-danger/30 bg-maia-danger-bg"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-maia-ink">
                    {r.section}
                    {r.question ? ` — ${r.question}` : ""}
                  </p>
                  <Badge tone={r.resolved ? "success" : "danger"}>{r.resolved ? "Resolved" : "Pending"}</Badge>
                </div>
                <p className="mt-1 text-sm text-maia-ink-soft">{r.reason}</p>
                <p className="mt-1 text-xs text-maia-ink-soft/70">
                  {r.requestedBy} &middot; {formatDateTime(r.requestedAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {submission.submissionHistory.length > 0 && (
        <Card>
          <CardHeader title="Submission Version History" action={<History size={16} className="text-maia-ink-soft" />} />
          <div className="flex flex-col gap-2">
            {submission.submissionHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm">
                <span className="text-maia-ink">
                  v{h.submissionVersion} — {h.statusAtSnapshot} by {h.submittedBy}
                </span>
                <span className="text-xs text-maia-ink-soft">{formatDateTime(h.submittedAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All questionnaire answers, grouped by section, read-only — never mutated here. */}
      <Card>
        <CardHeader title="1. Business Foundation" />
        <FieldSummary obj={submission.businessFoundation} />
      </Card>
      <Card>
        <CardHeader title="2. Founder / Business Owner" />
        <FieldSummary obj={submission.founder} />
      </Card>
      <Card>
        <CardHeader title="3. Products & Services" />
        {submission.offers.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No offers provided.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {submission.offers.map((o) => (
              <div key={o.id} className="rounded-lg border border-maia-border p-3.5">
                <FieldSummary obj={o} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 border-t border-maia-border pt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Primary Offer</p>
          <FieldSummary obj={submission.primaryOffer} />
        </div>
      </Card>
      <Card>
        <CardHeader title="4. Target Market — Customer Avatars" />
        {submission.avatars.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No avatars provided.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {submission.avatars.map((a) => (
              <div key={a.id} className="rounded-lg border border-maia-border p-3.5">
                <FieldSummary obj={a} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="5. Customer Problems" />
        <FieldSummary obj={submission.problemsNarrative} />
        {submission.painPoints.length > 0 && (
          <div className="mt-4 flex flex-col gap-4 border-t border-maia-border pt-4">
            {submission.painPoints.map((p) => (
              <div key={p.id} className="rounded-lg border border-maia-border p-3.5">
                <FieldSummary obj={p} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="6. Customer Desires & Goals" />
        <FieldSummary obj={submission.desires} />
      </Card>
      <Card>
        <CardHeader title="7. Brand Positioning" />
        <FieldSummary obj={submission.positioning} />
      </Card>
      <Card>
        <CardHeader title="8. Brand Personality & Voice" />
        <FieldSummary obj={submission.personalityVoice} />
      </Card>
      <Card>
        <CardHeader title="9. Marketing & Sales" />
        <FieldSummary obj={submission.marketingSales} />
      </Card>
      <Card>
        <CardHeader title="10. Competitors & Differentiation" />
        {submission.competitors.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No competitors provided.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {submission.competitors.map((c) => (
              <div key={c.id} className="rounded-lg border border-maia-border p-3.5">
                <FieldSummary obj={c} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="11. Business Goals & Growth" />
        <FieldSummary obj={submission.goals} />
        <div className="mt-3 flex flex-col gap-1 text-sm text-maia-ink">
          {submission.challenges.selected.length > 0 && <p><span className="font-semibold">Challenges:</span> {submission.challenges.selected.join(", ")}</p>}
          {submission.challenges.explanation && <p className="text-maia-ink-soft">{submission.challenges.explanation}</p>}
          {submission.priorities.length > 0 && <p><span className="font-semibold">Priorities:</span> {submission.priorities.join(", ")}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Internal Admin Notes" subtitle="Never shown to the student." action={<ClipboardEdit size={16} className="text-maia-ink-soft" />} />
        <div className="flex flex-col gap-2">
          <TextAreaField label="Add a note" value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} />
          <Button
            size="sm"
            className="w-fit"
            onClick={() => {
              addAdminNote(submission.id, noteText);
              setNoteText("");
            }}
            disabled={!noteText.trim()}
          >
            ADD NOTE
          </Button>
        </div>
        {submission.adminNotes.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-maia-border pt-4">
            {submission.adminNotes.map((n) => (
              <div key={n.id} className="rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm">
                <p className="text-maia-ink">{n.text}</p>
                <p className="mt-1 text-xs text-maia-ink-soft">
                  {n.author} &middot; {formatDateTime(n.timestamp)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        title="Request Revision"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRevisionOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={handleRequestRevision} disabled={!revisionReason.trim()}>
              SEND REVISION REQUEST
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="Section"
            value={revisionSection}
            onChange={(e) => setRevisionSection(e.target.value)}
            options={QUESTIONNAIRE_STEP_LABELS.map((l) => ({ value: l, label: l }))}
          />
          <TextField label="Specific Question (optional)" value={revisionQuestion} onChange={(e) => setRevisionQuestion(e.target.value)} />
          <TextAreaField label="Reason / Instructions" value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} required />
          <p className="text-xs text-maia-ink-soft">The student will see exactly this section and reason in their Student Portal.</p>
        </div>
      </Modal>
    </div>
  );
}
