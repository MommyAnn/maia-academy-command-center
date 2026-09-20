import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/common/Card";
import { formatPeso } from "@/utils/format";
import type { FinancialOverview } from "@/types";

export function FinancialOverviewCard({ data }: { data: FinancialOverview }) {
  return (
    <Card>
      <CardHeader title="Financial Overview" subtitle="Demo data · selected period" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <FinancialStat label="Collections" value={data.collections} tone="ink" />
        <FinancialStat label="Receivables" value={data.receivables} tone="warning" />
        <FinancialStat label="Expenses" value={data.expenses} tone="danger" />
        <FinancialStat label="Estimated Net" value={data.estimatedNet} tone="gold" />
      </div>

      <div className="mt-6 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.monthly} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="#e7e2d6" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#5c584f", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#5c584f", fontSize: 11 }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(200,164,77,0.08)" }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e7e2d6",
                fontSize: 12.5,
              }}
              formatter={(value) => formatPeso(Number(value))}
            />
            <Bar dataKey="collections" name="Collections" fill="#c8a44d" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#0e0d0c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-xs text-maia-ink-soft/70">
        Demo data shown for illustration only &mdash; not connected to a live database.
      </p>
    </Card>
  );
}

function FinancialStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ink" | "warning" | "danger" | "gold";
}) {
  const toneClass = {
    ink: "text-maia-ink",
    warning: "text-maia-warning",
    danger: "text-maia-danger",
    gold: "text-maia-gold-deep",
  }[tone];

  return (
    <div className="rounded-xl bg-maia-bg px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className={`mt-1.5 font-display text-lg font-extrabold leading-none ${toneClass}`}>
        {formatPeso(value)}
      </p>
    </div>
  );
}
