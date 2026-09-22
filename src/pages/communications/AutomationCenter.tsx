import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { AUTOMATION_CATEGORIES } from "@/types/communications";

/**
 * Categorized automation overview (spec section 12) — a dashboard over the
 * same AutomationRule records the Automation Rules page manages. Never a
 * separate/duplicated rule list.
 */
export function AutomationCenter() {
  const { automationRules } = useCommunicationsStore();
  const navigate = useNavigate();

  const activeCount = automationRules.filter((r) => r.status === "Active").length;
  const totalTriggered = automationRules.reduce((sum, r) => sum + r.totalTriggered, 0);
  const totalFailed = automationRules.reduce((sum, r) => sum + r.failed, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Automation Center</h2>
          <p className="text-sm text-maia-ink-soft">{activeCount} active automation(s) across {AUTOMATION_CATEGORIES.length} categories.</p>
        </div>
        <Button onClick={() => navigate("/communications/automation-rules")}>MANAGE RULES</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4">
          <p className="font-display text-2xl font-extrabold text-maia-ink">{automationRules.length}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Total Rules</p>
        </div>
        <div className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4">
          <p className="font-display text-2xl font-extrabold text-maia-success">{activeCount}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Active</p>
        </div>
        <div className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4">
          <p className="font-display text-2xl font-extrabold text-maia-gold-deep">{totalTriggered}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Total Triggered</p>
        </div>
        <div className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4">
          <p className={`font-display text-2xl font-extrabold ${totalFailed > 0 ? "text-maia-danger" : "text-maia-ink"}`}>{totalFailed}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Failed Actions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {AUTOMATION_CATEGORIES.map((category) => {
          const rules = automationRules.filter((r) => r.category === category);
          if (rules.length === 0) return null;
          const active = rules.filter((r) => r.status === "Active").length;
          const triggered = rules.reduce((sum, r) => sum + r.totalTriggered, 0);
          return (
            <Card key={category} className="cursor-pointer transition-colors hover:border-maia-gold" onClick={() => navigate(`/communications/automation-rules?category=${encodeURIComponent(category)}`)}>
              <CardHeader title={category} subtitle={`${rules.length} rule(s)`} />
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={active > 0 ? "success" : "neutral"}>{active} Active</Badge>
                <Badge tone="neutral">{triggered} Triggered</Badge>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {rules.slice(0, 3).map((r) => (
                  <p key={r.id} className="truncate text-xs text-maia-ink-soft">
                    {r.name} — <span className="font-mono">{r.triggerEvent}</span>
                  </p>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
