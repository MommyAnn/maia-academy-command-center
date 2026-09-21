import { CheckCircle2, Mail, Power, RotateCcw, ShieldOff } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { UPDATE_REQUEST_STATUS_TONE } from "@/components/portal/statusMeta";
import { usePortalStore } from "@/data/portalStore";
import { formatDateTime } from "@/utils/students";
import type { StudentRecord } from "@/types/student";

export function PortalTab({ student }: { student: StudentRecord }) {
  const {
    getPortalAccess,
    activatePortalAccess,
    deactivatePortalAccess,
    sendAccessInstructions,
    resetAccess,
    updateRequests,
    reviewUpdateRequest,
  } = usePortalStore();

  const access = getPortalAccess(student.id);
  const myRequests = updateRequests
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const pendingRequests = myRequests.filter((r) => r.status === "Pending");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Portal Access"
          subtitle="Controls this student's login to the Student Portal — no passwords are ever shown here."
          action={<Badge tone={access.activated ? "success" : "neutral"}>{access.activated ? "Activated" : "Deactivated"}</Badge>}
        />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" value={student.email} />
          <Field label="Access Created Date" value={access.accessCreatedDate ?? "—"} />
          <Field label="Last Login" value={access.lastLogin ? formatDateTime(access.lastLogin) : "Never logged in"} />
          <Field
            label="Instructions Sent"
            value={access.instructionsSentAt ? formatDateTime(access.instructionsSentAt) : "Not sent yet"}
          />
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {access.activated ? (
            <Button variant="secondary" size="sm" onClick={() => deactivatePortalAccess(student.id)}>
              <ShieldOff size={14} />
              DEACTIVATE ACCESS
            </Button>
          ) : (
            <Button size="sm" onClick={() => activatePortalAccess(student.id)}>
              <Power size={14} />
              ACTIVATE ACCESS
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => sendAccessInstructions(student.id)}>
            <Mail size={14} />
            SEND ACCESS INSTRUCTIONS
          </Button>
          <Button variant="secondary" size="sm" onClick={() => resetAccess(student.id)}>
            <RotateCcw size={14} />
            RESET ACCESS
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-maia-ink-soft/70">
          Demo mode: these actions update local demo state only — no real email/SMS is sent and no real password
          reset exists yet.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Profile & Enrollment Update Requests"
          subtitle={`${pendingRequests.length} pending review`}
        />
        {myRequests.length === 0 ? (
          <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">
            This student hasn&rsquo;t submitted any update requests yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {myRequests.map((r) => (
              <div key={r.id} className="rounded-lg bg-maia-bg px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-maia-ink">{r.field}</p>
                  <Badge tone={UPDATE_REQUEST_STATUS_TONE[r.status]}>{r.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-maia-ink-soft">
                  <span className="line-through">{r.oldValue || "—"}</span> &rarr; <span className="font-medium text-maia-ink">{r.newValue}</span>
                </p>
                <p className="mt-1 text-xs text-maia-ink-soft">Reason: {r.reason}</p>
                <p className="mt-1 text-xs text-maia-ink-soft/70">{r.requestId} &middot; {formatDateTime(r.createdAt)}</p>

                {r.status === "Pending" && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => reviewUpdateRequest(r.id, "Approved", "")}
                      className="border-maia-success/40"
                    >
                      <CheckCircle2 size={13} />
                      APPROVE
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="border-maia-danger/40 text-maia-danger hover:border-maia-danger hover:text-maia-danger"
                      onClick={() => reviewUpdateRequest(r.id, "Rejected", "")}
                    >
                      REJECT
                    </Button>
                  </div>
                )}
                {r.reviewNotes && <p className="mt-1.5 text-xs text-maia-ink-soft">Admin note: {r.reviewNotes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
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
