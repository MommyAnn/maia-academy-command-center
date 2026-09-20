import type { SelectHTMLAttributes } from "react";
import clsx from "clsx";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({ label, error, options, placeholder, className, id, required, ...rest }: SelectFieldProps) {
  const selectId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return (
    <div>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-maia-ink">
        {label}
        {required && <span className="ml-0.5 text-maia-danger">*</span>}
      </label>
      <select
        id={selectId}
        required={required}
        className={clsx(
          "w-full rounded-lg border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none transition-colors focus:ring-2 focus:ring-maia-gold/20",
          error ? "border-maia-danger" : "border-maia-border focus:border-maia-gold",
          className,
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs font-medium text-maia-danger">{error}</p>}
    </div>
  );
}
