import { Card, CardHeader } from "@/components/common/Card";
import { FilterSelect } from "@/components/common/FilterSelect";
import { ENROLLMENT_STATUS_OPTIONS } from "@/components/students/statusMeta";
import { useStudentStore } from "@/data/studentStore";
import { formatDate } from "@/utils/students";
import type { StudentRecord } from "@/types/student";

export function OverviewTab({ student }: { student: StudentRecord }) {
  const { updateEnrollmentStatus } = useStudentStore();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Personal Information" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Facebook Name" value={student.facebookName} />
          <Field label="Real Full Name" value={student.fullName} />
          <Field label="Companion Name" value={student.companionName || "—"} />
          <Field label="Email Address" value={student.email} />
          <Field label="Contact Number" value={student.contactNumber} />
          <Field label="City / Location" value={student.city} />
        </dl>
      </Card>

      <Card>
        <CardHeader title="Enrollment" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Batch" value={student.batch} />
          <Field label="Package" value={student.package} />
          <Field label="Attendance Preference" value={student.attendance} />
          <Field label="Enrollment Date" value={formatDate(student.enrollmentDate)} />
        </dl>

        <div className="mt-5 border-t border-maia-border pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
            Enrollment Status
          </p>
          <FilterSelect
            value={student.enrollmentStatus}
            onChange={(v) => updateEnrollmentStatus(student.id, v as StudentRecord["enrollmentStatus"])}
            options={ENROLLMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </div>
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
