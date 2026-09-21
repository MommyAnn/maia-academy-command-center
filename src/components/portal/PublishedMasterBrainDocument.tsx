import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { buildAiBrandContext } from "@/utils/masterBrain";
import type { MasterBrainDocument } from "@/types/masterBrain";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PublishedMasterBrainDocument({ document: doc, businessName }: { document: MasterBrainDocument; businessName: string }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  async function handleCopyAll() {
    const ok = await copyText(buildAiBrandContext(doc.sections));
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  }

  async function handleCopySection(key: string, content: string, bullets: string[]) {
    const text = [content, ...bullets.map((b) => `- ${b}`)].filter(Boolean).join("\n");
    const ok = await copyText(text);
    if (ok) {
      setCopiedSection(key);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="no-print border-maia-gold/40 bg-maia-gold-bg/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-base font-bold text-maia-ink">{businessName || "Your Brand Master Brain"}</p>
            <p className="text-xs text-maia-ink-soft">
              Version {doc.documentVersion} &middot; Published{" "}
              {doc.publishedAt ? new Date(doc.publishedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopyAll}>
              {copiedAll ? <Check size={13} /> : <Copy size={13} />}
              {copiedAll ? "COPIED" : "COPY MY AI BRAND CONTEXT"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={13} />
              PRINT
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-maia-ink-soft/70">
          A downloadable export file isn&rsquo;t generated yet — Print/Save as PDF from your browser works today.
        </p>
      </Card>

      {/* Table of contents */}
      <Card className="no-print">
        <CardHeader title="Table of Contents" />
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {doc.sections.map((s) => (
            <a key={s.key} href={`#mb-${s.key}`} className="text-sm text-maia-gold-deep hover:text-maia-ink hover:underline">
              {s.title}
            </a>
          ))}
        </div>
      </Card>

      {doc.sections.map((s) => (
        <Card key={s.key} id={`mb-${s.key}`}>
          <CardHeader
            title={s.title}
            action={
              <Button variant="secondary" size="sm" className="no-print" onClick={() => handleCopySection(s.key, s.content, s.bullets)}>
                {copiedSection === s.key ? <Check size={13} /> : <Copy size={13} />}
                {copiedSection === s.key ? "COPIED" : "COPY SECTION"}
              </Button>
            }
          />
          {s.content && <p className="whitespace-pre-line text-sm leading-relaxed text-maia-ink">{s.content}</p>}
          {s.bullets.length > 0 && (
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-maia-ink-soft">
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
