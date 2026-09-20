import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
        variant === "primary" &&
          "bg-maia-black text-maia-gold-soft hover:bg-maia-black-hover border border-maia-black",
        variant === "secondary" &&
          "bg-maia-surface text-maia-ink border border-maia-border hover:border-maia-gold hover:text-maia-gold-deep",
        variant === "ghost" && "text-maia-ink-soft hover:text-maia-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
