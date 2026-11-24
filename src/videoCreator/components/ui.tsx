import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { JobStatus, VideoLanguage, VideoStyle } from "../api";

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-vc-gold-bright focus-visible:ring-offset-2 focus-visible:ring-offset-vc-black disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-4 text-base",
        variant === "primary" && "bg-gradient-to-b from-vc-gold-bright to-vc-gold text-vc-black shadow-[0_8px_24px_-8px_rgba(214,165,36,0.55)] hover:brightness-110",
        variant === "secondary" && "border border-vc-border bg-vc-raised text-vc-ivory hover:border-vc-gold/60",
        variant === "ghost" && "text-vc-muted hover:bg-vc-raised hover:text-vc-ivory",
        variant === "danger" && "border border-vc-danger/40 bg-vc-danger/10 text-vc-danger hover:bg-vc-danger/20",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx("rounded-2xl border border-vc-border bg-vc-surface p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ step, title, hint, optional }: { step?: number; title: string; hint?: string; optional?: boolean }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {step !== undefined && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vc-gold/15 font-display text-sm font-bold text-vc-gold-bright ring-1 ring-vc-gold/40">{step}</span>}
      <div>
        <h2 className="font-display text-lg font-bold text-vc-ivory">
          {title} {optional && <span className="ml-1 text-xs font-medium text-vc-dim">(optional)</span>}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-vc-muted">{hint}</p>}
      </div>
    </div>
  );
}

const fieldBase = "w-full rounded-xl border border-vc-border bg-vc-black px-3.5 py-3 text-[15px] text-vc-ivory placeholder:text-vc-dim focus:border-vc-gold focus:outline-none focus:ring-1 focus:ring-vc-gold";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-vc-ivory/90">
      {children}
      {hint && <span className="ml-1 font-normal text-vc-dim">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(fieldBase, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(fieldBase, "min-h-[88px] resize-y", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(fieldBase, "appearance-none", props.className)} />;
}

export function Alert({ kind = "info", title, children }: { kind?: "info" | "success" | "warning" | "error"; title?: string; children?: ReactNode }) {
  const Icon = kind === "success" ? CheckCircle2 : kind === "warning" ? AlertTriangle : kind === "error" ? XCircle : Info;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={clsx(
        "flex gap-3 rounded-xl border p-4 text-sm",
        kind === "info" && "border-vc-gold/30 bg-vc-gold/5 text-vc-ivory",
        kind === "success" && "border-vc-success/40 bg-vc-success/10 text-vc-ivory",
        kind === "warning" && "border-amber-500/40 bg-amber-500/10 text-vc-ivory",
        kind === "error" && "border-vc-danger/40 bg-vc-danger/10 text-vc-ivory",
      )}
    >
      <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", kind === "success" ? "text-vc-success" : kind === "error" ? "text-vc-danger" : kind === "warning" ? "text-amber-400" : "text-vc-gold-bright")} />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5", "text-vc-ivory/80")}>{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-vc-muted">
      <Loader2 className="h-5 w-5 animate-spin text-vc-gold" />
      {label ?? "Loading…"}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-vc-ivory sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-vc-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const STYLE_LABEL: Record<VideoStyle, string> = {
  PRODUCT_COMMERCIAL: "Product Commercial",
  UGC_PROMO: "UGC-Style Promo",
  SALES_PROMOTION: "Sales Promotion",
};

export const LANGUAGE_LABEL: Record<VideoLanguage, string> = { ENGLISH: "English", FILIPINO: "Filipino", TAGLISH: "Taglish" };

const STATUS_META: Record<JobStatus, { label: string; cls: string }> = {
  QUEUED: { label: "Starting", cls: "bg-vc-gold/10 text-vc-gold-bright ring-vc-gold/30" },
  SUBMITTED: { label: "Creating", cls: "bg-vc-gold/10 text-vc-gold-bright ring-vc-gold/30" },
  RUNNING: { label: "Creating", cls: "bg-vc-gold/10 text-vc-gold-bright ring-vc-gold/30" },
  PROCESSING: { label: "Finishing", cls: "bg-vc-gold/10 text-vc-gold-bright ring-vc-gold/30" },
  COMPLETED: { label: "Ready", cls: "bg-vc-success/10 text-vc-success ring-vc-success/30" },
  FAILED: { label: "Failed", cls: "bg-vc-danger/10 text-vc-danger ring-vc-danger/30" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.QUEUED;
  const active = status !== "COMPLETED" && status !== "FAILED";
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", m.cls)}>
      {active && <Loader2 className="h-3 w-3 animate-spin" />}
      {m.label}
    </span>
  );
}

export const isActiveStatus = (s: JobStatus) => s !== "COMPLETED" && s !== "FAILED";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}
