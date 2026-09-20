import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BanknoteArrowDown, BanknoteArrowUp, Download, PiggyBank, Printer, Receipt, Users, Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { FinanceDateFilter, DEFAULT_DATE_FILTER } from "@/components/finance/FinanceDateFilter";
import { useFinanceStore } from "@/data/financeStore";
import { useStudentStore } from "@/data/studentStore";
import {
  downloadCsv,
  getNetCash,
  getStudentFinanceSummary,
  getTotalExpenses,
  getTotalPackageValue,
  getTotalReceivables,
  getTotalVerifiedCollections,
  getVerifiedTransactions,
  matchesDateFilter,
} from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { formatDate } from "@/utils/students";
import { BATCH_OPTIONS, PACKAGE_OPTIONS } from "@/data/enrollmentConfig";
import { PAYMENT_METHODS } from "@/data/financeConfig";
import { EXPENSE_CATEGORIES } from "@/data/financeConfig";

export function Reports() {
  const { students } = useStudentStore();
  const { transactions, adjustments, expenses } = useFinanceStore();
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
  const [batch, setBatch] = useState("all");

  const scopedStudents = useMemo(
    () => (batch === "all" ? students : students.filter((s) => s.batch === batch)),
    [students, batch],
  );
  const batchTransactions = useMemo(
    () => (batch === "all" ? transactions : transactions.filter((t) => t.batch === batch)),
    [transactions, batch],
  );
  const batchExpenses = useMemo(
    () => (batch === "all" ? expenses : expenses.filter((e) => e.relatedBatch === batch)),
    [expenses, batch],
  );
  const rangedTransactions = useMemo(
    () => batchTransactions.filter((t) => matchesDateFilter(t.date, dateFilter)),
    [batchTransactions, dateFilter],
  );
  const rangedExpenses = useMemo(
    () => batchExpenses.filter((e) => matchesDateFilter(e.date, dateFilter)),
    [batchExpenses, dateFilter],
  );

  // Breakdown charts always look across every batch for the selected period,
  // so comparisons between batches/packages/methods stay meaningful even
  // when the "Batch" filter above is narrowed for the summary cards.
  const rangedAllBatches = useMemo(
    () => getVerifiedTransactions(transactions.filter((t) => matchesDateFilter(t.date, dateFilter))),
    [transactions, dateFilter],
  );

  const totalVerifiedCollections = getTotalVerifiedCollections(rangedTransactions);
  const totalExpenses = getTotalExpenses(rangedExpenses);
  const netCash = getNetCash(totalVerifiedCollections, totalExpenses);
  const totalPackageValue = getTotalPackageValue(scopedStudents, adjustments);
  const totalReceivables = getTotalReceivables(scopedStudents, transactions, adjustments);

  const byBatch = useMemo(
    () => BATCH_OPTIONS.map((b) => ({ name: b, amount: rangedAllBatches.filter((t) => t.batch === b).reduce((s, t) => s + t.amount, 0) })),
    [rangedAllBatches],
  );

  const byPackage = useMemo(
    () => PACKAGE_OPTIONS.map((p) => ({ name: p, amount: rangedAllBatches.filter((t) => t.package === p).reduce((s, t) => s + t.amount, 0) })),
    [rangedAllBatches],
  );

  const byMethod = useMemo(
    () => PAYMENT_METHODS.map((m) => ({ name: m, amount: rangedAllBatches.filter((t) => t.method === m).reduce((s, t) => s + t.amount, 0) })).filter((r) => r.amount > 0),
    [rangedAllBatches],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of rangedAllBatches) {
      const label = new Date(t.date).toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
      map.set(label, (map.get(label) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => new Date(`1 ${a.name}`).getTime() - new Date(`1 ${b.name}`).getTime());
  }, [rangedAllBatches]);

  const receivablesByBatch = useMemo(
    () =>
      BATCH_OPTIONS.map((b) => {
        const batchStudents = students.filter((s) => s.batch === b);
        const withBalance = batchStudents.filter((s) => getStudentFinanceSummary(s, transactions, adjustments).balance > 0);
        const total = withBalance.reduce((sum, s) => sum + getStudentFinanceSummary(s, transactions, adjustments).balance, 0);
        return { batch: b, studentsWithBalance: withBalance.length, total };
      }),
    [students, transactions, adjustments],
  );

  const expensesByCategory = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((c) => ({
        name: c,
        amount: rangedExpenses.filter((e) => e.status === "Active" && e.category === c).reduce((s, e) => s + e.amount, 0),
      })).filter((r) => r.amount > 0),
    [rangedExpenses],
  );

  function handleExportCsv() {
    const rows: (string | number)[][] = [
      ["Transaction ID", "Date", "Student ID", "Student Name", "Batch", "Package", "Type", "Amount", "Method", "Reference #", "Status", "Verified By"],
      ...rangedTransactions.map((t) => [t.id, t.date, t.studentDisplayId, t.studentName, t.batch, t.package, t.type, t.amount, t.method, t.referenceNumber, t.status, t.verifiedBy ?? ""]),
    ];
    downloadCsv(`maia-collections-${dateFilter.preset}.csv`, rows);
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Finance</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">FINANCIAL REPORTS</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">All figures come from the same transaction records used elsewhere.</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-3">
          <FinanceDateFilter value={dateFilter} onChange={setDateFilter} batch={batch} onBatchChange={setBatch} />
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleExportCsv}>
          <Download size={15} />
          EXPORT CSV
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={15} />
          PRINT REPORT
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FinanceStatCard label="Total Students" value={String(scopedStudents.length)} icon={<Users size={18} />} />
        <FinanceStatCard label="Total Package Value" value={formatPeso(totalPackageValue)} icon={<PiggyBank size={18} />} />
        <FinanceStatCard label="Total Verified Collections" value={formatPeso(totalVerifiedCollections)} icon={<BanknoteArrowUp size={18} />} accent="gold" />
        <FinanceStatCard label="Total Receivables" value={formatPeso(totalReceivables)} icon={<Wallet size={18} />} />
        <FinanceStatCard label="Total Expenses" value={formatPeso(totalExpenses)} icon={<BanknoteArrowDown size={18} />} />
        <FinanceStatCard label="Net Cash" value={formatPeso(netCash)} icon={<Receipt size={18} />} accent={netCash >= 0 ? "neutral" : "danger"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ReportChartCard title="Collections by Date" data={byMonth} />
        <ReportChartCard title="Collections by Batch" data={byBatch} />
        <ReportChartCard title="Collections by Package" data={byPackage} />
        <ReportChartCard title="Collections by Payment Method" data={byMethod} />
      </div>

      <Card>
        <CardHeader title="Receivables by Batch" />
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="py-2.5 pr-3">Batch</th>
              <th className="py-2.5 pr-3">Students with Balance</th>
              <th className="py-2.5 pr-3">Total Receivable</th>
            </tr>
          </thead>
          <tbody>
            {receivablesByBatch.map((row) => (
              <tr key={row.batch} className="border-b border-maia-border/60 last:border-0">
                <td className="py-3 pr-3 font-medium text-maia-ink">{row.batch}</td>
                <td className="py-3 pr-3 text-maia-ink-soft">{row.studentsWithBalance}</td>
                <td className="py-3 pr-3 font-semibold text-maia-danger">{formatPeso(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ReportChartCard title="Expenses by Category" data={expensesByCategory} showTable />

      <p className="text-xs text-maia-ink-soft">
        Report generated {formatDate(new Date().toISOString())} &middot; demo data only, not connected to a real
        database yet.
      </p>
    </div>
  );
}

function ReportChartCard({
  title,
  data,
  showTable,
}: {
  title: string;
  data: { name: string; amount: number }[];
  showTable?: boolean;
}) {
  const hasData = data.some((d) => d.amount > 0);

  return (
    <Card>
      <CardHeader title={title} />
      {hasData ? (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#e7e2d6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#5c584f", fontSize: 11 }} interval={0} angle={data.length > 4 ? -20 : 0} textAnchor={data.length > 4 ? "end" : "middle"} height={data.length > 4 ? 50 : 24} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#5c584f", fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={38} />
                <Tooltip cursor={{ fill: "rgba(200,164,77,0.08)" }} contentStyle={{ borderRadius: 10, border: "1px solid #e7e2d6", fontSize: 12.5 }} formatter={(value) => formatPeso(Number(value))} />
                <Bar dataKey="amount" fill="#c8a44d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {showTable && (
            <table className="mt-4 w-full border-collapse text-sm">
              <tbody>
                {data.map((row) => (
                  <tr key={row.name} className="border-t border-maia-border/60">
                    <td className="py-2 text-maia-ink-soft">{row.name}</td>
                    <td className="py-2 text-right font-semibold text-maia-ink">{formatPeso(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p className="py-10 text-center text-sm text-maia-ink-soft">No data for the selected period.</p>
      )}
    </Card>
  );
}
