import { useNavigate } from "react-router-dom";
import { BrainCircuit, CircleAlert, CircleCheck } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { formatDateTime } from "@/utils/students";
import type { AiBusinessContext } from "@/types/aiTools";

// Spec section 4 — this is the single UI surface that answers "is my Brand
// Master Brain ready to power the AI tools?", reused on the Hub and inside
// the Tool Runner's collapsible context panel. Never duplicated wording.

export function MasterBrainConnectionCard({ ctx, compact = false }: { ctx: AiBusinessContext | null; compact?: boolean }) {
  const navigate = useNavigate();

  if (ctx?.masterBrainPublished) {
    return (
      <Card className={compact ? "border-maia-success/30 bg-maia-success-bg/40" : "border-maia-success/30 bg-maia-success-bg/40"} padded={!compact}>
        <div className={compact ? "flex items-start gap-3 p-4" : "flex items-start gap-3"}>
          <CircleCheck size={20} className="mt-0.5 flex-shrink-0 text-maia-success" />
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-maia-ink">✓ BRAND MASTER BRAIN CONNECTED</p>
            <p className="mt-1 text-xs text-maia-ink-soft">
              Business: <span className="font-semibold text-maia-ink">{ctx.businessName}</span> · Version{" "}
              <span className="font-semibold text-maia-ink">v{ctx.masterBrainVersion}</span>
              {ctx.masterBrainLastUpdated && <> · Last updated {formatDateTime(ctx.masterBrainLastUpdated)}</>}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-maia-warning/30 bg-maia-warning-bg/40" padded={!compact}>
      <div className={compact ? "flex flex-col gap-3 p-4" : "flex flex-col gap-3"}>
        <div className="flex items-start gap-3">
          <CircleAlert size={20} className="mt-0.5 flex-shrink-0 text-maia-warning" />
          <div>
            <p className="font-display text-sm font-bold text-maia-ink">YOUR BRAND MASTER BRAIN IS NOT READY YET</p>
            <p className="mt-1 text-xs text-maia-ink-soft">
              Complete your Business Assessment so M.A.I.A.&rsquo;s AI Business Tools can understand your business,
              customers, offers, and voice — no need to re-explain anything once it&rsquo;s published.
            </p>
          </div>
        </div>
        <Button size="sm" className="self-start" onClick={() => navigate("/portal/master-brain")}>
          <BrainCircuit size={14} />
          COMPLETE MY MASTER BRAIN
        </Button>
      </div>
    </Card>
  );
}
