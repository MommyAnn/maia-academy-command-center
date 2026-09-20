import { Check } from "lucide-react";
import clsx from "clsx";

export interface EnrollmentStepMeta {
  label: string;
}

export function StepIndicator({ steps, currentIndex }: { steps: EnrollmentStepMeta[]; currentIndex: number }) {
  return (
    <div className="flex items-start justify-between gap-1 sm:gap-2">
      {steps.map((step, idx) => {
        const isDone = idx < currentIndex;
        const isActive = idx === currentIndex;
        return (
          <div key={step.label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <div className={clsx("h-0.5 flex-1", idx === 0 ? "opacity-0" : isDone || isActive ? "bg-maia-gold" : "bg-maia-border")} />
              <div
                className={clsx(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8",
                  isDone && "bg-maia-gold text-maia-black",
                  isActive && !isDone && "bg-maia-black text-maia-gold ring-4 ring-maia-gold-bg",
                  !isDone && !isActive && "bg-maia-bg text-maia-ink-soft border border-maia-border",
                )}
              >
                {isDone ? <Check size={14} /> : idx + 1}
              </div>
              <div className={clsx("h-0.5 flex-1", idx === steps.length - 1 ? "opacity-0" : isDone ? "bg-maia-gold" : "bg-maia-border")} />
            </div>
            <span
              className={clsx(
                "hidden text-[11px] font-semibold uppercase tracking-wide sm:block",
                isActive ? "text-maia-ink" : "text-maia-ink-soft",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
