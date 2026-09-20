import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { getFinancialTrend } from "@/utils/dashboard";
import { getNetCash, getTotalExpenses, getTotalPackageValue, getTotalReceivables, getTotalVerifiedCollections } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import type { StudentRecord } from "@/types/student";
import type { Expense, PackageAdjustment, PaymentTransaction } from "@/types/finance";

const RANGE_OPTIONS = [
  { value: 7, label: "7 Days" },
  { value: 30, label: "30 Days" },
  { value: 90, label: "3 Months" },
  { value: 180, label: "6 Months" },
  { value: 365, label: "12 Months" },
];

export function FinancialPerformanceCard({
  students,
  transactions,
  adjustments,
  expenses,
}: {
  students: StudentRecord[];
  transactions: PaymentTransaction[];
  adjustments: PackageAdjustment[];
  expenses: Expense[];
}) {
  const navigate = useNavigate();
  const [rangeDays, setRangeDays] = useState(90);

  const trend = useMemo(() => getFinancialTrend(transactions, expenses, rangeDays), [transactions, expenses, rangeDays]);

  const packageValue = getTotalPackageValue(students, adjustments);
  const collections = getTotalVerifiedCollections(transactions);
  const receivables = getTotalReceivables(students, transactions, adjustments);
  const totalExpenses = getTotalExpenses(expenses);
  const netCash = getNetCash(collections, totalExpenses);

  return (
    <Card>
      <CardHeader
        title="Financial Performance"
        subtitle="Verified Collections vs Expenses"
        action={
          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
            className="rounded-lg border border-maia-border bg-maia-surface px-2.5 py-1.5 text-xs font-semibold text-maia-ink outline-none focus:border-maia-gold"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e7e2d6" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#5c584f", fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#5c584f", fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={38} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e7e2d6", fontSize: 12.5 }} formatter={(value) => formatPeso(Number(value))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="collections" name="Collections" fill="#c8a44d" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#0e0d0c" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniStat label="Package Value" value={formatPeso(packageValue)} />
        <MiniStat label="Collections" value={formatPeso(collections)} tone="gold" />
        <MiniStat label="Receivables" value={formatPeso(receivables)} onClick={() => navigate("/finance/receivables")} />
        <MiniStat label="Expenses" value={formatPeso(totalExpenses)} onClick={() => navigate("/finance/expenses")} />
        <MiniStat label="Net Cash" value={formatPeso(netCash)} tone={netCash >= 0 ? "neutral" : "danger"} />
      </div>

      <Button variant="secondary" className="mt-5 w-full justify-center" onClick={() => navigate("/finance/reports")}>
        VIEW FINANCE REPORT
      </Button>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "gold" | "neutral" | "danger";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  const valueTone = tone === "gold" ? "text-maia-gold-deep" : tone === "danger" ? "text-maia-danger" : "text-maia-ink";
  return (
    <Comp
      onClick={onClick}
      className={`rounded-xl bg-maia-bg px-3 py-3 text-left ${onClick ? "cursor-pointer transition-colors hover:bg-maia-gold-bg" : ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className={`mt-1 font-display text-sm font-extrabold leading-none ${valueTone}`}>{value}</p>
    </Comp>
  );
}
