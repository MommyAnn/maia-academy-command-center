import { useNavigate } from "react-router-dom";
import { BrainCircuit, ExternalLink } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import type { StudentRecord } from "@/types/student";

export function MasterBrainTab({ student }: { student: StudentRecord }) {
  const { getSubmissionForStudent } = useMasterBrainStore();
  const navigate = useNavigate();
  const submission = getSubmissionForStudent(student.id);

  return (
    <Card>
      <CardHeader
        title="Master Brain"
        subtitle="The full Brand Master Brain workflow — status changes here happen through the Master Brain review pipeline, not a manual toggle."
      />

      <div className="flex items-center gap-4 rounded-xl bg-maia-bg px-5 py-5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-maia-gold-bg text-maia-gold-deep">
          <BrainCircuit size={22} strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Current Status</p>
          <div className="mt-1.5">
            <Badge tone={MASTER_BRAIN_STATUS_TONE[student.masterBrainStatus]}>{student.masterBrainStatus}</Badge>
          </div>
        </div>
      </div>

      {submission ? (
        <>
          <div className="mt-4">
            <div className="mb-2 flex items-end justify-between text-sm">
              <p className="text-maia-ink">{submission.businessFoundation.businessName || "Questionnaire progress"}</p>
              <p className="font-display font-bold text-maia-gold-deep">{submission.progressPercent}%</p>
            </div>
            <ProgressBar percent={submission.progressPercent} />
          </div>
          <Button className="mt-4" onClick={() => navigate(`/master-brain/submissions/${submission.id}`)}>
            <ExternalLink size={14} />
            VIEW MASTER BRAIN SUBMISSION
          </Button>
        </>
      ) : (
        <p className="mt-4 text-sm text-maia-ink-soft">This student hasn&rsquo;t started their Brand Master Brain questionnaire yet.</p>
      )}
    </Card>
  );
}
