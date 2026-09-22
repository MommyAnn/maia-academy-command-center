import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { FLAGGED_CLAIM_PATTERNS } from "@/types/aiTools";

export function Settings() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">AI Business Tools Settings</h1>
        <p className="text-sm text-maia-ink-soft">Reference settings for the AI Business Tools Hub.</p>
      </div>

      <Card>
        <CardHeader
          title="Marketing Claim Safety Patterns"
          subtitle="Fixed safety guardrail — not editable here, since these protect students from unsupported claims regardless of business preference."
        />
        <div className="flex flex-wrap gap-2">
          {FLAGGED_CLAIM_PATTERNS.map((p) => (
            <Badge key={p} tone="danger">
              {p}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Human Review Policy" />
        <p className="text-sm text-maia-ink-soft">
          Every generated output is labeled &ldquo;AI-GENERATED DRAFT&rdquo; and &ldquo;REVIEW BEFORE PUBLISHING&rdquo; —
          especially for advertising, product claims, legal/compliance copy, and health or financial claims. No AI output
          in this build can independently launch an ad, send bulk messages, publish a website, or change a live
          automation.
        </p>
      </Card>

      <Card>
        <CardHeader title="Data Isolation" />
        <p className="text-sm text-maia-ink-soft">
          Every AI request is scoped to a Student ID, Business ID, Master Brain ID/Version, Tool ID, and Project ID.
          Student A can never see Student B&rsquo;s Master Brain, projects, or generated outputs.
        </p>
      </Card>
    </div>
  );
}
