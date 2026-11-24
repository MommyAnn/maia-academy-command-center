import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { ErrorNote } from "@/components/ui";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "price" | "url" | "select" | "checkbox" | "datetime" | "image" | "course";
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
  wide?: boolean;
  nullable?: boolean;
};

export function AdminPageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="h-display text-3xl text-ivory">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-10" role="dialog" aria-modal aria-label={title}>
      <div className={`glass w-full ${wide ? "max-w-3xl" : "max-w-xl"} bg-ink-2 p-6`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl text-ivory">{title}</h2>
          <button className="btn btn-ghost p-2" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-gold/30" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gold/30 text-gold/60">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <input className="input" value={value} placeholder="Upload an image or paste an https:// link" onChange={(e) => onChange(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline px-3 py-1.5 text-xs" disabled={busy} onClick={() => ref.current?.click()}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />} Upload image
            </button>
            {value && (
              <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => onChange("")}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setErr(null);
          try {
            onChange((await api.upload(file)).url);
          } catch (er) {
            setErr((er as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <ErrorNote message={err} />
      <p className="hint">PNG, JPG or WEBP up to 5 MB.</p>
    </div>
  );
}

/** Converts an ISO date to the value format used by <input type="datetime-local">. */
const toLocalInput = (v: string) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function Field({
  def,
  value,
  onChange,
  courses,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  courses?: { id: number; title: string }[];
}) {
  const id = `f-${def.key}`;
  const str = value == null ? "" : String(value);
  let control: ReactNode;
  switch (def.type) {
    case "textarea":
      control = <textarea id={id} rows={5} className="input" value={str} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
    case "price":
      control = (
        <div className="relative">
          {def.type === "price" && <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted">₱</span>}
          <input
            id={id}
            type="number"
            min={0}
            className={`input ${def.type === "price" ? "pl-8" : ""}`}
            value={str}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value === "" ? (def.nullable ? null : 0) : Number(e.target.value))}
          />
        </div>
      );
      break;
    case "select":
      control = (
        <select id={id} className="input" value={str} onChange={(e) => onChange(e.target.value)}>
          {def.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "course":
      control = (
        <select id={id} className="input" value={str} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— None —</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      );
      break;
    case "checkbox":
      return (
        <label className={`flex items-start gap-3 text-sm text-ivory/90 ${def.wide ? "sm:col-span-2" : ""}`}>
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#d6a524]" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span>
            {def.label}
            {def.hint && <span className="block text-xs text-muted">{def.hint}</span>}
          </span>
        </label>
      );
    case "datetime":
      control = <input id={id} type="datetime-local" className="input" value={toLocalInput(str)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")} />;
      break;
    case "image":
      control = <ImageField value={str} onChange={onChange} />;
      break;
    default:
      control = (
        <input
          id={id}
          type={def.type === "url" ? "url" : "text"}
          className="input"
          value={str}
          placeholder={def.placeholder ?? (def.type === "url" ? "https://" : undefined)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  return (
    <div className={def.wide || def.type === "textarea" || def.type === "image" ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={id}>
        {def.label}
      </label>
      {control}
      {def.hint && <p className="hint">{def.hint}</p>}
    </div>
  );
}

export function FormGrid({ fields, data, setData, courses }: {
  fields: FieldDef[];
  data: Record<string, unknown>;
  setData: (d: Record<string, unknown>) => void;
  courses?: { id: number; title: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <Field key={f.key} def={f} value={data[f.key]} courses={courses} onChange={(v) => setData({ ...data, [f.key]: v })} />
      ))}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const node = toast ? (
    <div
      role="status"
      className={`fixed right-6 bottom-6 z-[60] rounded-xl border px-4 py-3 text-sm shadow-xl ${
        toast.kind === "ok" ? "border-success/40 bg-ink-3 text-success" : "border-danger/40 bg-ink-3 text-danger"
      }`}
    >
      {toast.text}
    </div>
  ) : null;
  return {
    node,
    ok: (text: string) => setToast({ kind: "ok", text }),
    err: (e: unknown) => setToast({ kind: "err", text: e instanceof Error ? e.message : String(e) }),
  };
}
