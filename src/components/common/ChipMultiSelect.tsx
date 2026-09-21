import clsx from "clsx";

export function ChipMultiSelect({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-maia-ink">{label}</label>
      {hint && <p className="mb-2 text-xs text-maia-ink-soft">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={clsx(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-maia-gold bg-maia-gold-bg text-maia-gold-deep"
                  : "border-maia-border text-maia-ink-soft hover:border-maia-gold hover:text-maia-ink",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
