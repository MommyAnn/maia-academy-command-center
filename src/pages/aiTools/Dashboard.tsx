import { useMemo } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { useStudentStore } from "@/data/studentStore";

// Spec section 56 — never fabricate token usage/cost when no real provider is
// connected. Every number here is a real, live count over local demo state.

export function Dashboard() {
  const { generations, tools, provider } = useAiToolsStore();
  const { students } = useStudentStore();

  const stats = useMemo(() => {
    const activeUserIds = new Set(generations.map((g) => g.studentId));
    const completed = generations.filter((g) => g.status === "Completed");
    const failed = generations.filter((g) => g.status === "Failed");
    const byTool = new Map<string, number>();
    for (const g of generations) byTool.set(g.toolId, (byTool.get(g.toolId) ?? 0) + 1);
    const byPackage = new Map<string, number>();
    for (const g of generations) {
      const student = students.find((s) => s.id === g.studentId);
      if (student) byPackage.set(student.package, (byPackage.get(student.package) ?? 0) + 1);
    }
    return { activeUsers: activeUserIds.size, completed: completed.length, failed: failed.length, byTool, byPackage };
  }, [generations, students]);

  const topTools = Array.from(stats.byTool.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">AI Business Tools Dashboard</h1>
        <p className="text-sm text-maia-ink-soft">
          Live counts from this demo&rsquo;s local data only — {provider.connectionStatus === "Not Connected" && "no real AI provider is connected, so no token usage or cost figures are shown."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active AI Users", value: stats.activeUsers },
          { label: "Total Generations", value: generations.length },
          { label: "Completed", value: stats.completed },
          { label: "Failed", value: stats.failed },
        ].map((m) => (
          <Card key={m.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{m.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-maia-ink">{m.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Generations By Tool" />
        {topTools.length === 0 ? (
          <p className="py-4 text-sm text-maia-ink-soft">No generations yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topTools.map(([toolId, count]) => {
              const tool = tools.find((t) => t.id === toolId);
              const max = topTools[0][1];
              return (
                <div key={toolId} className="flex items-center gap-3">
                  <p className="w-48 flex-shrink-0 truncate text-sm text-maia-ink">{tool?.name ?? toolId}</p>
                  <div className="h-2 flex-1 rounded-full bg-maia-bg">
                    <div className="h-2 rounded-full bg-maia-gold-deep" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <p className="w-8 flex-shrink-0 text-right text-xs font-semibold text-maia-ink-soft">{count}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Usage By Package" />
        {stats.byPackage.size === 0 ? (
          <p className="py-4 text-sm text-maia-ink-soft">No generations yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from(stats.byPackage.entries()).map(([pkg, count]) => (
              <Badge key={pkg} tone="gold">
                {pkg}: {count}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Provider Errors" subtitle="No real provider is connected in this build, so provider-level errors cannot occur yet." />
        <p className="text-sm text-maia-ink-soft">0 provider errors recorded.</p>
      </Card>
    </div>
  );
}
