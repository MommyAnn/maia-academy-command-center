import { useState } from "react";
import { CheckCircle2, Eye, FileText, ImageIcon, RotateCcw } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { DOCUMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { useStudentStore } from "@/data/studentStore";
import { formatDateTime } from "@/utils/students";
import type { DocumentRequirement, StudentRecord } from "@/types/student";

export function RequirementsTab({ student }: { student: StudentRecord }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <RequirementCard studentId={student.id} title="Valid ID" doc="validId" requirement={student.validId} />
      <RequirementCard
        studentId={student.id}
        title="Proof of Payment"
        doc="proofOfPayment"
        requirement={student.proofOfPayment}
      />
    </div>
  );
}

function RequirementCard({
  studentId,
  title,
  doc,
  requirement,
}: {
  studentId: string;
  title: string;
  doc: "validId" | "proofOfPayment";
  requirement: DocumentRequirement;
}) {
  const { updateDocumentStatus } = useStudentStore();
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Card>
      <CardHeader title={title} action={<Badge tone={DOCUMENT_STATUS_TONE[requirement.status]}>{requirement.status}</Badge>} />

      {requirement.file ? (
        <div className="flex items-center gap-3 rounded-xl bg-maia-bg px-4 py-3.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-maia-surface text-maia-gold-deep">
            {requirement.file.fileType === "application/pdf" ? <FileText size={18} /> : <ImageIcon size={18} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-maia-ink">{requirement.file.fileName}</p>
            <p className="text-xs text-maia-ink-soft">
              {requirement.file.fileSizeLabel} &middot; {formatDateTime(requirement.file.uploadedAt)}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-maia-bg px-4 py-3.5 text-sm text-maia-ink-soft">No file submitted yet.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye size={14} />
          VIEW DOCUMENT
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-maia-success/40 text-maia-success hover:border-maia-success hover:text-maia-success"
          onClick={() => updateDocumentStatus(studentId, doc, "Verified")}
        >
          <CheckCircle2 size={14} />
          VERIFY
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-maia-danger/40 text-maia-danger hover:border-maia-danger hover:text-maia-danger"
          onClick={() => updateDocumentStatus(studentId, doc, "Needs Resubmission")}
        >
          <RotateCcw size={14} />
          NEEDS RESUBMISSION
        </Button>
      </div>

      <DocumentPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={title} file={requirement.file} />
    </Card>
  );
}
