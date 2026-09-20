import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { getNetCash, getTotalExpenses, getTotalPackageValue, getTotalReceivables, getTotalVerifiedCollections } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import type { Batch, StudentRecord } from "@/types/student";
import type { Expense, PackageAdjustment, PaymentTransaction } from "@/types/finance";

export function CollectionsByBatchTable({
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

  function goToBatch(batch: Batch) {
    navigate(`/students/batches#batch-${batch.replace(/\s+/g, "-")}`);
  }

  return (
    <Card padded={false}>
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <CardHeader title="Batch Financial Performance" />
      </div>
      <div className="overflow-x-auto px-5 pb-5 sm:px-6 sm:pb-6">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="py-2.5 pr-3">Batch</th>
              <th className="py-2.5 pr-3">Students</th>
              <th className="py-2.5 pr-3">Package Value</th>
              <th className="py-2.5 pr-3">Collections</th>
              <th className="py-2.5 pr-3">Receivables</th>
              <th className="py-2.5 pr-3">Expenses</th>
              <th className="py-2.5 pr-3">Net Cash</th>
            </tr>
          </thead>
          <tbody>
            {BATCH_OPTIONS.map((batch) => {
              const batchStudents = students.filter((s) => s.batch === batch);
              const batchTransactions = transactions.filter((t) => t.batch === batch);
              const batchExpenses = expenses.filter((e) => e.relatedBatch === batch);
              const packageValue = getTotalPackageValue(batchStudents, adjustments);
              const collections = getTotalVerifiedCollections(batchTransactions);
              const receivables = getTotalReceivables(batchStudents, transactions, adjustments);
              const expenseTotal = getTotalExpenses(batchExpenses);
              const netCash = getNetCash(collections, expenseTotal);

              return (
                <tr
                  key={batch}
                  onClick={() => goToBatch(batch)}
                  className="cursor-pointer border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/50"
                >
                  <td className="py-3 pr-3 font-semibold text-maia-ink">{batch}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{batchStudents.length}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{formatPeso(packageValue)}</td>
                  <td className="py-3 pr-3 font-medium text-maia-gold-deep">{formatPeso(collections)}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{formatPeso(receivables)}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{formatPeso(expenseTotal)}</td>
                  <td className={`py-3 pr-3 font-semibold ${netCash >= 0 ? "text-maia-success" : "text-maia-danger"}`}>
                    {formatPeso(netCash)}
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
