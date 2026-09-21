import { useState } from "react";
import { AlertTriangle, FileText, ImageIcon, RotateCcw } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { FileUploadField, validateUploadFile } from "@/components/enrollment/FileUploadField";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useStudentStore } from "@/data/studentStore";
import { DOCUMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { fileToMeta, formatDateTime } from "@/utils/students";
import type { DocumentRequirement } from "@/types/student";

export function Requirements() {
  const { student } = useStudentPortal();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-maia-ink-soft">
        These are the requirements the Academy needs to verify your enrollment. If a document needs resubmission,
        the reason will be shown below it.
      </p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RequirementCard studentId={student.id} title="Valid ID" doc="validId" requirement={student.validId} />
        <RequirementCard
          studentId={student.id}
          title="Proof of Payment"
          doc="proofOfPayment"
          requirement={student.proofOfPayment}
        />
      </div>
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
  const { resubmitDocument } = useStudentStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleClose() {
    setModalOpen(false);
    setFile(null);
    setFileError(null);
  }

  function handleResubmit() {
    if (!file) return;
    resubmitDocument(studentId, doc, fileToMeta(file));
    handleClose();
  }

  return (
    <Card>
      <CardHeader title={title} action={<Badge tone={DOCUMENT_STATUS_TONE[requirement.status]}>{requirement.status}</Badge>} />

      {requirement.status === "Needs Resubmission" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-maia-danger/30 bg-maia-danger-bg px-4 py-3.5">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-maia-danger" />
          <div>
            <p className="text-sm font-semibold text-maia-danger">This document needs resubmission</p>
            <p className="mt-0.5 text-sm text-maia-ink">
              {requirement.note?.trim() ? requirement.note : "Please upload a clearer or corrected copy."}
            </p>
          </div>
        </div>
      )}

      {requirement.file ? (
        <div className="flex items-center gap-3 rounded-xl bg-maia-bg px-4 py-3.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-maia-surface text-maia-gold-deep">
            {requirement.file.fileType === "application/pdf" ? <FileText size={18} /> : <ImageIcon size={18} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-maia-ink">{requirement.file.fileName}</p>
            <p className="text-xs text-maia-ink-soft">
              {requirement.file.fileSizeLabel} &middot; Submitted {formatDateTime(requirement.file.uploadedAt)}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-maia-bg px-4 py-3.5 text-sm text-maia-ink-soft">No file submitted yet.</p>
      )}

      <p className="mt-2 text-[11px] text-maia-ink-soft/70">
        Only you can see this document. It is stored as demo metadata only — no secure file storage backend exists
        yet.
      </p>

      <Button variant="secondary" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>
        <RotateCcw size={14} />
        {requirement.file ? "RESUBMIT" : "SUBMIT"}
      </Button>

      <Modal
        open={modalOpen}
        onClose={handleClose}
        title={`${requirement.file ? "Resubmit" : "Submit"} — ${title}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleClose}>
              CANCEL
            </Button>
            <Button onClick={handleResubmit} disabled={!file}>
              SUBMIT FOR REVIEW
            </Button>
          </div>
        }
      >
        <FileUploadField
          label={title}
          file={file}
          error={fileError}
          onSelect={(f) => {
            const err = validateUploadFile(f);
            if (err) {
              setFileError(err);
              return;
            }
            setFileError(null);
            setFile(f);
          }}
          onClear={() => {
            setFile(null);
            setFileError(null);
          }}
        />
      </Modal>
    </Card>
  );
}
