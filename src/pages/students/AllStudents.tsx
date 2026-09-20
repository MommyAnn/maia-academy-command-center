import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import {
  DEFAULT_STUDENT_FILTERS,
  StudentFiltersBar,
  matchesStudentFilters,
} from "@/components/students/StudentFiltersBar";
import {
  ENROLLMENT_STATUS_OPTIONS,
  ENROLLMENT_STATUS_TONE,
  MASTER_BRAIN_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  REQUIREMENTS_SUMMARY_TONE,
  TAOBAO_STATUS_TONE,
} from "@/components/students/statusMeta";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { getRequirementsSummary } from "@/utils/students";
import { getStudentFinanceSummary, type StudentFinanceSummary } from "@/utils/finance";
import { getRequirementsBucket, getStudentPipelineStage, type PipelineStage, type RequirementsBucket } from "@/utils/dashboard";
import { formatPeso } from "@/utils/format";
import type { StudentRecord, TaobaoStatus } from "@/types/student";

interface AdvancedFilter {
  stage: PipelineStage | null;
  taobao: TaobaoStatus | null;
  requirements: RequirementsBucket | null;
  masterBrain: string | null;
}

function readAdvancedFilter(params: URLSearchParams): AdvancedFilter {
  return {
    stage: (params.get("stage") as PipelineStage) || null,
    taobao: (params.get("taobao") as TaobaoStatus) || null,
    requirements: (params.get("requirements") as RequirementsBucket) || null,
    masterBrain: params.get("masterBrain") || null,
  };
}

function describeAdvancedFilter(f: AdvancedFilter): string | null {
  if (f.stage) return `Pipeline stage: ${f.stage}`;
  if (f.taobao) return `Taobao status: ${f.taobao}`;
  if (f.requirements) return `Requirements: ${f.requirements}`;
  if (f.masterBrain) return `Master Brain: ${f.masterBrain}`;
  return null;
}

type SortKey = "fullName" | "batch" | "balance";

export function AllStudents() {
  const { students } = useStudentStore();
  const { transactions, adjustments } = useFinanceStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_STUDENT_FILTERS,
    batch: searchParams.get("batch") ?? DEFAULT_STUDENT_FILTERS.batch,
  }));
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter | null>(() => {
    const parsed = readAdvancedFilter(searchParams);
    return describeAdvancedFilter(parsed) ? parsed : null;
  });
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(
    () =>
      students
        .filter((s) =>
          matchesStudentFilters(filters, {
            searchable: `${s.studentId} ${s.fullName} ${s.facebookName}`,
            batch: s.batch,
            pkg: s.package,
            status: s.enrollmentStatus,
          }),
        )
        .filter((s) => {
          if (!advancedFilter) return true;
          if (advancedFilter.stage && getStudentPipelineStage(s) !== advancedFilter.stage) return false;
          if (advancedFilter.taobao && s.taobao.status !== advancedFilter.taobao) return false;
          if (advancedFilter.requirements && getRequirementsBucket(s) !== advancedFilter.requirements) return false;
          if (advancedFilter.masterBrain && s.masterBrainStatus !== advancedFilter.masterBrain) return false;
          return true;
        }),
    [students, filters, advancedFilter],
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fullName") cmp = a.fullName.localeCompare(b.fullName);
      if (sortKey === "batch") cmp = a.batch.localeCompare(b.batch);
      if (sortKey === "balance") {
        cmp =
          getStudentFinanceSummary(a, transactions, adjustments).balance -
          getStudentFinanceSummary(b, transactions, adjustments).balance;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortAsc, transactions, adjustments]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Students</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">All Students</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">
          {students.length} students across all batches &middot; masterlist view.
        </p>
      </div>

      <StudentFiltersBar
        filters={filters}
        onChange={setFilters}
        searchPlaceholder="Search by name, Facebook name, or Student ID..."
        statusOptions={[
          { value: "all", label: "All Statuses" },
          ...ENROLLMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
        ]}
      />

      {advancedFilter && describeAdvancedFilter(advancedFilter) && (
        <div className="flex items-center justify-between rounded-lg border border-maia-gold/30 bg-maia-gold-bg px-4 py-2.5 text-sm text-maia-gold-deep">
          <span className="font-medium">Filtered from dashboard &middot; {describeAdvancedFilter(advancedFilter)}</span>
          <button
            onClick={() => setAdvancedFilter(null)}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold hover:bg-maia-gold/15"
          >
            <X size={13} />
            Clear
          </button>
        </div>
      )}

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1440px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <Th>Student ID</Th>
                <SortableTh label="Full Name" active={sortKey === "fullName"} asc={sortAsc} onClick={() => toggleSort("fullName")} />
                <Th>Facebook Name</Th>
                <SortableTh label="Batch" active={sortKey === "batch"} asc={sortAsc} onClick={() => toggleSort("batch")} />
                <Th>Package</Th>
                <Th>Attendance</Th>
                <Th>Payment Status</Th>
                <SortableTh label="Balance" active={sortKey === "balance"} asc={sortAsc} onClick={() => toggleSort("balance")} />
                <Th>Requirements</Th>
                <Th>Taobao Status</Th>
                <Th>Master Brain</Th>
                <Th>Enrollment Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  summary={getStudentFinanceSummary(s, transactions, adjustments)}
                  onView={() => navigate(`/students/${s.id}`)}
                />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No students match your filters.
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

function StudentRow({
  student: s,
  summary,
  onView,
}: {
  student: StudentRecord;
  summary: StudentFinanceSummary;
  onView: () => void;
}) {
  return (
    <tr className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
      <Td className="font-mono text-xs font-semibold text-maia-ink">{s.studentId}</Td>
      <Td className="font-medium text-maia-ink">{s.fullName}</Td>
      <Td className="text-maia-ink-soft">{s.facebookName}</Td>
      <Td className="text-maia-ink-soft">{s.batch}</Td>
      <Td className="text-maia-ink-soft">{s.package}</Td>
      <Td className="text-maia-ink-soft">{s.attendance}</Td>
      <Td>
        <Badge tone={PAYMENT_STATUS_TONE[summary.status]}>{summary.status}</Badge>
      </Td>
      <Td className="font-medium text-maia-ink">{formatPeso(summary.balance)}</Td>
      <Td>
        <Badge tone={REQUIREMENTS_SUMMARY_TONE[getRequirementsSummary(s)]}>{getRequirementsSummary(s)}</Badge>
      </Td>
      <Td>
        <Badge tone={TAOBAO_STATUS_TONE[s.taobao.status]}>{s.taobao.status}</Badge>
      </Td>
      <Td>
        <Badge tone={MASTER_BRAIN_STATUS_TONE[s.masterBrainStatus]}>{s.masterBrainStatus}</Badge>
      </Td>
      <Td>
        <Badge tone={ENROLLMENT_STATUS_TONE[s.enrollmentStatus]}>{s.enrollmentStatus}</Badge>
      </Td>
      <Td>
        <Button size="sm" variant="secondary" onClick={onView}>
          VIEW STUDENT
        </Button>
      </Td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function SortableTh({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <th className="whitespace-nowrap px-4 py-3">
      <button onClick={onClick} className="flex items-center gap-1 hover:text-maia-ink">
        {label}
        {active && (asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
