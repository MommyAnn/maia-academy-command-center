import { FileStack } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { QUESTIONNAIRE_VERSION } from "@/types/masterBrain";

export function Templates() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Templates / Versions</h2>
        <p className="text-sm text-maia-ink-soft">Questionnaire version management — architecture prepared for future template variants.</p>
      </div>

      <Card>
        <CardHeader title="Active Questionnaire Version" action={<Badge tone="gold">Current</Badge>} />
        <div className="flex items-center gap-3 rounded-xl bg-maia-bg px-4 py-3.5">
          <FileStack size={18} className="text-maia-gold-deep" />
          <div>
            <p className="text-sm font-semibold text-maia-ink">Questionnaire {QUESTIONNAIRE_VERSION}</p>
            <p className="text-xs text-maia-ink-soft">The 12-step Brand Master Brain questionnaire every new submission uses.</p>
          </div>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-maia-ink-soft">
          Every submission and published document already records the questionnaire/document version it was created
          from (see each submission&rsquo;s Version History and each Brand Master Brain document&rsquo;s Version
          number). Managing multiple active questionnaire templates, editing question sets, and publishing new
          questionnaire versions is prepared for in the data model but not built in this step — the Academy currently
          runs on a single active version.
        </p>
      </Card>
    </div>
  );
}
