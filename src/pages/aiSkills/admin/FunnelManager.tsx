import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { CourseCover, SKILL_ICONS } from "@/components/aiSkills/FunnelUi";
import { useAiSkillsStore } from "@/data/aiSkillsStore";
import { AI_SKILLS_CATALOG_URL, AI_SKILLS_TAGS } from "@/data/aiSkillsConfig";
import type { AiMasterclass, AiSkillIcon, AiSkillsCatalog } from "@/types/aiSkills";
import {
  ALL_ACCESS_KEY,
  bundleMasterclasses,
  formatPeso,
  getSetupIssues,
  isHttpUrl,
  normalizeCatalog,
  slugify,
  sortedMasterclasses,
  tagFromTitle,
} from "@/utils/aiSkills";

// ---------------------------------------------------------------------------
// M.A.I.A. AI SKILLS ACADEMY — FUNNEL MANAGER (admin)
// ---------------------------------------------------------------------------
// Edits the DRAFT catalog (this browser only). Publishing = export the JSON
// and replace the published catalog file — see AI_SKILLS_FUNNEL_SETUP.md.
// ---------------------------------------------------------------------------

type TabKey = "courses" | "bundle" | "checkout" | "ghl" | "publish";

const ICON_OPTIONS = (Object.keys(SKILL_ICONS) as AiSkillIcon[]).map((k) => ({ value: k, label: k.replace(/-/g, " ") }));

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-maia-ink">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || "Enabled"}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-maia-gold" : "bg-maia-border"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-maia-bg px-2 py-1 text-xs text-maia-ink">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="shrink-0 rounded-md p-1 text-maia-ink-soft hover:bg-maia-bg hover:text-maia-gold-deep"
        aria-label="Copy"
      >
        {copied ? <span className="text-xs font-semibold text-maia-success">Copied</span> : <Copy size={14} />}
      </button>
    </span>
  );
}

function UrlStatus({ url, missing = "Not set" }: { url: string; missing?: string }) {
  const value: string = url.trim();
  if (isHttpUrl(value)) return <Badge tone="success">Connected</Badge>;
  if (value) return <Badge tone="danger">Invalid URL</Badge>;
  return <Badge tone="warning">{missing}</Badge>;
}

function blankCourse(nextOrder: number): AiMasterclass {
  return {
    id: `mc-${Date.now().toString(36)}`,
    slug: "",
    title: "",
    shortTitle: "",
    description: "",
    learnPoints: [],
    modules: [],
    coverImageUrl: "",
    icon: "video",
    price: 499,
    ghlCheckoutUrl: "",
    ghlProductRef: "",
    ghlTag: "",
    accessUrl: "",
    includedInBundle: true,
    enabled: false,
    sortOrder: nextOrder,
  };
}

function CourseEditor({
  initial,
  isNew,
  existingSlugs,
  onCancel,
  onSave,
}: {
  initial: AiMasterclass;
  isNew: boolean;
  existingSlugs: string[];
  onCancel: () => void;
  onSave: (c: AiMasterclass) => void;
}) {
  const [c, setC] = useState(initial);
  const [learnText, setLearnText] = useState(initial.learnPoints.join("\n"));
  const [modulesText, setModulesText] = useState(initial.modules.join("\n"));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [tagTouched, setTagTouched] = useState(!isNew);
  const [error, setError] = useState("");

  function setTitle(title: string) {
    setC((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
      ghlTag: tagTouched ? prev.ghlTag : tagFromTitle(title),
    }));
  }

  function save() {
    const slug = slugify(c.slug || c.title);
    if (!c.title.trim()) return setError("Title is required.");
    if (!slug) return setError("URL slug is required.");
    if (slug === ALL_ACCESS_KEY || existingSlugs.includes(slug)) return setError("That URL slug is already used.");
    if (!(c.price > 0)) return setError("Price must be greater than zero.");
    for (const [label, url] of [["Checkout URL", c.ghlCheckoutUrl], ["Access URL", c.accessUrl], ["Cover image URL", c.coverImageUrl]] as const) {
      if (url.trim() && !isHttpUrl(url.trim())) return setError(`${label} must start with https://`);
    }
    onSave({
      ...c,
      slug,
      title: c.title.trim(),
      shortTitle: c.shortTitle.trim() || c.title.trim(),
      ghlCheckoutUrl: c.ghlCheckoutUrl.trim(),
      accessUrl: c.accessUrl.trim(),
      coverImageUrl: c.coverImageUrl.trim(),
      ghlTag: c.ghlTag.trim().toUpperCase(),
      learnPoints: learnText.split("\n").map((s) => s.trim()).filter(Boolean),
      modules: modulesText.split("\n").map((s) => s.trim()).filter(Boolean),
    });
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onCancel}
      title={isNew ? "Add AI Masterclass" : `Edit — ${initial.shortTitle}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-maia-danger">{error}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={save}>{isNew ? "Add masterclass" : "Save changes"}</Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4">
        <TextField label="Course title" required value={c.title} onChange={(e) => setTitle(e.target.value)} placeholder="AI Product Video Masterclass" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Short title (bundle checklist)" value={c.shortTitle} onChange={(e) => setC({ ...c, shortTitle: e.target.value })} placeholder="AI Product Video" />
          <TextField
            label="URL slug"
            required
            value={c.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setC({ ...c, slug: e.target.value });
            }}
            hint={`/ai-skills/masterclass/${slugify(c.slug || c.title) || "…"}`}
          />
        </div>
        <TextAreaField label="Short description" rows={2} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
        <TextAreaField label="What you will learn (one per line)" rows={4} value={learnText} onChange={(e) => setLearnText(e.target.value)} />
        <TextAreaField label="Course content / modules (one per line)" rows={5} value={modulesText} onChange={(e) => setModulesText(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <TextField label="Cover image URL" value={c.coverImageUrl} onChange={(e) => setC({ ...c, coverImageUrl: e.target.value })} placeholder="https://… (leave blank for branded cover)" hint="16:10 image recommended. Host it in GHL Media Storage or your website." />
          <div className="w-40">
            <p className="mb-1.5 text-sm font-semibold text-maia-ink">Preview</p>
            <CourseCover course={{ ...c, shortTitle: c.shortTitle || c.title || "New masterclass" }} className="aspect-[16/10] rounded-lg" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Cover icon" options={ICON_OPTIONS} value={c.icon} onChange={(e) => setC({ ...c, icon: e.target.value as AiSkillIcon })} />
          <TextField label="Display price (₱)" type="number" min={1} value={String(c.price)} onChange={(e) => setC({ ...c, price: Number(e.target.value) })} hint="Must match the GHL product price — GHL charges its own price." />
        </div>
        <div className="rounded-xl border border-maia-border bg-maia-bg p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-maia-gold-deep">GoHighLevel connection</p>
          <div className="grid gap-4">
            <TextField label="GHL checkout / order form URL" value={c.ghlCheckoutUrl} onChange={(e) => setC({ ...c, ghlCheckoutUrl: e.target.value })} placeholder="https://your-domain.com/ai-photography-checkout" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="GHL product reference (optional)" value={c.ghlProductRef} onChange={(e) => setC({ ...c, ghlProductRef: e.target.value })} hint="For your records only." />
              <TextField
                label="Course CRM tag"
                value={c.ghlTag}
                onChange={(e) => {
                  setTagTouched(true);
                  setC({ ...c, ghlTag: e.target.value });
                }}
              />
            </div>
            <TextField label="Course access URL (GHL course / offer)" value={c.accessUrl} onChange={(e) => setC({ ...c, accessUrl: e.target.value })} placeholder="https://… (blank = member portal URL)" />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={c.enabled} onChange={(v) => setC({ ...c, enabled: v })} label="Enabled (visible & purchasable)" />
          <Toggle checked={c.includedInBundle} onChange={(v) => setC({ ...c, includedInBundle: v })} label="Included in All-Access" />
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="grid gap-4">{children}</div>
    </Card>
  );
}

export function FunnelManager() {
  const { draft, published, hasSavedDraft, updateDraft, replaceDraft, discardDraft, loadError, setPreviewingDraft } = useAiSkillsStore();
  const [tab, setTab] = useState<TabKey>("courses");
  const [editing, setEditing] = useState<{ course: AiMasterclass; isNew: boolean } | null>(null);
  const [deleting, setDeleting] = useState<AiMasterclass | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const courses = sortedMasterclasses(draft);
  const issues = getSetupIssues(draft);
  const blocking = issues.filter((i) => i.severity === "blocking");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const draftDiffers = hasSavedDraft && JSON.stringify({ ...draft, updatedAt: "" }) !== JSON.stringify({ ...published, updatedAt: "" });

  const set = (fn: (c: AiSkillsCatalog) => AiSkillsCatalog) => updateDraft(fn);
  const setBundle = (patch: Partial<AiSkillsCatalog["bundle"]>) => set((c) => ({ ...c, bundle: { ...c.bundle, ...patch } }));
  const setSettings = (patch: Partial<AiSkillsCatalog["settings"]>) => set((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  const setPrefill = (patch: Partial<AiSkillsCatalog["settings"]["prefillParams"]>) =>
    set((c) => ({ ...c, settings: { ...c.settings, prefillParams: { ...c.settings.prefillParams, ...patch } } }));

  function saveCourse(course: AiMasterclass) {
    set((c) => {
      const exists = c.masterclasses.some((m) => m.id === course.id);
      return { ...c, masterclasses: exists ? c.masterclasses.map((m) => (m.id === course.id ? course : m)) : [...c.masterclasses, course] };
    });
    setEditing(null);
  }

  function patchCourse(id: string, patch: Partial<AiMasterclass>) {
    set((c) => ({ ...c, masterclasses: c.masterclasses.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }

  function move(id: string, dir: -1 | 1) {
    const list = sortedMasterclasses(draft);
    const idx = list.findIndex((m) => m.id === id);
    const swap = list[idx + dir];
    if (!swap) return;
    const reordered = [...list];
    [reordered[idx], reordered[idx + dir]] = [swap, list[idx]];
    set((c) => ({ ...c, masterclasses: reordered.map((m, i) => ({ ...m, sortOrder: i + 1 })) }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...draft, version: draft.version }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ai-skills-catalog.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file: File) {
    file
      .text()
      .then((text) => {
        const parsed = normalizeCatalog(JSON.parse(text));
        replaceDraft(parsed);
        setImportMsg(`Imported ${parsed.masterclasses.length} masterclasses into your draft.`);
      })
      .catch(() => setImportMsg("That file is not a valid catalog JSON."));
  }

  function openPreview(path: string) {
    window.open(`${path}${path.includes("?") ? "&" : "?"}preview=draft`, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">M.A.I.A. AI Skills Academy™</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink">Sales Funnel Manager</h1>
          <p className="mt-1 max-w-2xl text-sm text-maia-ink-soft">
            Add, edit, reprice, enable or disable AI Masterclasses and connect each product to GoHighLevel — without
            redesigning the funnel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/ai-skills" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary"><ExternalLink size={16} /> Live sales page</Button>
          </a>
          <Button variant="secondary" onClick={() => openPreview("/ai-skills")} disabled={!hasSavedDraft}>
            <Eye size={16} /> Preview draft
          </Button>
          <Button onClick={() => setTab("publish")}><Download size={16} /> Publish…</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-maia-ink-soft">Draft status</p>
          <p className="mt-1 font-display text-lg font-bold text-maia-ink">{draftDiffers ? "Unpublished changes" : "Matches published"}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-maia-ink-soft">Masterclasses</p>
          <p className="mt-1 font-display text-lg font-bold text-maia-ink">
            {courses.filter((c) => c.enabled).length} live · {bundleMasterclasses(draft).length} in All-Access
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-maia-ink-soft">Checkout readiness</p>
          <p className={`mt-1 font-display text-lg font-bold ${blocking.length ? "text-maia-warning" : "text-maia-success"}`}>
            {blocking.length ? `${blocking.length} connection${blocking.length > 1 ? "s" : ""} missing` : "All checkouts connected"}
          </p>
        </Card>
      </div>

      {loadError && (
        <div className="flex gap-3 rounded-xl border border-maia-warning/40 bg-maia-warning-bg p-4 text-sm text-maia-ink">
          <TriangleAlert className="shrink-0 text-maia-warning" size={18} />
          Could not load the published catalog from <code>{AI_SKILLS_CATALOG_URL}</code> ({loadError}). The live page is
          using the catalog built into the app.
        </div>
      )}

      <Tabs
        tabs={[
          { value: "courses", label: "Masterclasses" },
          { value: "bundle", label: "All-Access Bundle" },
          { value: "checkout", label: "Checkout & Access" },
          { value: "ghl", label: "GHL Setup & Tags" },
          { value: "publish", label: "Publish" },
        ]}
        active={tab}
        onChange={(v) => setTab(v as TabKey)}
      />

      {tab === "courses" && (
        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-maia-border p-5">
            <div>
              <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-maia-ink">AI Masterclass Library</h3>
              <p className="mt-1 text-sm text-maia-ink-soft">Order here = order on the sales page. Disabled courses are hidden and can’t be bought.</p>
            </div>
            <Button onClick={() => setEditing({ course: blankCourse(courses.length + 1), isNew: true })}>
              <Plus size={16} /> Add course
            </Button>
          </div>
          <ul className="divide-y divide-maia-border">
            {courses.map((c, i) => (
              <li key={c.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <CourseCover course={c} className="h-14 w-20 shrink-0 rounded-lg" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-maia-ink">{c.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-maia-ink-soft">
                      <span className="font-semibold text-maia-ink">{formatPeso(c.price)}</span>
                      {c.enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>}
                      {c.includedInBundle && <Badge tone="gold">All-Access</Badge>}
                      <span className="flex items-center gap-1">Checkout: <UrlStatus url={c.ghlCheckoutUrl} /></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Toggle checked={c.enabled} onChange={(v) => patchCourse(c.id, { enabled: v })} label="" />
                  <button onClick={() => move(c.id, -1)} disabled={i === 0} className="rounded-lg p-2 text-maia-ink-soft hover:bg-maia-bg disabled:opacity-30" aria-label="Move up"><ArrowUp size={16} /></button>
                  <button onClick={() => move(c.id, 1)} disabled={i === courses.length - 1} className="rounded-lg p-2 text-maia-ink-soft hover:bg-maia-bg disabled:opacity-30" aria-label="Move down"><ArrowDown size={16} /></button>
                  <button onClick={() => setEditing({ course: c, isNew: false })} className="rounded-lg p-2 text-maia-ink-soft hover:bg-maia-bg hover:text-maia-gold-deep" aria-label="Edit"><Pencil size={16} /></button>
                  <button onClick={() => setDeleting(c)} className="rounded-lg p-2 text-maia-ink-soft hover:bg-maia-danger-bg hover:text-maia-danger" aria-label="Delete"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
            {courses.length === 0 && <li className="p-8 text-center text-sm text-maia-ink-soft">No masterclasses yet — add your first one.</li>}
          </ul>
        </Card>
      )}

      {tab === "bundle" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="M.A.I.A. AI Skills All-Access Bundle" subtitle="Included courses = every enabled masterclass marked “Included in All-Access”.">
            <TextField label="Bundle name" value={draft.bundle.name} onChange={(e) => setBundle({ name: e.target.value })} />
            <TextField label="Regular price (₱)" type="number" min={1} value={String(draft.bundle.regularPrice)} onChange={(e) => setBundle({ regularPrice: Number(e.target.value) || 0 })} hint="Shown publicly. Must match the GHL product price." />
            <TextField label="GHL checkout / order form URL" value={draft.bundle.ghlCheckoutUrl} onChange={(e) => setBundle({ ghlCheckoutUrl: e.target.value.trim() })} placeholder="https://…" hint="Enable the coupon field on this order form so buyers can apply promo codes." />
            <TextField label="GHL product reference (optional)" value={draft.bundle.ghlProductRef} onChange={(e) => setBundle({ ghlProductRef: e.target.value })} />
            <TextField label="Extra included line (optional)" value={draft.bundle.extraIncludedNote} onChange={(e) => setBundle({ extraIncludedNote: e.target.value })} placeholder="e.g. Bonus: AI prompt library" hint="Only add items that are really part of the bundle." />
          </Section>
          <Section title="Public campaign banner" subtitle="OFF by default. Discounted prices are never shown publicly unless you turn this on.">
            <Toggle checked={draft.bundle.campaign.enabled} onChange={(v) => setBundle({ campaign: { ...draft.bundle.campaign, enabled: v } })} label="Show campaign banner on the All-Access section" />
            <TextField label="Banner label" value={draft.bundle.campaign.label} onChange={(e) => setBundle({ campaign: { ...draft.bundle.campaign, label: e.target.value } })} placeholder="WEBINAR SPECIAL" />
            <TextAreaField label="Banner message" rows={3} value={draft.bundle.campaign.message} onChange={(e) => setBundle({ campaign: { ...draft.bundle.campaign, message: e.target.value } })} placeholder="Attended the webinar? Use the code shared during the session at checkout." />
            <div className="rounded-xl bg-maia-bg p-4 text-sm">
              <p className="font-semibold text-maia-ink">Currently included ({bundleMasterclasses(draft).length})</p>
              <p className="mt-1 text-maia-ink-soft">{bundleMasterclasses(draft).map((c) => c.shortTitle).join(" · ") || "None"}</p>
            </div>
          </Section>
        </div>
      )}

      {tab === "checkout" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Checkout behaviour">
            <SelectField
              label="Checkout mode"
              value={draft.settings.checkoutMode}
              onChange={(e) => setSettings({ checkoutMode: e.target.value === "embed" ? "embed" : "redirect" })}
              options={[
                { value: "redirect", label: "Redirect to GHL order form (recommended)" },
                { value: "embed", label: "Embed GHL order form inside our checkout page" },
              ]}
            />
            <Toggle checked={draft.settings.requireFacebookName} onChange={(v) => setSettings({ requireFacebookName: v })} label="Require Facebook name at checkout" />
            <p className="text-xs text-maia-ink-soft">
              Pre-fill: our checkout passes the buyer’s details to the GHL order form as URL parameters. Enter the field
              keys your GHL form uses (blank = don’t pass). Test once and confirm the fields pre-fill.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Full name param" value={draft.settings.prefillParams.fullName} onChange={(e) => setPrefill({ fullName: e.target.value })} />
              <TextField label="Email param" value={draft.settings.prefillParams.email} onChange={(e) => setPrefill({ email: e.target.value })} />
              <TextField label="Phone param" value={draft.settings.prefillParams.phone} onChange={(e) => setPrefill({ phone: e.target.value })} />
              <TextField label="Facebook name param" value={draft.settings.prefillParams.facebookName} onChange={(e) => setPrefill({ facebookName: e.target.value })} placeholder="custom field key" />
            </div>
            <TextField label="Promo code param (only if your GHL checkout supports it)" value={draft.settings.prefillParams.promoCode} onChange={(e) => setPrefill({ promoCode: e.target.value })} hint="Blank = buyers type their code into the GHL coupon field (always works)." />
          </Section>
          <Section title="Access, upsell & support">
            <TextField label="Member portal / AI Skills dashboard URL" value={draft.settings.memberPortalUrl} onChange={(e) => setSettings({ memberPortalUrl: e.target.value.trim() })} placeholder="https://… GHL Client Portal / Memberships login" />
            <TextField label="All-Access upgrade checkout URL (optional)" value={draft.settings.upgradeCheckoutUrl} onChange={(e) => setSettings({ upgradeCheckoutUrl: e.target.value.trim() })} hint="Shown to single-course buyers after purchase. Blank = no upsell. Buyers must complete this checkout themselves — nothing is charged automatically." />
            <TextField label="Upgrade offer note (optional)" value={draft.settings.upgradeOfferNote} onChange={(e) => setSettings({ upgradeOfferNote: e.target.value })} placeholder="Your upgrade price is shown on the next page." />
            <TextField label="Support / Messenger link" value={draft.settings.supportUrl} onChange={(e) => setSettings({ supportUrl: e.target.value.trim() })} placeholder="https://m.me/yourpage" />
            <TextField label="Support button label" value={draft.settings.supportLabel} onChange={(e) => setSettings({ supportLabel: e.target.value })} />
            <TextField label="GHL Inbound Webhook URL for checkout leads (optional)" value={draft.settings.leadWebhookUrl} onChange={(e) => setSettings({ leadWebhookUrl: e.target.value.trim() })} hint="Sends name/email/phone/product when a buyer continues to payment, so a workflow can follow up on unfinished checkouts. Blank = nothing is sent." />
          </Section>
        </div>
      )}

      {tab === "ghl" && (
        <div className="space-y-6">
          <Section title="Setup checklist" subtitle="What still needs to be connected in GoHighLevel before the funnel can take payments.">
            {issues.length === 0 ? (
              <p className="text-sm font-semibold text-maia-success">Everything is connected.</p>
            ) : (
              <ul className="space-y-2">
                {issues.map((i, n) => (
                  <li key={n} className="flex gap-3 text-sm">
                    <Badge tone={i.severity === "blocking" ? "danger" : "warning"}>{i.severity === "blocking" ? "Required" : "Recommended"}</Badge>
                    <span><strong className="text-maia-ink">{i.area}:</strong> <span className="text-maia-ink-soft">{i.message}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Card padded={false}>
            <div className="border-b border-maia-border p-5">
              <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-maia-ink">Per-product GHL configuration</h3>
              <p className="mt-1 text-sm text-maia-ink-soft">
                In each GHL order form: set the <strong>thank-you / redirect URL</strong> below, and in the product’s
                purchase workflow apply these <strong>tags</strong> and grant <strong>only</strong> the listed course access.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-maia-bg text-xs uppercase tracking-wider text-maia-ink-soft">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Thank-you URL (paste into GHL)</th>
                    <th className="px-4 py-3">Tags to apply on purchase</th>
                    <th className="px-4 py-3">Course access to grant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-maia-border">
                  {courses.filter((c) => c.enabled).map((c) => (
                    <tr key={c.id} className="align-top">
                      <td className="px-4 py-3 font-semibold text-maia-ink">{c.title}<div className="mt-1 font-normal text-maia-ink-soft">{formatPeso(c.price)}</div></td>
                      <td className="max-w-[260px] px-4 py-3"><CopyValue value={`${origin}/ai-skills/thank-you?product=${c.slug}`} /></td>
                      <td className="px-4 py-3 text-xs"><div className="flex flex-wrap gap-1">{[AI_SKILLS_TAGS.customer, AI_SKILLS_TAGS.single, c.ghlTag].filter(Boolean).map((t) => <Badge key={t}>{t}</Badge>)}</div></td>
                      <td className="px-4 py-3 text-maia-ink-soft">This masterclass only</td>
                    </tr>
                  ))}
                  <tr className="align-top bg-maia-gold-bg/40">
                    <td className="px-4 py-3 font-semibold text-maia-ink">{draft.bundle.name}<div className="mt-1 font-normal text-maia-ink-soft">{formatPeso(draft.bundle.regularPrice)} regular</div></td>
                    <td className="max-w-[260px] px-4 py-3"><CopyValue value={`${origin}/ai-skills/thank-you?product=${ALL_ACCESS_KEY}`} /></td>
                    <td className="px-4 py-3 text-xs"><div className="flex flex-wrap gap-1">{[AI_SKILLS_TAGS.customer, AI_SKILLS_TAGS.allAccess].map((t) => <Badge key={t}>{t}</Badge>)}</div></td>
                    <td className="px-4 py-3 text-maia-ink-soft">{bundleMasterclasses(draft).map((c) => c.shortTitle).join(", ")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Section title="Recommended GHL workflows">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-maia-ink-soft">
              <li><strong className="text-maia-ink">AI Skills — Single Masterclass Purchase</strong> (one per course, trigger: Order Submitted / Payment Received for that product): create/update contact → add tags → grant that course’s Membership offer → send confirmation email → send course-access email.</li>
              <li><strong className="text-maia-ink">AI Skills — All-Access Purchase</strong> (trigger: payment for the All-Access product): add tags → grant the All-Access offer (containing only the currently included courses) → confirmation + access emails.</li>
              <li><strong className="text-maia-ink">AI Skills — Follow-up</strong>: day 1 “start your first lesson”, day 3 check-in, day 7 progress nudge. For single buyers, an optional All-Access invitation — never an automatic charge.</li>
              <li><strong className="text-maia-ink">AI Skills — Unfinished Checkout</strong> (optional; trigger: Inbound Webhook from this funnel, no purchase within 1 hour): gentle reminder with a link back to the checkout.</li>
            </ol>
          </Section>
        </div>
      )}

      {tab === "publish" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Publish your changes" subtitle="Your edits are a draft in this browser. Visitors see the published catalog file.">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-maia-ink-soft">
              <li>Preview the draft and check every page.</li>
              <li>Click <strong className="text-maia-ink">Download catalog JSON</strong>.</li>
              <li>
                Replace the published file (<code className="text-maia-ink">{AI_SKILLS_CATALOG_URL}</code>) with it — in the repo at{" "}
                <code className="text-maia-ink">public/ai-skills-catalog.json</code>, or at the hosted URL set in{" "}
                <code className="text-maia-ink">VITE_AI_SKILLS_CATALOG_URL</code>.
              </li>
              <li>Reload the live page to confirm.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportJson}><Download size={16} /> Download catalog JSON</Button>
              <Button variant="secondary" onClick={() => openPreview("/ai-skills")} disabled={!hasSavedDraft}><Eye size={16} /> Preview draft</Button>
            </div>
          </Section>
          <Section title="Import / reset">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import catalog JSON</Button>
              <Button variant="secondary" onClick={() => setConfirmDiscard(true)} disabled={!hasSavedDraft}><RotateCcw size={16} /> Discard draft</Button>
            </div>
            {importMsg && <p className="text-sm text-maia-ink-soft">{importMsg}</p>}
            {blocking.length > 0 && (
              <div className="flex gap-3 rounded-xl border border-maia-warning/40 bg-maia-warning-bg p-4 text-sm text-maia-ink">
                <TriangleAlert className="shrink-0 text-maia-warning" size={18} />
                {blocking.length} required GHL connection{blocking.length > 1 ? "s are" : " is"} still missing. You can publish, but those products will show “checkout is being set up” instead of taking payment.
              </div>
            )}
          </Section>
        </div>
      )}

      {editing && (
        <CourseEditor
          initial={editing.course}
          isNew={editing.isNew}
          existingSlugs={draft.masterclasses.filter((m) => m.id !== editing.course.id).map((m) => m.slug)}
          onCancel={() => setEditing(null)}
          onSave={saveCourse}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) set((c) => ({ ...c, masterclasses: c.masterclasses.filter((m) => m.id !== deleting.id) }));
          setDeleting(null);
        }}
        title="Delete masterclass?"
        description={`“${deleting?.title ?? ""}” will be removed from your draft catalog. To hide it temporarily instead, disable it. Existing buyers keep their GHL access either way.`}
        confirmLabel="Delete"
        tone="danger"
      />
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          discardDraft();
          setPreviewingDraft(false);
          setConfirmDiscard(false);
        }}
        title="Discard draft?"
        description="All unpublished edits in this browser will be lost and the manager will show the published catalog again."
        confirmLabel="Discard draft"
        tone="danger"
      />
    </div>
  );
}
