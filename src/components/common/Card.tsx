import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Card({ children, className, padded = true, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-maia-border bg-maia-surface shadow-[0_1px_2px_rgba(28,26,23,0.04),0_8px_24px_-12px_rgba(28,26,23,0.08)]",
        padded && "p-5 sm:p-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="font-display text-[15px] font-bold tracking-wide text-maia-ink uppercase">
          {title}
        </h3>
        {subtitle && <p className="mt-1 text-sm text-maia-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
