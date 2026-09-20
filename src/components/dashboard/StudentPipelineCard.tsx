import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { getPipelineCounts, type PipelineStage } from "@/utils/dashboard";
import type { StudentRecord } from "@/types/student";

export function StudentPipelineCard({ students }: { students: StudentRecord[] }) {
  const navigate = useNavigate();
  const counts = getPipelineCounts(students);
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  function goToStage(stage: PipelineStage) {
    if (stage === "New Enrollment") {
      navigate("/students/all");
      return;
    }
    navigate(`/students/all?stage=${encodeURIComponent(stage)}`);
  }

  return (
    <Card>
      <CardHeader title="Student Journey / Pipeline" subtitle="Where every student currently stands, to spot bottlenecks." />

      <div className="flex flex-col gap-1.5">
        {counts.map((item, idx) => (
          <div key={item.stage}>
            <button
              onClick={() => goToStage(item.stage)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-maia-bg"
            >
              <span className="w-44 flex-shrink-0 truncate text-sm font-medium text-maia-ink sm:w-48">{item.stage}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-maia-bg">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-maia-gold-deep to-maia-gold"
                  style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }}
                />
              </span>
              <span className="w-10 flex-shrink-0 text-right font-display text-sm font-bold text-maia-ink">{item.count}</span>
            </button>
            {idx < counts.length - 1 && (
              <div className="flex justify-start pl-4">
                <ChevronRight size={13} className="rotate-90 text-maia-ink-soft/40" />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
