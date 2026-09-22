import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { useStudentStore } from "@/data/studentStore";
import type { AiToolId } from "@/types/aiTools";
import type { PackageType } from "@/types/student";
import { formatDateTime } from "@/utils/students";

const PACKAGES: PackageType[] = ["Premium", "VIP", "Dual VIP"];

export function ToolAccess() {
  const { tools, packageAccess, manualGrants, setPackageAccess, addManualGrant, removeManualGrant } = useAiToolsStore();
  const { students } = useStudentStore();
  const [grantStudent, setGrantStudent] = useState("");
  const [grantTool, setGrantTool] = useState("");
  const [grantReason, setGrantReason] = useState("");

  function toggle(pkg: PackageType, toolId: AiToolId) {
    const current = packageAccess[pkg] ?? [];
    const next = current.includes(toolId) ? current.filter((t) => t !== toolId) : [...current, toolId];
    setPackageAccess(pkg, next);
  }

  function handleAddGrant() {
    if (!grantStudent || !grantTool) return;
    addManualGrant(grantStudent, grantTool as AiToolId, grantReason || "Manually granted by admin");
    setGrantStudent("");
    setGrantTool("");
    setGrantReason("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">AI Tool Access Matrix</h1>
        <p className="text-sm text-maia-ink-soft">Which package includes which tools — fully editable, never a permanent hard-coded rule.</p>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-maia-border">
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-maia-ink-soft sm:px-6">Tool</th>
                {PACKAGES.map((pkg) => (
                  <th key={pkg} className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-maia-ink-soft">
                    {pkg}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="px-5 py-2.5 text-maia-ink sm:px-6">{tool.name}</td>
                  {PACKAGES.map((pkg) => (
                    <td key={pkg} className="px-3 py-2.5 text-center">
                      <input type="checkbox" checked={(packageAccess[pkg] ?? []).includes(tool.id)} onChange={() => toggle(pkg, tool.id)} className="h-4 w-4 accent-maia-gold-deep" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Manual Per-Student Grants" subtitle="Overrides the package matrix for an individual student." />
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField label="Student" value={grantStudent} onChange={(e) => setGrantStudent(e.target.value)} placeholder="Select a student" options={students.map((s) => ({ value: s.id, label: s.fullName }))} />
          <SelectField label="Tool" value={grantTool} onChange={(e) => setGrantTool(e.target.value)} placeholder="Select a tool" options={tools.map((t) => ({ value: t.id, label: t.name }))} />
          <TextField label="Reason" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} placeholder="e.g. Bonus for early enrollment" />
        </div>
        <Button size="sm" onClick={handleAddGrant} disabled={!grantStudent || !grantTool}>
          Add Grant
        </Button>

        <div className="mt-4 flex flex-col gap-2">
          {manualGrants.length === 0 && <p className="text-sm text-maia-ink-soft">No manual grants yet.</p>}
          {manualGrants.map((g) => {
            const student = students.find((s) => s.id === g.studentId);
            const tool = tools.find((t) => t.id === g.toolId);
            return (
              <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-maia-border px-4 py-2.5">
                <div>
                  <p className="text-sm text-maia-ink">
                    <span className="font-semibold">{student?.fullName ?? g.studentId}</span> → {tool?.name ?? g.toolId}
                  </p>
                  <p className="text-xs text-maia-ink-soft">
                    {g.reason} · Granted by {g.grantedBy} on {formatDateTime(g.grantedAt)}
                  </p>
                </div>
                <button onClick={() => removeManualGrant(g.id)} className="text-maia-ink-soft hover:text-maia-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
