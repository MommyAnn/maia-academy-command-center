import type { ReactNode } from "react";
import { AlertTriangle, Award, Boxes, CalendarCheck, ClipboardList, FileWarning, PhoneMissed, ShoppingBag, Timer, UserCheck, Wallet } from "lucide-react";
import { Card } from "@/components/common/Card";

export interface ActionCenterItem {
  key: string;
  label: string;
  count: number;
  icon: ReactNode;
  onClick: () => void;
}

export function ActionCenterCard({ items }: { items: ActionCenterItem[] }) {
  const hasUrgent = items.some((i) => i.count > 0);

  return (
    <Card>
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-maia-black text-maia-gold">
          <AlertTriangle size={18} strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-maia-ink">Action Center</h3>
          <p className="text-xs text-maia-ink-soft">Things that need your attention.</p>
        </div>
      </div>

      {!hasUrgent ? (
        <p className="rounded-lg bg-maia-success-bg px-4 py-6 text-center text-sm font-medium text-maia-success">
          You&rsquo;re all caught up &mdash; nothing needs action right now.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className="flex flex-col items-start gap-3 rounded-xl border border-maia-border bg-maia-surface px-4 py-4 text-left transition-colors hover:border-maia-gold hover:bg-maia-gold-bg/40"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  item.count > 0 ? "bg-maia-danger-bg text-maia-danger" : "bg-maia-bg text-maia-ink-soft"
                }`}
              >
                {item.icon}
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold leading-none text-maia-ink">{item.count}</p>
                <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{item.label}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export const ACTION_CENTER_ICONS = {
  payments: <Wallet size={18} />,
  requirements: <FileWarning size={18} />,
  taobao: <ShoppingBag size={18} />,
  masterBrain: <ClipboardList size={18} />,
  balance: <Wallet size={18} />,
  tasks: <Timer size={18} />,
  inventory: <Boxes size={18} />,
  attendance: <CalendarCheck size={18} />,
  certificates: <Award size={18} />,
  webinarFollowUps: <Timer size={18} />,
  webinarPayments: <Wallet size={18} />,
  highIntentLeads: <UserCheck size={18} />,
  noShowFollowUp: <PhoneMissed size={18} />,
};
