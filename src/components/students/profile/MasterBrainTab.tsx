import { BrainCircuit } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import type { StudentRecord } from "@/types/student";

export function MasterBrainTab({ student }: { student: StudentRecord }) {
  return (
    <Card>
      <CardHeader title="Master Brain" subtitle="The full questionnaire workflow arrives in a later build step." />

      <div className="flex items-center gap-4 rounded-xl bg-maia-bg px-5 py-5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-maia-gold-bg text-maia-gold-deep">
          <BrainCircuit size={22} strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Current Status</p>
          <div className="mt-1.5">
            <Badge tone={MASTER_BRAIN_STATUS_TONE[student.masterBrainStatus]}>{student.masterBrainStatus}</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}
