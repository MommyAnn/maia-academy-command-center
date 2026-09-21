import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { TASK_STATUS_TONE } from "@/components/team/statusMeta";
import { SESSION_STATUS_TONE, CERTIFICATE_STATUS_TONE } from "@/components/training/statusMeta";
import { PAYMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { SessionFormModal } from "@/components/training/SessionFormModal";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { useTaskStore } from "@/data/taskStore";
import { useTrainingStore } from "@/data/trainingStore";
import { useInventoryStore } from "@/data/inventoryStore";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import {
  getNetCash,
  getStudentFinanceSummary,
  getTotalExpenses,
  getTotalPackageValue,
  getTotalReceivables,
  getTotalVerifiedCollections,
} from "@/utils/finance";
import { getStudentAttendanceRate, computeCertificateEligibility } from "@/utils/training";
import { getCurrentStock } from "@/utils/inventory";
import { formatPeso } from "@/utils/format";
import type { Batch } from "@/types/student";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "students", label: "Students" },
  { value: "finance", label: "Finance" },
  { value: "training", label: "Training" },
  { value: "attendance", label: "Attendance" },
  { value: "tasks", label: "Tasks" },
  { value: "materials", label: "Materials" },
  { value: "certificates", label: "Certificates" },
];

export function BatchDetail() {
  const { batch: batchParam } = useParams<{ batch: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  const { students } = useStudentStore();
  const { transactions, adjustments, expenses } = useFinanceStore();
  const { tasks } = useTaskStore();
  const { sessions, enrollments, certificates } = useTrainingStore();
  const { items, transactions: inventoryTransactions, materialPlans, setMaterialRequirement } = useInventoryStore();

  const batch = batchParam ? (decodeURIComponent(batchParam) as Batch) : undefined;
  if (!batch || !BATCH_OPTIONS.includes(batch)) {
    return <Navigate to="/students/batches" replace />;
  }

  const batchStudents = students.filter((s) => s.batch === batch);
  const batchTransactions = transactions.filter((t) => t.batch === batch);
  const batchExpenses = expenses.filter((e) => e.relatedBatch === batch);
  const batchTasks = tasks.filter((t) => t.relatedBatch === batch);
  const batchSessions = sessions.filter((s) => s.batch === batch);
  const batchCertificates = certificates.filter((c) => c.batch === batch);

  const packageValue = getTotalPackageValue(batchStudents, adjustments);
  const verifiedCollections = getTotalVerifiedCollections(batchTransactions);
  const receivables = getTotalReceivables(batchStudents, transactions, adjustments);
  const totalExpenses = getTotalExpenses(batchExpenses);
  const netCash = getNetCash(verifiedCollections, totalExpenses);

  const f2fCount = batchStudents.filter((s) => s.attendance === "Face-to-Face").length;
  const zoomCount = batchStudents.filter((s) => s.attendance === "Early Access via Zoom").length;
  const bothCount = batchStudents.filter((s) => s.attendance === "Both").length;

  const completedSessions = batchSessions.filter((s) => s.status === "Completed");
  const avgAttendanceRate =
    batchStudents.length > 0
      ? Math.round(
          batchStudents.reduce((sum, s) => sum + getStudentAttendanceRate(s.id, sessions, enrollments), 0) / batchStudents.length,
        )
      : 0;

  const certsReady = batchCertificates.filter((c) => c.status === "Ready").length;
  const certsIssued = batchCertificates.filter((c) => c.status === "Issued").length;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <button onClick={() => navigate("/students/batches")} className="flex w-fit items-center gap-1.5 text-sm font-medium text-maia-ink-soft hover:text-maia-ink">
        <ArrowLeft size={15} />
        Back to Batches
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Batch Operations</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">{batch}</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">{batchStudents.length} total students.</p>
        </div>
        <Button onClick={() => setSessionModalOpen(true)}>
          <Plus size={15} />
          NEW SESSION
        </Button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          <Stat label="Total Students" value={String(batchStudents.length)} />
          <Stat label="F2F Students" value={String(f2fCount)} />
          <Stat label="Zoom Students" value={String(zoomCount)} />
          <Stat label="Both" value={String(bothCount)} />
          <Stat label="Training Sessions" value={String(batchSessions.length)} />
          <Stat label="Attendance Rate" value={`${avgAttendanceRate}%`} />
          <Stat label="Certificates Ready" value={String(certsReady)} />
          <Stat label="Certificates Issued" value={String(certsIssued)} />
        </div>
      )}

      {tab === "students" && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Attendance Pref.</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchStudents.map((s) => {
                  const summary = getStudentFinanceSummary(s, transactions, adjustments);
                  return (
                    <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{s.studentId}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.fullName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.package}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.attendance}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={PAYMENT_STATUS_TONE[summary.status]}>{summary.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/students/${s.id}`)}>
                          VIEW
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "finance" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Package Value" value={formatPeso(packageValue)} />
            <Stat label="Verified Collections" value={formatPeso(verifiedCollections)} />
            <Stat label="Receivables" value={formatPeso(receivables)} />
            <Stat label="Expenses" value={formatPeso(totalExpenses)} />
            <Stat label="Net Cash" value={formatPeso(netCash)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/finance/payments?batch=${encodeURIComponent(batch)}`)}>
              VIEW PAYMENTS
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/finance/receivables?batch=${encodeURIComponent(batch)}`)}>
              VIEW RECEIVABLES
            </Button>
          </div>
        </div>
      )}

      {tab === "training" && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchSessions.map((s) => (
                  <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.title}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.date}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={SESSION_STATUS_TONE[s.status]}>{s.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/training/sessions/${s.id}`)}>
                        VIEW
                      </Button>
                    </td>
                  </tr>
                ))}
                {batchSessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                      No training sessions for this batch yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "attendance" && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Completed Sessions Attended</th>
                  <th className="px-4 py-3">Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {batchStudents.map((s) => (
                  <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{completedSessions.length}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-maia-ink">
                      {getStudentAttendanceRate(s.id, sessions, enrollments)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "tasks" && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchTasks.map((t) => (
                  <tr key={t.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{t.title}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.assignedToName}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={TASK_STATUS_TONE[t.status]}>{t.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.dueDate}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/team/tasks/${encodeURIComponent(t.id)}`)}>
                        VIEW
                      </Button>
                    </td>
                  </tr>
                ))}
                {batchTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                      No tasks linked to this batch yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "materials" && (
        <MaterialsTab
          batch={batch}
          expectedF2fStudents={f2fCount + bothCount}
          items={items}
          inventoryTransactions={inventoryTransactions}
          materialPlans={materialPlans.filter((p) => p.batch === batch)}
          onSetRequirement={setMaterialRequirement}
        />
      )}

      {tab === "certificates" && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Certificate ID</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {batchStudents.map((s) => {
                  const record = batchCertificates
                    .filter((c) => c.studentId === s.id && c.status !== "Reissued")
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                  const { eligible } = computeCertificateEligibility(s, sessions, enrollments, transactions, adjustments, {
                    requireConfirmedEnrollment: true,
                    requireRequirementsVerified: true,
                    minAttendancePercent: 80,
                    requireFullyPaid: false,
                  });
                  const status = record?.status ?? (eligible ? "Eligible" : "Not Eligible");
                  return (
                    <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.fullName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{record?.certificateId ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={CERTIFICATE_STATUS_TONE[status]}>{status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end p-4">
            <Button variant="secondary" onClick={() => navigate("/training/certificates")}>
              MANAGE CERTIFICATES
            </Button>
          </div>
        </Card>
      )}

      <SessionFormModal open={sessionModalOpen} onClose={() => setSessionModalOpen(false)} defaultBatch={batch} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className="mt-1.5 font-display text-xl font-extrabold text-maia-ink">{value}</p>
    </Card>
  );
}

function MaterialsTab({
  batch,
  expectedF2fStudents,
  items,
  inventoryTransactions,
  materialPlans,
  onSetRequirement,
}: {
  batch: Batch;
  expectedF2fStudents: number;
  items: ReturnType<typeof useInventoryStore>["items"];
  inventoryTransactions: ReturnType<typeof useInventoryStore>["transactions"];
  materialPlans: ReturnType<typeof useInventoryStore>["materialPlans"];
  onSetRequirement: (batch: Batch, itemId: string, quantity: number) => void;
}) {
  return (
    <Card>
      <CardHeader
        title={`Materials Planning — ${batch}`}
        subtitle={`Expected F2F/Both students: ${expectedF2fStudents}. Planning only — never automatically deducts stock.`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="py-2.5 pr-3">Item</th>
              <th className="py-2.5 pr-3">Required</th>
              <th className="py-2.5 pr-3">Available</th>
              <th className="py-2.5 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const plan = materialPlans.find((p) => p.itemId === item.id);
              const required = plan?.requiredQuantity ?? 0;
              const available = getCurrentStock(item.id, inventoryTransactions);
              const shortage = required - available;
              return (
                <tr key={item.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-maia-ink">{item.name}</td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={required}
                      onBlur={(e) => onSetRequirement(batch, item.id, Number(e.target.value) || 0)}
                      className="w-24 rounded-lg border border-maia-border bg-maia-surface px-2.5 py-1.5 text-sm text-maia-ink outline-none focus:border-maia-gold"
                    />
                  </td>
                  <td className="py-2.5 pr-3 text-maia-ink-soft">
                    {available} {item.unit}
                  </td>
                  <td className="py-2.5 pr-3">
                    {required === 0 ? (
                      <span className="text-xs text-maia-ink-soft">No requirement set</span>
                    ) : shortage > 0 ? (
                      <Badge tone="danger">{shortage} SHORT</Badge>
                    ) : (
                      <Badge tone="success">Sufficient</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
