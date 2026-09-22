import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import type { AiOutputSection, AiToolOutput } from "@/types/aiTools";

const PROVENANCE_TONE: Record<string, "gold" | "info" | "warning" | "neutral"> = {
  "Master Brain Data": "gold",
  "Student-Provided Data": "info",
  "AI Hypothesis": "warning",
  "AI Recommendation": "warning",
  Assumption: "neutral",
};

function SectionBlock({ section, onEdit }: { section: AiOutputSection; onEdit?: (content: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);

  function copy() {
    const text = section.content || section.items.map((item) => Object.values(item).join(" — ")).join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-xl border border-maia-border p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-maia-ink">{section.title}</p>
          {section.provenance && <Badge tone={PROVENANCE_TONE[section.provenance] ?? "neutral"}>{section.provenance}</Badge>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {onEdit && !section.items.length && (
            <button onClick={() => setEditing((e) => !e)} className="text-[11px] font-semibold text-maia-gold-deep hover:underline">
              {editing ? "Cancel" : "Edit"}
            </button>
          )}
          <button onClick={copy} className="flex items-center gap-1 text-[11px] font-semibold text-maia-ink-soft hover:text-maia-ink">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
          <button
            onClick={() => {
              onEdit?.(draft);
              setEditing(false);
            }}
            className="self-start rounded-lg bg-maia-black px-3 py-1.5 text-xs font-semibold text-maia-gold-soft"
          >
            Save Edit
          </button>
        </div>
      ) : section.content ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-maia-ink">{section.content}</p>
      ) : null}

      {section.items.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-maia-border text-maia-ink-soft">
                {Object.keys(section.items[0]).map((key) => (
                  <th key={key} className="whitespace-nowrap py-1.5 pr-4 font-semibold capitalize">
                    {key.replace(/([A-Z])/g, " $1")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.items.map((item, i) => (
                <tr key={i} className="border-b border-maia-border/60 last:border-0">
                  {Object.values(item).map((value, j) => (
                    <td key={j} className="py-2 pr-4 align-top text-maia-ink">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AiOutputView({ output, onEditSection }: { output: AiToolOutput; onEditSection?: (sectionKey: string, content: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {output.flaggedClaims.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-maia-danger/30 bg-maia-danger-bg px-4 py-3">
          <TriangleAlert size={16} className="mt-0.5 flex-shrink-0 text-maia-danger" />
          <div>
            <p className="text-sm font-semibold text-maia-ink">Review before publishing — unsupported claim(s) detected</p>
            <p className="mt-0.5 text-xs text-maia-ink-soft">
              Flagged phrases: {output.flaggedClaims.map((c) => `"${c}"`).join(", ")}. Remove or verify before using this
              publicly.
            </p>
          </div>
        </div>
      )}
      <div className="rounded-lg bg-maia-gold-bg px-3.5 py-2 text-[11px] font-semibold text-maia-gold-deep">
        AI-GENERATED DRAFT (SIMULATED) — REVIEW BEFORE PUBLISHING
      </div>
      {output.sections.map((s) => (
        <SectionBlock key={s.key} section={s} onEdit={onEditSection ? (content) => onEditSection(s.key, content) : undefined} />
      ))}
    </div>
  );
}
