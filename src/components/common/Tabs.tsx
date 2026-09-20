import clsx from "clsx";

export interface TabItem {
  value: string;
  label: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="scrollbar-none flex gap-1 overflow-x-auto border-b border-maia-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            "relative flex-shrink-0 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors",
            active === tab.value ? "text-maia-gold-deep" : "text-maia-ink-soft hover:text-maia-ink",
          )}
        >
          {tab.label}
          {active === tab.value && (
            <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-maia-gold-deep" />
          )}
        </button>
      ))}
    </div>
  );
}
