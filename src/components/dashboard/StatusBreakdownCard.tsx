import { Card, CardHeader } from "@/components/common/Card";

export interface StatusBreakdownSegment {
  key: string;
  label: string;
  count: number;
  color: string;
  amountLabel?: string;
  onClick?: () => void;
}

export function StatusBreakdownCard({
  title,
  subtitle,
  segments,
}: {
  title: string;
  subtitle?: string;
  segments: StatusBreakdownSegment[];
}) {
  const total = segments.reduce((sum, seg) => sum + seg.count, 0);

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle ?? `${total} total`} />

      {total === 0 ? (
        <p className="rounded-lg bg-maia-bg px-3 py-6 text-center text-sm text-maia-ink-soft">No records yet.</p>
      ) : (
        <>
          <div className="mb-5 flex h-3 w-full overflow-hidden rounded-full bg-maia-bg">
            {segments.map((seg) => {
              const percent = total === 0 ? 0 : (seg.count / total) * 100;
              if (percent === 0) return null;
              return (
                <div key={seg.key} style={{ width: `${percent}%`, backgroundColor: seg.color }} title={`${seg.label}: ${seg.count}`} />
              );
            })}
          </div>

          <ul className="grid grid-cols-1 gap-2.5">
            {segments.map((seg) => {
              const Comp = seg.onClick ? "button" : "div";
              return (
                <li key={seg.key}>
                  <Comp
                    onClick={seg.onClick}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg bg-maia-bg px-3 py-2 text-left ${seg.onClick ? "cursor-pointer transition-colors hover:bg-maia-gold-bg" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm text-maia-ink-soft">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="truncate">{seg.label}</span>
                    </span>
                    <span className="flex flex-shrink-0 items-baseline gap-2">
                      {seg.amountLabel && <span className="whitespace-nowrap text-xs text-maia-ink-soft">{seg.amountLabel}</span>}
                      <span className="font-display text-sm font-bold text-maia-ink">{seg.count}</span>
                    </span>
                  </Comp>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
