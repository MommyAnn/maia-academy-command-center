import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { NAV_SECTIONS } from "@/data/navigation";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-5">
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                      isActive
                        ? "bg-maia-gold/15 text-maia-gold border border-maia-gold/25"
                        : "text-white/70 border border-transparent hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <span
                    className={clsx(
                      "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                      "bg-current opacity-60",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
