import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/common/Card";
import {
  getEnrollmentByAttendance,
  getEnrollmentByBatch,
  getEnrollmentByPackage,
  getEnrollmentTrend,
  type TrendGranularity,
} from "@/utils/dashboard";
import type { StudentRecord } from "@/types/student";

const GRANULARITY_OPTIONS: { value: TrendGranularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function EnrollmentAnalyticsCard({ students }: { students: StudentRecord[] }) {
  const navigate = useNavigate();
  const [granularity, setGranularity] = useState<TrendGranularity>("monthly");

  const trend = useMemo(() => getEnrollmentTrend(students, granularity), [students, granularity]);
  const byBatch = useMemo(() => getEnrollmentByBatch(students), [students]);
  const byPackage = useMemo(() => getEnrollmentByPackage(students), [students]);
  const byAttendance = useMemo(() => getEnrollmentByAttendance(students), [students]);

  return (
    <Card>
      <CardHeader
        title="Enrollment Overview"
        subtitle="New Student Enrollments Over Time"
        action={
          <div className="flex rounded-lg border border-maia-border p-0.5">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  granularity === opt.value ? "bg-maia-black text-maia-gold" : "text-maia-ink-soft hover:text-maia-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e7e2d6" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#5c584f", fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#5c584f", fontSize: 11 }} width={28} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(200,164,77,0.08)" }} contentStyle={{ borderRadius: 10, border: "1px solid #e7e2d6", fontSize: 12.5 }} />
            <Bar dataKey="count" name="Enrollments" fill="#c8a44d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <BreakdownGroup
          label="By Batch"
          rows={byBatch.map((r) => ({ label: r.name, value: r.count, onClick: () => navigate(`/students/all?batch=${encodeURIComponent(r.name)}`) }))}
        />
        <BreakdownGroup
          label="By Package"
          rows={byPackage.map((r) => ({ label: r.name, value: r.count }))}
        />
        <BreakdownGroup
          label="By Attendance"
          rows={byAttendance.map((r) => ({ label: r.name, value: r.count }))}
        />
      </div>
    </Card>
  );
}

function BreakdownGroup({
  label,
  rows,
}: {
  label: string;
  rows: { label: string; value: number; onClick?: () => void }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const Comp = row.onClick ? "button" : "div";
          return (
            <Comp
              key={row.label}
              onClick={row.onClick}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${row.onClick ? "cursor-pointer transition-colors hover:bg-maia-bg" : ""}`}
            >
              <span className="text-maia-ink-soft">{row.label}</span>
              <span className="font-display font-bold text-maia-ink">{row.value}</span>
            </Comp>
          );
        })}
      </div>
    </div>
  );
}
