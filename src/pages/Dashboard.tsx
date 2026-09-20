import { useAuth } from "@/context/AuthContext";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { BatchEnrollmentCard } from "@/components/dashboard/BatchEnrollmentCard";
import { FinancialOverviewCard } from "@/components/dashboard/FinancialOverviewCard";
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard";
import { MasterBrainProgressCard } from "@/components/dashboard/MasterBrainProgressCard";
import { StaffTasksCard } from "@/components/dashboard/StaffTasksCard";
import { InventoryAlertsCard } from "@/components/dashboard/InventoryAlertsCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import {
  DEMO_ATTENTION_ITEMS,
  DEMO_BATCH_ENROLLMENT,
  DEMO_FINANCIAL_OVERVIEW,
  DEMO_INVENTORY_ALERTS,
  DEMO_KPI_CARDS,
  DEMO_MASTER_BRAIN_PROGRESS,
  DEMO_RECENT_ACTIVITY,
  DEMO_STAFF_TASKS,
} from "@/data/demoDashboardData";

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">
            Owner Dashboard
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">
            Welcome back, {user?.name ?? "Mommy Ann"}
          </h1>
          <p className="mt-1 text-sm text-maia-ink-soft">
            Here&rsquo;s what&rsquo;s happening across M.A.I.A. Academy.
          </p>
        </div>
        <DashboardFilters />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DEMO_KPI_CARDS.map((card) => (
          <KpiCard key={card.id} data={card} />
        ))}
      </div>

      <BatchEnrollmentCard data={DEMO_BATCH_ENROLLMENT} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FinancialOverviewCard data={DEMO_FINANCIAL_OVERVIEW} />
        </div>
        <NeedsAttentionCard items={DEMO_ATTENTION_ITEMS} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MasterBrainProgressCard data={DEMO_MASTER_BRAIN_PROGRESS} />
        </div>
        <InventoryAlertsCard items={DEMO_INVENTORY_ALERTS} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <StaffTasksCard tasks={DEMO_STAFF_TASKS} />
        </div>
        <RecentActivityCard items={DEMO_RECENT_ACTIVITY} />
      </div>
    </div>
  );
}
