import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import {
  DEFAULT_STUDENT_FILTERS,
  StudentFiltersBar,
  matchesStudentFilters,
} from "@/components/students/StudentFiltersBar";
import { ENROLLMENT_STATUS_OPTIONS, ENROLLMENT_STATUS_TONE, PAYMENT_STATUS_TONE, REQUIREMENTS_SUMMARY_TONE } from "@/components/students/statusMeta";
import { useStudentStore } from "@/data/studentStore";
import { getRequirementsSummary } from "@/utils/students";
import { formatDate } from "@/utils/students";

export function NewEnrollments() {
  const { students } = useStudentStore();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(DEFAULT_STUDENT_FILTERS);

  const sorted = useMemo(
    () => [...students].sort((a, b) => (a.dateSubmitted < b.dateSubmitted ? 1 : -1)),
    [students],
  );

  const filtered = useMemo(
    () =>
      sorted.filter((s) =>
        matchesStudentFilters(filters, {
          searchable: `${s.studentId} ${s.fullName} ${s.facebookName}`,
          batch: s.batch,
          pkg: s.package,
          status: s.enrollmentStatus,
        }),
      ),
    [sorted, filters],
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Students</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">
            New Enrollments
          </h1>
          <p className="mt-1 text-sm text-maia-ink-soft">
            Newest student submissions, sorted by date submitted.
          </p>
        </div>
        <Button variant="secondary" onClick={() => window.open("/enroll", "_blank")}>
          <ExternalLink size={15} />
          OPEN ENROLLMENT FORM
        </Button>
      </div>

      <StudentFiltersBar
        filters={filters}
        onChange={setFilters}
        searchPlaceholder="Search by name or Student ID..."
        statusOptions={[
          { value: "all", label: "All Statuses" },
          ...ENROLLMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
        ]}
      />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <Th>Student ID</Th>
                <Th>Student Name</Th>
                <Th>Facebook Name</Th>
                <Th>Batch</Th>
                <Th>Package</Th>
                <Th>Attendance</Th>
                <Th>Payment Status</Th>
                <Th>Requirements</Th>
                <Th>Enrollment Status</Th>
                <Th>Date Submitted</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <Td className="font-mono text-xs font-semibold text-maia-ink">{s.studentId}</Td>
                  <Td className="font-medium text-maia-ink">{s.fullName}</Td>
                  <Td className="text-maia-ink-soft">{s.facebookName}</Td>
                  <Td className="text-maia-ink-soft">{s.batch}</Td>
                  <Td className="text-maia-ink-soft">{s.package}</Td>
                  <Td className="text-maia-ink-soft">{s.attendance}</Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[s.payment.status]}>{s.payment.status}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={REQUIREMENTS_SUMMARY_TONE[getRequirementsSummary(s)]}>
                      {getRequirementsSummary(s)}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={ENROLLMENT_STATUS_TONE[s.enrollmentStatus]}>{s.enrollmentStatus}</Badge>
                  </Td>
                  <Td className="text-maia-ink-soft">{formatDate(s.dateSubmitted)}</Td>
                  <Td>
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/students/${s.id}`)}>
                      VIEW STUDENT
                    </Button>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No enrollments match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
