import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { formatDateTime } from "@/utils/students";

export function Connections() {
  const { provider, tools, setProviderConfig } = useAiToolsStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">AI Connections</h1>
        <p className="text-sm text-maia-ink-soft">Provider-agnostic by design — no API keys ever live in this frontend.</p>
      </div>

      <Card>
        <CardHeader
          title={provider.name}
          action={<Badge tone={provider.connectionStatus === "Connected" ? "success" : provider.connectionStatus === "Error" ? "danger" : "warning"}>{provider.connectionStatus}</Badge>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Selected Model" value={provider.selectedModel} onChange={(e) => setProviderConfig({ selectedModel: e.target.value })} />
          <div>
            <p className="mb-1.5 block text-sm font-semibold text-maia-ink">Status</p>
            <div className="flex gap-2">
              <Button size="sm" variant={provider.status === "Active" ? "primary" : "secondary"} onClick={() => setProviderConfig({ status: "Active" })}>
                Active
              </Button>
              <Button size="sm" variant={provider.status === "Inactive" ? "primary" : "secondary"} onClick={() => setProviderConfig({ status: "Inactive" })}>
                Inactive
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-maia-ink-soft">
          Last health check: {provider.lastHealthCheck ? formatDateTime(provider.lastHealthCheck) : "Never"}. No real API key field exists here — production
          credentials must live server-side only.
        </p>
      </Card>

      <Card>
        <CardHeader title="Tools Using This Provider" subtitle="All 18 tools default to this provider until reassigned." />
        <div className="flex flex-wrap gap-2">
          {tools.map((t) => (
            <Badge key={t.id} tone="neutral">
              {t.name}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
