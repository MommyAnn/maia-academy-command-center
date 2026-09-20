import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  GraduationCap,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Card } from "@/components/common/Card";
import type { KpiCardData, KpiIconName } from "@/types";

const ICONS: Record<KpiIconName, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  students: Users,
  enrollments: UserPlus,
  confirmed: UserCheck,
  collections: BanknoteArrowUp,
  receivables: GraduationCap,
  expenses: BanknoteArrowDown,
};

export function KpiCard({ data }: { data: KpiCardData }) {
  const Icon = ICONS[data.icon];
  const isGold = data.accent === "gold";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-maia-ink-soft">
          {data.label}
        </p>
        <div
          className={
            isGold
              ? "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-maia-black text-maia-gold"
              : "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-maia-gold-bg text-maia-gold-deep"
          }
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
      </div>
      <div>
        <p className="font-display text-[28px] font-extrabold leading-none text-maia-ink">
          {data.value}
        </p>
        <p className="mt-2 text-sm text-maia-ink-soft">{data.helperText}</p>
      </div>
    </Card>
  );
}
