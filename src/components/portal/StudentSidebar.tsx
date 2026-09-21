import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import { PORTAL_NAV_ITEMS } from "@/data/portalNavigation";

function BrandMark() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-maia-gold/40 bg-maia-black-soft">
        <span className="font-display text-base font-bold text-maia-gold">M</span>
      </div>
      <div className="leading-tight">
        <p className="font-display text-sm font-bold tracking-[0.18em] text-white">M.A.I.A.</p>
        <p className="text-[10px] tracking-[0.1em] text-white/45">STUDENT PORTAL</p>
      </div>
    </div>
  );
}

function PortalNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-0.5">
        {PORTAL_NAV_ITEMS.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === "/portal"}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                  isActive
                    ? "bg-maia-gold/15 text-maia-gold border border-maia-gold/25"
                    : "text-white/70 border border-transparent hover:bg-white/5 hover:text-white",
                )
              }
            >
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-60" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="text-[11px] leading-relaxed text-white/35">
        Mommy Ann Import Academy
        <br />
        M.A.I.A. Business Solutions Academy
      </p>
    </div>
  );
}

/** Static sidebar shown on large screens. */
export function StudentSidebar() {
  return (
    <aside className="no-print hidden lg:flex lg:w-[248px] lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-black/40 lg:bg-maia-black">
      <BrandMark />
      <PortalNav />
      <SidebarFooter />
    </aside>
  );
}

/** Slide-in drawer used on tablet & mobile. */
export function StudentSidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        className={`no-print fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[80vw] flex-col bg-maia-black shadow-2xl transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between pr-3">
          <BrandMark />
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <PortalNav onNavigate={onClose} />
        <SidebarFooter />
      </aside>
    </>
  );
}
