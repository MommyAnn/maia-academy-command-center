import { Search } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink-soft sm:max-w-xs">
      <Search size={16} className="flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search..."}
        className="w-full bg-transparent text-maia-ink outline-none placeholder:text-maia-ink-soft/60"
      />
    </div>
  );
}
