import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { CERTIFICATE_STATUS_TONE } from "@/components/training/statusMeta";
import { useTrainingStore } from "@/data/trainingStore";
import type { StudentRecord } from "@/types/student";

export function CertificatesTab({ student }: { student: StudentRecord }) {
  const { getCertificatesForStudent, markReady, markIssued, reissueCertificate } = useTrainingStore();

  const certs = getCertificatesForStudent(student.id).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader title="Certificates" subtitle="Full certificate history for this student — reissues never erase the original." />
      </div>
      <div className="overflow-x-auto border-t border-maia-border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="px-4 py-3">Certificate ID</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Issue Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{c.certificateId}</td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{c.certificateType}</td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{c.program}</td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{c.batch}</td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{c.issueDate ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge tone={CERTIFICATE_STATUS_TONE[c.status]}>{c.status}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.status === "For Preparation" && (
                      <Button size="sm" onClick={() => markReady(c.id)}>
                        MARK READY
                      </Button>
                    )}
                    {c.status === "Ready" && (
                      <Button size="sm" onClick={() => markIssued(c.id, new Date().toISOString().slice(0, 10))}>
                        MARK ISSUED
                      </Button>
                    )}
                    {c.status === "Issued" && (
                      <Button size="sm" variant="secondary" onClick={() => reissueCertificate(c.id)}>
                        REISSUE
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {certs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                  No certificate records yet — see Training → Certificates to check eligibility.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
