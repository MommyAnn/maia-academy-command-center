import type { TextareaHTMLAttributes } from "react";
import clsx from "clsx";

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function TextAreaField({ label, hint, className, id, rows = 3, required, ...rest }: TextAreaFieldProps) {
  const areaId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return (
    <div>
      <label htmlFor={areaId} className="mb-1.5 block text-sm font-semibold text-maia-ink">
        {label}
        {required && <span className="ml-0.5 text-maia-danger">*</span>}
      </label>
      <textarea
        id={areaId}
        rows={rows}
        className={clsx(
          "w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none transition-colors placeholder:text-maia-ink-soft/50 focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20",
          className,
        )}
        {...rest}
      />
      {hint && <p className="mt-1 text-xs text-maia-ink-soft">{hint}</p>}
    </div>
  );
}
