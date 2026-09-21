import { useNavigate } from "react-router-dom";
import { AlertTriangle, Brain, Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { PublishedMasterBrainDocument } from "@/components/portal/PublishedMasterBrainDocument";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import { stepLabel } from "@/utils/masterBrain";
import { formatDateTime } from "@/utils/students";

const FINALIZING_STATUSES = ["Approved for Generation", "Generating", "Draft Ready", "Final Review", "Completed"];

export function MasterBrain() {
  const { student } = useStudentPortal();
  const { getSubmissionForStudent, getPublishedDocument, startSubmission } = useMasterBrainStore();
  const navigate = useNavigate();

  const submission = getSubmissionForStudent(student.id);
  const publishedDoc = getPublishedDocument(student.id);
  const status = submission?.status ?? "Not Started";

  function handleStart() {
    startSubmission(student.id);
    navigate("/portal/master-brain/questionnaire");
  }

  if (status === "Not Started" || !submission) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-maia-gold-bg text-maia-gold-deep">
            <Brain size={26} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-maia-ink">Build Your Brand Master Brain</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-maia-ink-soft">
              Your Brand Master Brain will become the central intelligence of your business — helping AI understand
              your brand, customers, offers, positioning, voice, strategy and direction.
            </p>
          </div>
          <Button onClick={handleStart}>
            <Sparkles size={15} />
            START MY BRAND MASTER BRAIN
          </Button>
        </div>
      </Card>
    );
  }

  if (status === "Published" && publishedDoc) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="no-print border-maia-success/30 bg-maia-success-bg/40">
          <p className="font-display text-base font-bold text-maia-ink">Your Brand Master Brain is Ready!</p>
          <p className="mt-1 text-sm text-maia-ink-soft">
            This is your business&rsquo;s central intelligence document — use it to brief AI tools, your team, or
            anyone helping grow your brand.
          </p>
        </Card>
        <PublishedMasterBrainDocument document={publishedDoc} businessName={submission.businessFoundation.businessName} />
      </div>
    );
  }

  if (status === "In Progress") {
    return (
      <Card>
        <CardHeader
          title="My Master Brain"
          subtitle="Continue where you left off."
          action={<Badge tone={MASTER_BRAIN_STATUS_TONE[status]}>{status}</Badge>}
        />
        <div className="mb-4">
          <div className="mb-2 flex items-end justify-between text-sm">
            <p className="text-maia-ink">
              Step {submission.currentStep} of 12 — {stepLabel(submission.currentStep)}
            </p>
            <p className="font-display font-bold text-maia-gold-deep">{submission.progressPercent}%</p>
          </div>
          <ProgressBar percent={submission.progressPercent} />
        </div>
        {submission.lastSaved && (
          <p className="mb-4 text-xs text-maia-ink-soft">Last saved {formatDateTime(submission.lastSaved)}</p>
        )}
        <Button onClick={() => navigate(`/portal/master-brain/questionnaire?step=${submission.currentStep}`)}>
          CONTINUE MY ASSESSMENT
        </Button>
      </Card>
    );
  }

  if (status === "Needs Revision") {
    const unresolved = submission.revisionRequests.filter((r) => !r.resolved);
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader
            title="Master Brain Needs Revision"
            subtitle="The M.A.I.A. team asked for updates on a few answers."
            action={<Badge tone={MASTER_BRAIN_STATUS_TONE[status]}>{status}</Badge>}
          />
          <div className="flex flex-col gap-3">
            {unresolved.map((r) => (
              <div key={r.id} className="flex items-start gap-2.5 rounded-xl border border-maia-danger/30 bg-maia-danger-bg px-4 py-3.5">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-maia-danger" />
                <div>
                  <p className="text-sm font-semibold text-maia-ink">
                    {r.section}
                    {r.question ? ` — ${r.question}` : ""}
                  </p>
                  <p className="mt-0.5 text-sm text-maia-ink-soft">{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-4" onClick={() => navigate(`/portal/master-brain/questionnaire?step=${submission.currentStep}`)}>
            UPDATE MY ANSWERS
          </Button>
        </Card>
      </div>
    );
  }

  if (status === "Submitted" || status === "Under Review") {
    return (
      <Card>
        <CardHeader
          title="My Master Brain"
          subtitle="Your assessment is with the M.A.I.A. team for review."
          action={<Badge tone={MASTER_BRAIN_STATUS_TONE[status]}>{status}</Badge>}
        />
        <p className="text-sm text-maia-ink-soft">
          You&rsquo;ll be notified here once it&rsquo;s reviewed. This usually takes a few business days.
        </p>
      </Card>
    );
  }

  if (FINALIZING_STATUSES.includes(status)) {
    return (
      <Card>
        <CardHeader
          title="My Master Brain"
          subtitle="Your Brand Master Brain is being finalized by the M.A.I.A. team."
          action={<Badge tone={MASTER_BRAIN_STATUS_TONE[status]}>{status}</Badge>}
        />
        <p className="text-sm text-maia-ink-soft">No action is needed from you right now — check back soon!</p>
      </Card>
    );
  }

  return null;
}
