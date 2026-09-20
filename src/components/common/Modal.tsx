import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-maia-border bg-maia-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-maia-border px-5 py-4">
          <h3 className="font-display text-base font-bold text-maia-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-maia-ink-soft hover:bg-maia-bg" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm text-maia-ink-soft">{children}</div>
        {footer && <div className="border-t border-maia-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
