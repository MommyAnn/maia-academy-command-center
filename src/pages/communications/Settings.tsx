import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { CONFLICT_AUTHORITY, SYNC_FIELD_DIRECTIONS } from "@/types/communications";
import type { SyncFieldDirection } from "@/types/communications";

/**
 * Integration Settings — the configurable Tag / Field / Workflow mapping
 * tables (spec sections 10, 11, 50). Never a hard-coded business rule:
 * every row here is admin-editable and enable/disable-able. The one thing
 * this page does NOT let anyone edit is CONFLICT_AUTHORITY (spec section
 * 55) — those are fixed safety rules, not a business preference.
 */
export function Settings() {
  const { tagMappings, fieldMappings, workflowMappings, setTagMapping, setFieldMapping, setWorkflowMapping } = useCommunicationsStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Integration Settings</h2>
        <p className="text-sm text-maia-ink-soft">Tag, field, and workflow mapping — configurable, never hard-coded into business logic.</p>
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader title="Tag Mapping" subtitle="Which GHL tag gets applied when a M.A.I.A. event fires." />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Trigger Event</th>
                <th className="px-4 py-3">GHL Tag</th>
                <th className="px-4 py-3">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {tagMappings.map((t) => (
                <tr key={t.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{t.triggerEvent}</td>
                  <td className="px-4 py-2.5">
                    <TextField label="" value={t.tagName} onChange={(e) => setTagMapping(t.id, { tagName: e.target.value })} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-maia-ink-soft">
                      <input type="checkbox" checked={t.enabled} onChange={(e) => setTagMapping(t.id, { enabled: e.target.checked })} className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep" />
                      {t.enabled ? "Enabled" : "Disabled"}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader title="Field Mapping" subtitle="M.A.I.A. field → GHL field, with sync direction." />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">M.A.I.A. Field</th>
                <th className="px-4 py-3">GHL Field</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {fieldMappings.map((f) => (
                <tr key={f.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{f.maiaField}</td>
                  <td className="px-4 py-2.5">
                    <TextField label="" value={f.ghlField} onChange={(e) => setFieldMapping(f.id, { ghlField: e.target.value })} />
                  </td>
                  <td className="px-4 py-2.5 min-w-[180px]">
                    <SelectField label="" value={f.direction} onChange={(e) => setFieldMapping(f.id, { direction: e.target.value as SyncFieldDirection })} options={SYNC_FIELD_DIRECTIONS.map((d) => ({ value: d, label: d }))} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-maia-ink-soft">
                      <input type="checkbox" checked={f.enabled} onChange={(e) => setFieldMapping(f.id, { enabled: e.target.checked })} className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep" />
                      {f.enabled ? "Enabled" : "Disabled"}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader title="Workflow Mapping" subtitle="M.A.I.A. event → GHL Workflow name (never a hard-coded workflow ID)." />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">M.A.I.A. Event</th>
                <th className="px-4 py-3">GHL Workflow</th>
                <th className="px-4 py-3">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {workflowMappings.map((w) => (
                <tr key={w.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{w.triggerEvent}</td>
                  <td className="px-4 py-2.5">
                    <TextField label="" value={w.ghlWorkflowName} onChange={(e) => setWorkflowMapping(w.id, { ghlWorkflowName: e.target.value })} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-maia-ink-soft">
                      <input type="checkbox" checked={w.enabled} onChange={(e) => setWorkflowMapping(w.id, { enabled: e.target.checked })} className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep" />
                      {w.enabled ? "Enabled" : "Disabled"}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sync Authority (fixed — not editable)" subtitle="GHL is never allowed to overwrite these M.A.I.A.-owned records." />
        <div className="flex flex-col gap-2">
          {CONFLICT_AUTHORITY.map((rule) => (
            <div key={rule.domain} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-maia-bg px-3 py-2.5 text-sm">
              <span className="font-medium text-maia-ink">{rule.domain}</span>
              <Badge tone={rule.authority.includes("M.A.I.A. wins") ? "success" : "neutral"}>{rule.authority}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
