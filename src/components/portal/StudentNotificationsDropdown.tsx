import { useEffect, useRef, useState } from "react";
import { Award, Bell } from "lucide-react";
import { useStudentNotifications } from "@/components/portal/useStudentNotifications";

export function StudentNotificationsDropdown() {
  const items = useStudentNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-maia-ink-soft hover:bg-maia-bg"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-maia-danger ring-2 ring-maia-surface" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-maia-border bg-maia-surface shadow-lg">
          <div className="border-b border-maia-border px-4 py-3">
            <p className="text-sm font-semibold text-maia-ink">Notifications</p>
            <p className="text-[11px] text-maia-ink-soft">Live data, refreshed on open — not a real-time push system yet.</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-maia-ink-soft">
                <Award size={18} className="mx-auto mb-2 text-maia-ink-soft/40" />
                You&rsquo;re all caught up!
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-maia-bg"
                >
                  <span className="mt-0.5 flex-shrink-0">{item.icon}</span>
                  <span className="text-maia-ink">{item.message}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
