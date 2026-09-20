import clsx from "clsx";

export function ProgressBar({
  percent,
  className,
  trackClassName,
  barClassName,
}: {
  percent: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={clsx("h-2.5 w-full overflow-hidden rounded-full bg-maia-bg", trackClassName, className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx("h-full rounded-full bg-gradient-to-r from-maia-gold-deep to-maia-gold", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
