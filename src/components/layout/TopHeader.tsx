import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, Settings, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";

export function TopHeader({
  pageTitle,
  onMenuClick,
}: {
  pageTitle: string;
  onMenuClick: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-maia-border bg-maia-surface/95 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-maia-ink-soft hover:bg-maia-bg lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <h1 className="truncate font-display text-base font-bold text-maia-ink sm:text-lg">
        {pageTitle}
      </h1>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        <NotificationsDropdown />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-maia-bg"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-maia-black text-xs font-bold text-maia-gold">
              {user?.avatarInitials ?? "MA"}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-semibold text-maia-ink">{user?.name ?? "Mommy Ann"}</p>
              <p className="text-xs text-maia-ink-soft">Owner / Administrator</p>
            </div>
            <ChevronDown size={16} className="hidden text-maia-ink-soft sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-maia-border bg-maia-surface shadow-lg">
              <div className="border-b border-maia-border px-4 py-3">
                <p className="text-sm font-semibold text-maia-ink">{user?.name ?? "Mommy Ann"}</p>
                <p className="text-xs text-maia-ink-soft">Owner / Administrator</p>
              </div>
              <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-maia-ink hover:bg-maia-bg">
                <User size={16} className="text-maia-ink-soft" />
                My Profile
              </button>
              <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-maia-ink hover:bg-maia-bg">
                <Settings size={16} className="text-maia-ink-soft" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 border-t border-maia-border px-4 py-2.5 text-left text-sm font-medium text-maia-danger hover:bg-maia-danger-bg"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
