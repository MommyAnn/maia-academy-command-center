import { useState } from "react";
import { Award, Download, Eye } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { DocumentPreviewModal } from "@/components/students/profile/DocumentPreviewModal";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useTrainingStore } from "@/data/trainingStore";
import { CERTIFICATE_STATUS_TONE } from "@/components/training/statusMeta";
import { formatDate } from "@/utils/students";
import type { UploadedFileMeta } from "@/types/student";

export function Certificates() {
  const { student } = useStudentPortal();
  const { getCertificatesForStudent } = useTrainingStore();
  const [previewFile, setPreviewFile] = useState<UploadedFileMeta | null>(null);

  const certificates = getCertificatesForStudent(student.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-4">
      {certificates.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Award size={28} className="text-maia-ink-soft/40" />
            <p className="text-sm font-medium text-maia-ink">No certificates yet</p>
            <p className="max-w-sm text-sm text-maia-ink-soft">
              Your certificate will appear here once you&rsquo;ve completed the requirements for your program.
            </p>
          </div>
        </Card>
      ) : (
        certificates.map((cert) => (
          <Card key={cert.id}>
            <CardHeader
              title={cert.certificateType || cert.program}
              subtitle={cert.batch}
              action={<Badge tone={CERTIFICATE_STATUS_TONE[cert.status]}>{cert.status}</Badge>}
            />
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Certificate ID" value={cert.certificateId} />
              <Field label="Program" value={cert.program} />
              <Field label="Completion Date" value={cert.completionDate ? formatDate(cert.completionDate) : "—"} />
              <Field label="Issue Date" value={cert.issueDate ? formatDate(cert.issueDate) : "—"} />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {cert.file ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setPreviewFile(cert.file)}>
                    <Eye size={14} />
                    VIEW
                  </Button>
                  <Button size="sm" onClick={() => setPreviewFile(cert.file)}>
                    <Download size={14} />
                    DOWNLOAD
                  </Button>
                </>
              ) : (
                <p className="text-sm text-maia-ink-soft">
                  {cert.status === "Issued" || cert.status === "Reissued"
                    ? "Your certificate file will be available here shortly."
                    : "A downloadable file will appear here once your certificate is ready."}
                </p>
              )}
            </div>
          </Card>
        ))
      )}

      <DocumentPreviewModal
        open={previewFile !== null}
        onClose={() => setPreviewFile(null)}
        title="Certificate File"
        file={previewFile}
      />
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
