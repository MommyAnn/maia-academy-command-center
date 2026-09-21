import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { FilterSelect } from "@/components/common/FilterSelect";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import { useStudentStore } from "@/data/studentStore";
import { useStaffStore } from "@/data/staffStore";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import { formatDate, formatDateTime } from "@/utils/students";
import type { MasterBrainStatus } from "@/types/student";
import type { MasterBrainSubmission } from "@/types/masterBrain";

const STATUS_OPTIONS: MasterBrainStatus[] = [
  "Not Started",
  "In Progress",
  "Submitted",
  "Under Review",
  "Needs Revision",
  "Approved for Generation",
  "Generating",
  "Draft Ready",
  "Final Review",
  "Completed",
  "Published",
];

export function Submissions() {
  const { submissions, assignReviewer } = useMasterBrainStore();
  const { students } = useStudentStore();
  const { staff } = useStaffStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignTarget, setAssignTarget] = useState<MasterBrainSubmission | null>(null);
  const [reviewerId, setReviewerId] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  const statusFilter = searchParams.get("status") ?? "All";

  const rows = submissions
    .map((submission) => ({ submission, student: students.find((s) => s.id === submission.studentId) }))
    .filter((r) => r.student)
    .filter((r) => statusFilter === "All" || r.submission.status === statusFilter)
    .sort((a, b) => (a.submission.lastSaved ?? "").localeCompare(b.submission.lastSaved ?? "") * -1);

  function openAssign(submission: MasterBrainSubmission) {
    setAssignTarget(submission);
    setReviewerId(submission.assignedReviewerId ?? "");
    setDueDate(submission.reviewDueDate ?? new Date().toISOString().slice(0, 10));
  }

  function confirmAssign() {
    if (!assignTarget || !reviewerId) return;
    const reviewer = staff.find((s) => s.id === reviewerId);
    assignReviewer(assignTarget.id, reviewerId, reviewer?.fullName ?? "Staff", dueDate);
    setAssignTarget(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Master Brain Submissions</h2>
          <p className="text-sm text-maia-ink-soft">{rows.length} submission(s) shown.</p>
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setSearchParams(v === "All" ? {} : { status: v })}
          options={[{ value: "All", label: "All Statuses" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Business Name</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted Date</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ submission, student }) => {
                const reviewer = submission.assignedReviewerId ? staff.find((s) => s.id === submission.assignedReviewerId) : null;
                return (
                  <tr key={submission.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{student!.studentId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink">{student!.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{submission.businessFoundation.businessName || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{student!.batch}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{student!.package}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{submission.progressPercent}%</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={MASTER_BRAIN_STATUS_TONE[submission.status]}>{submission.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                      {submission.submittedAt ? formatDate(submission.submittedAt) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{reviewer?.fullName ?? "Unassigned"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                      {submission.lastSaved ? formatDateTime(submission.lastSaved) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" onClick={() => navigate(`/master-brain/submissions/${submission.id}`)}>
                          VIEW
                        </Button>
                        {(submission.status === "Submitted" || submission.status === "Under Review") && (
                          <Button size="sm" variant="secondary" onClick={() => openAssign(submission)}>
                            <UserPlus size={13} />
                            ASSIGN
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No submissions match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        title="Assign Reviewer"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignTarget(null)}>
              CANCEL
            </Button>
            <Button onClick={confirmAssign} disabled={!reviewerId}>
              ASSIGN
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="Reviewer"
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
            placeholder="Select a staff member"
            options={staff.filter((s) => s.role !== "Owner").map((s) => ({ value: s.id, label: `${s.fullName} (${s.role})` }))}
          />
          <TextField label="Review Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
