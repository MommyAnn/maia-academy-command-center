import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { PAYMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { getRemainingBalance } from "@/utils/students";
import { formatPeso } from "@/utils/format";
import type { StudentRecord } from "@/types/student";

export function PaymentTab({ student }: { student: StudentRecord }) {
  const balance = getRemainingBalance(student);

  return (
    <Card>
      <CardHeader
        title="Payment Summary"
        subtitle="Full payment history and receipts will be available in Step 3."
        action={<Badge tone={PAYMENT_STATUS_TONE[student.payment.status]}>{student.payment.status}</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Package Price" value={formatPeso(student.payment.packagePrice)} />
        <Stat label="Amount Paid" value={formatPeso(student.payment.amountPaid)} tone="success" />
        <Stat label="Remaining Balance" value={formatPeso(balance)} tone={balance > 0 ? "warning" : "success"} />
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-maia-success" : tone === "warning" ? "text-maia-warning" : "text-maia-ink";
  return (
    <div className="rounded-xl bg-maia-bg px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-extrabold leading-none ${toneClass}`}>{value}</p>
    </div>
  );
}
