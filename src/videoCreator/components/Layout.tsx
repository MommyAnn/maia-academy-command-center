import clsx from "clsx";
import { Coins, Film, HelpCircle, LayoutDashboard, LogOut, Settings, Sparkles, Users, Clapperboard, SlidersHorizontal, ScrollText, Gauge } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useVcAuth } from "../auth";
import { ApiError, vcApi, type Me } from "../api";
import { Alert, Spinner } from "./ui";

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-vc-gold-bright to-vc-gold shadow-[0_6px_20px_-6px_rgba(214,165,36,0.6)]">
        <Clapperboard className="h-5 w-5 text-vc-black" strokeWidth={2.4} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[15px] font-extrabold tracking-wide text-vc-ivory">M.A.I.A.</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-vc-gold">AI Video Creator</p>
        </div>
      )}
    </div>
  );
}

// ---- Customer "me" context (credits shared across pages) ------------------

interface MeState {
  me: Me | null;
  reload: () => Promise<void>;
}
const MeCtx = createContext<MeState>({ me: null, reload: async () => {} });
export const useMe = () => useContext(MeCtx);

const CUSTOMER_NAV = [
  { to: "/studio", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/studio/create", label: "Create Video", icon: Sparkles },
  { to: "/studio/videos", label: "My Videos", icon: Film },
  { to: "/studio/credits", label: "Credits", icon: Coins },
  { to: "/studio/account", label: "Account", icon: Settings },
  { to: "/studio/help", label: "Help", icon: HelpCircle },
];

const ADMIN_NAV = [
  { to: "/studio/admin", label: "Overview", icon: Gauge, end: true },
  { to: "/studio/admin/customers", label: "Customers", icon: Users },
  { to: "/studio/admin/jobs", label: "Video Jobs", icon: Film },
  { to: "/studio/admin/settings", label: "Settings", icon: SlidersHorizontal },
  { to: "/studio/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/studio/account", label: "Account", icon: Settings },
];

function Shell({ nav, header, children }: { nav: typeof CUSTOMER_NAV; header?: ReactNode; children: ReactNode }) {
  const { user, logout } = useVcAuth();
  const navigate = useNavigate();
  const mobileNav = nav.slice(0, 5);
  return (
    <div className="min-h-full bg-vc-black text-vc-ivory">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-vc-border bg-vc-surface/80 px-4 py-6 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", isActive ? "bg-vc-gold/12 text-vc-gold-bright ring-1 ring-vc-gold/30" : "text-vc-muted hover:bg-vc-raised hover:text-vc-ivory")}>
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-vc-border pt-4">
          <p className="truncate px-2 text-sm font-medium text-vc-ivory">{user?.fullName}</p>
          <p className="truncate px-2 text-xs text-vc-dim">{user?.email}</p>
          <button
            onClick={async () => {
              await logout();
              navigate("/studio/login");
            }}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-vc-muted hover:bg-vc-raised hover:text-vc-ivory"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-vc-border bg-vc-black/85 backdrop-blur lg:ml-64">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            {header}
            <button
              aria-label="Log out"
              onClick={async () => {
                await logout();
                navigate("/studio/login");
              }}
              className="rounded-lg p-2 text-vc-muted hover:bg-vc-raised hover:text-vc-ivory lg:hidden"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="pb-28 lg:ml-64 lg:pb-12">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid border-t border-vc-border bg-vc-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}>
        {mobileNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", isActive ? "text-vc-gold-bright" : "text-vc-dim")}>
            <n.icon className="h-5 w-5" />
            {n.label.replace("Create Video", "Create")}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function CustomerLayout() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setMe(await vcApi.me());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your account.");
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const credits = me && (
    <NavLink to="/studio/credits" className="flex items-center gap-2 rounded-full border border-vc-gold/40 bg-vc-gold/10 px-3.5 py-1.5 text-sm font-semibold text-vc-gold-bright" title="Your remaining video credits">
      <Coins className="h-4 w-4" />
      <span data-testid="header-credits">{me.account.creditBalance}</span>
      <span className="hidden font-medium text-vc-ivory/70 sm:inline">credit{me.account.creditBalance === 1 ? "" : "s"}</span>
    </NavLink>
  );

  return (
    <MeCtx.Provider value={{ me, reload }}>
      <Shell nav={CUSTOMER_NAV} header={credits}>
        {error ? <Alert kind="error" title="Something went wrong">{error}</Alert> : !me ? <Spinner /> : <Outlet />}
      </Shell>
    </MeCtx.Provider>
  );
}

export function AdminLayout() {
  return (
    <Shell nav={ADMIN_NAV} header={<span className="rounded-full border border-vc-border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-vc-gold">Admin</span>}>
      <Outlet />
    </Shell>
  );
}
