import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, List } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { useWebinarStore } from "@/data/webinarStore";
import { PIPELINE_COLUMNS } from "@/types/webinar";
import type { Lead, LeadStatus } from "@/types/webinar";
import { pipelineStageTone } from "@/utils/webinar";

function LeadCard({ lead, onMove, onOpen }: { lead: Lead; onMove: (status: LeadStatus) => void; onOpen: () => void }) {
  const { sessions } = useWebinarStore();
  const latestSession = sessions.find((s) => s.id === lead.latestWebinarSessionId);

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
      onClick={onOpen}
      className="cursor-pointer rounded-xl border border-maia-border bg-maia-surface p-3.5 shadow-sm transition-colors hover:border-maia-gold"
    >
      <p className="text-sm font-semibold text-maia-ink">{lead.fullName}</p>
      <p className="text-xs text-maia-ink-soft">{lead.facebookName}</p>
      <p className="mt-1.5 text-xs text-maia-ink-soft">{latestSession?.title ?? "—"}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        <Badge tone="gold">{lead.leadSource}</Badge>
        {lead.assignedStaffName && <Badge tone="neutral">{lead.assignedStaffName}</Badge>}
      </div>
      {lead.nextFollowUpDate && <p className="mt-1.5 text-[11px] text-maia-ink-soft">Next follow-up: {lead.nextFollowUpDate}</p>}
      <select
        value={lead.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onMove(e.target.value as LeadStatus)}
        className="mt-2 w-full rounded-lg border border-maia-border bg-maia-bg px-2 py-1.5 text-xs text-maia-ink outline-none"
      >
        {PIPELINE_COLUMNS.map((s) => (
          <option key={s} value={s}>
            Move to: {s}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Pipeline() {
  const { leads, setLeadStatus } = useWebinarStore();
  const navigate = useNavigate();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");

  const filteredLeads = leads.filter((l) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return l.fullName.toLowerCase().includes(q) || l.facebookName.toLowerCase().includes(q) || l.leadId.toLowerCase().includes(q);
  });

  function handleDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/lead-id");
    if (leadId) setLeadStatus(leadId, status);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Leads / Pipeline</h2>
          <p className="text-sm text-maia-ink-soft">{filteredLeads.length} lead(s).</p>
        </div>
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or Lead ID..." />
          <Button variant="secondary" onClick={() => setView(view === "kanban" ? "table" : "kanban")}>
            {view === "kanban" ? <List size={14} /> : <LayoutGrid size={14} />}
            {view === "kanban" ? "TABLE VIEW" : "KANBAN VIEW"}
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PIPELINE_COLUMNS.map((column) => {
            const columnLeads = filteredLeads.filter((l) => l.status === column);
            return (
              <div
                key={column}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, column)}
                className="flex w-72 flex-shrink-0 flex-col gap-2 rounded-2xl bg-maia-bg p-3"
              >
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-maia-ink-soft">{column}</p>
                  <Badge tone={pipelineStageTone(column)}>{columnLeads.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {columnLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onMove={(status) => setLeadStatus(lead.id, status)} onOpen={() => navigate(`/webinar/leads/${lead.id}`)} />
                  ))}
                  {columnLeads.length === 0 && <p className="rounded-lg border border-dashed border-maia-border px-3 py-6 text-center text-xs text-maia-ink-soft">No leads</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Lead ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{lead.leadId}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{lead.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lead.leadSource}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={pipelineStageTone(lead.status)}>{lead.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lead.assignedStaffName ?? "Unassigned"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lead.nextFollowUpDate ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button size="sm" onClick={() => navigate(`/webinar/leads/${lead.id}`)}>
                        VIEW
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
