import { useState } from "react";
import { BrainCircuit, Save } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { FilterSelect } from "@/components/common/FilterSelect";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import { useStudentStore } from "@/data/studentStore";
import type { MasterBrainStatus, StudentRecord } from "@/types/student";

const MASTER_BRAIN_STATUS_OPTIONS: MasterBrainStatus[] = ["Not Started", "In Progress", "Submitted", "Under Review", "Completed"];

export function MasterBrainTab({ student }: { student: StudentRecord }) {
  const { updateMasterBrainStatus } = useStudentStore();
  const [status, setStatus] = useState<MasterBrainStatus>(student.masterBrainStatus);

  const isDirty = status !== student.masterBrainStatus;

  function handleSave() {
    updateMasterBrainStatus(student.id, status);
  }

  return (
    <Card>
      <CardHeader
        title="Master Brain"
        subtitle="The full questionnaire workflow arrives in a later build step — status updates here already drive real Task automation (Step 5)."
      />

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

      <div className="mt-4 max-w-xs">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
          Update Status
        </label>
        <FilterSelect
          value={status}
          onChange={(v) => setStatus(v as MasterBrainStatus)}
          options={MASTER_BRAIN_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <p className="mt-3 text-xs text-maia-ink-soft/80">
        Setting this to &ldquo;Submitted&rdquo; or &ldquo;Completed&rdquo; automatically creates a review/certificate
        task under Team &rarr; Tasks.
      </p>

      <Button className="mt-4" onClick={handleSave} disabled={!isDirty}>
        <Save size={15} />
        SAVE MASTER BRAIN STATUS
      </Button>
    </Card>
  );
}
