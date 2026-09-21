import { useState } from "react";
import { Brain, Save, Send } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { TextField } from "@/components/common/TextField";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useStudentStore } from "@/data/studentStore";
import { usePortalStore } from "@/data/portalStore";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import { formatDateTime } from "@/utils/students";
import type { MasterBrainStatus } from "@/types/student";

const WORKFLOW_STEPS: MasterBrainStatus[] = ["Not Started", "In Progress", "Submitted", "Under Review", "Completed"];

export function MasterBrain() {
  const { student } = useStudentPortal();
  const { updateMasterBrainStatus } = useStudentStore();
  const { masterBrainProgress, saveMasterBrainProgress } = usePortalStore();
  const [businessBrand, setBusinessBrand] = useState(
    () => masterBrainProgress.find((p) => p.studentId === student.id)?.businessBrand ?? "",
  );

  const progress = masterBrainProgress.find((p) => p.studentId === student.id);
  const currentStepIndex = WORKFLOW_STEPS.indexOf(student.masterBrainStatus);

  function handleStart() {
    updateMasterBrainStatus(student.id, "In Progress");
    saveMasterBrainProgress(student.id, { progressPercent: 0 });
  }

  function handleSaveProgress() {
    const nextPercent = Math.min(100, (progress?.progressPercent ?? 0) + 20);
    saveMasterBrainProgress(student.id, { progressPercent: nextPercent, businessBrand });
  }

  function handleSubmit() {
    saveMasterBrainProgress(student.id, { progressPercent: 100, businessBrand });
    updateMasterBrainStatus(student.id, "Submitted");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Master Brain Status"
          subtitle="Your business/brand questionnaire workflow."
          action={<Badge tone={MASTER_BRAIN_STATUS_TONE[student.masterBrainStatus]}>{student.masterBrainStatus}</Badge>}
        />

        <div className="flex flex-wrap items-center gap-2">
          {WORKFLOW_STEPS.map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  idx <= currentStepIndex
                    ? "bg-maia-gold text-maia-black"
                    : "border border-maia-border text-maia-ink-soft"
                }`}
              >
                {step}
              </span>
              {idx < WORKFLOW_STEPS.length - 1 && <span className="text-maia-ink-soft/50">&rarr;</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-maia-gold/30 bg-maia-gold-bg/30">
        <div className="flex items-start gap-3">
          <Brain size={18} className="mt-0.5 flex-shrink-0 text-maia-gold-deep" />
          <p className="text-sm text-maia-ink-soft">
            The full Master Brain questionnaire is not available yet. This page previews the workflow and the
            Save &amp; Continue Later architecture the full questionnaire will use — your progress here is not a
            complete business plan submission.
          </p>
        </div>
      </Card>

      {student.masterBrainStatus === "Not Started" && (
        <Card>
          <p className="mb-4 text-sm text-maia-ink-soft">
            Ready to begin? Starting will open your Master Brain workspace so you can save progress and come back
            anytime.
          </p>
          <Button onClick={handleStart}>START MY MASTER BRAIN</Button>
        </Card>
      )}

      {student.masterBrainStatus === "In Progress" && (
        <Card>
          <CardHeader title="Save & Continue Later" subtitle="Your progress is saved so you never lose your place." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Submission ID" value={progress?.submissionId.slice(0, 8) ?? "—"} />
              <Field label="Questionnaire Version" value={progress?.questionnaireVersion ?? "v1.0"} />
              <Field label="Last Saved" value={progress?.lastSaved ? formatDateTime(progress.lastSaved) : "Not saved yet"} />
              <Field label="Progress" value={`${progress?.progressPercent ?? 0}%`} />
            </div>

            <div className="mt-4">
              <ProgressBar percent={progress?.progressPercent ?? 0} />
            </div>

            <div className="mt-5">
              <TextField
                label="Business / Brand Name"
                value={businessBrand}
                onChange={(e) => setBusinessBrand(e.target.value)}
                placeholder="e.g. Juana's Home Finds"
                hint="A starting point for your questionnaire — the full set of questions will be added in a later build."
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleSaveProgress}>
                <Save size={14} />
                SAVE & CONTINUE LATER
              </Button>
              <Button onClick={handleSubmit}>
                <Send size={14} />
                SUBMIT FOR REVIEW
              </Button>
            </div>
          </Card>
        )}

      {(student.masterBrainStatus === "Submitted" || student.masterBrainStatus === "Under Review") && (
        <Card>
          <p className="text-sm text-maia-ink-soft">
            Your Master Brain submission is with the Academy for review. You&rsquo;ll be notified here once it&rsquo;s
            reviewed.
          </p>
        </Card>
      )}

      {student.masterBrainStatus === "Completed" && (
        <Card>
          <p className="text-sm text-maia-ink-soft">
            Your Master Brain is complete! The Academy will reach out with your next steps.
          </p>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-maia-ink">{value}</dd>
    </div>
  );
}
