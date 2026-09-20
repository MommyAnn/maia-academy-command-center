import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, className, id, ...rest }: TextFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-maia-ink">
        {label}
        {rest.required && <span className="ml-0.5 text-maia-danger">*</span>}
      </label>
      <input
        id={inputId}
        className={clsx(
          "w-full rounded-lg border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none transition-colors placeholder:text-maia-ink-soft/50 focus:ring-2 focus:ring-maia-gold/20",
          error ? "border-maia-danger" : "border-maia-border focus:border-maia-gold",
          className,
        )}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-xs text-maia-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-maia-danger">{error}</p>}
    </div>
  );
}
