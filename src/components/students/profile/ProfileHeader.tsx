import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { ENROLLMENT_STATUS_TONE } from "@/components/students/statusMeta";
import type { StudentRecord } from "@/types/student";

export function ProfileHeader({ student }: { student: StudentRecord }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-maia-ink-soft hover:text-maia-ink"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-maia-black font-display text-lg font-bold text-maia-gold">
            {initials(student.fullName)}
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold text-maia-ink sm:text-2xl">{student.fullName}</h1>
            <p className="mt-0.5 font-mono text-sm text-maia-ink-soft">{student.studentId}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{student.batch}</Badge>
          <Badge tone="gold">{student.package}</Badge>
          <Badge tone={ENROLLMENT_STATUS_TONE[student.enrollmentStatus]}>{student.enrollmentStatus}</Badge>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
