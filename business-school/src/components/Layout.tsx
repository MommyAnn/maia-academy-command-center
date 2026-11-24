import { Facebook, Instagram, LogIn, Mail, Menu, MessageCircle, Youtube, X, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth, useSite } from "@/lib/context";
import { Logo } from "./ui";

/** Public navigation — exactly these five items, in this order. */
export const NAV = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/store", label: "Store" },
  { to: "/testimonials", label: "Testimonials" },
  { to: "/contact", label: "Contact Us" },
];

export function PublicLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    // Wait for async content (e.g. the program section) before jumping to an anchor.
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 350);
    return () => clearTimeout(t);
  }, [pathname, hash]);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { site } = useSite();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const announcement = site?.settings["home.announcement"];

  const portalLink = user ? (user.role === "admin" ? "/admin" : "/portal") : "/login";
  const portalLabel = user ? (user.role === "admin" ? "Admin Dashboard" : "Student Portal") : "Sign in";

  return (
    <header className="sticky top-0 z-40 border-b border-gold/15 bg-ink/80 backdrop-blur-xl">
      {announcement && (
        <div className="border-b border-gold/15 bg-gold/10 px-4 py-2 text-center text-xs font-medium text-gold-pale">
          {announcement}
        </div>
      )}
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-[13px] font-semibold tracking-[0.12em] uppercase transition ${
                  isActive ? "text-gold-bright" : "text-ivory/80 hover:text-gold-pale"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link to={portalLink} className="btn btn-gold">
            {user ? <GraduationCap className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {portalLabel}
          </Link>
        </div>
        <button
          className="btn btn-ghost px-3 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-gold/15 bg-ink/95 lg:hidden" aria-label="Mobile">
          <div className="container-x flex flex-col py-3">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-3 text-sm font-semibold tracking-[0.12em] uppercase ${
                    isActive ? "text-gold-bright" : "text-ivory/85"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <Link to={portalLink} className="btn btn-gold mt-3">
              {portalLabel}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { site } = useSite();
  const s = site?.settings ?? {};
  const socials = [
    { href: s["social.facebook"], icon: Facebook, label: "Facebook" },
    { href: s["social.instagram"], icon: Instagram, label: "Instagram" },
    { href: s["social.youtube"], icon: Youtube, label: "YouTube" },
    { href: s["social.tiktok"], icon: TikTokIcon, label: "TikTok" },
    { href: s["contact.messengerUrl"], icon: MessageCircle, label: "Messenger" },
  ].filter((x) => x.href);

  return (
    <footer className="mt-24 border-t border-gold/15 bg-ink-2/80">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            A school for aspiring entrepreneurs and business owners who want practical business skills — with proper
            guidance.
          </p>
          <p className="mt-4 text-xs font-semibold tracking-[0.3em] text-gold uppercase">Import • Learn • Build • Grow</p>
          <p className="mt-3 text-xs text-muted">
            Powered by <span className="text-ivory/90">Mommy Ann Import Academy</span>
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Explore</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="text-ivory/80 hover:text-gold-pale">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/portal" className="text-ivory/80 hover:text-gold-pale">
                Student Portal
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Connect</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {s["contact.email"] && (
              <li>
                <a href={`mailto:${s["contact.email"]}`} className="inline-flex items-center gap-2 text-ivory/80 hover:text-gold-pale">
                  <Mail className="h-4 w-4" /> {s["contact.email"]}
                </a>
              </li>
            )}
            <li>
              <Link to="/contact" className="text-ivory/80 hover:text-gold-pale">
                Send us an inquiry
              </Link>
            </li>
            <li>
              <Link to="/policies/terms" className="text-ivory/80 hover:text-gold-pale">
                Terms of Enrollment
              </Link>
            </li>
            <li>
              <Link to="/policies/refund" className="text-ivory/80 hover:text-gold-pale">
                Refund & Rescheduling Policy
              </Link>
            </li>
            <li>
              <Link to="/policies/privacy" className="text-ivory/80 hover:text-gold-pale">
                Privacy Notice
              </Link>
            </li>
          </ul>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-2">
              {socials.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 text-gold hover:border-gold-bright hover:text-gold-pale"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="hairline" />
      <div className="container-x flex flex-col gap-3 py-6 text-xs text-muted">
        <p>© {new Date().getFullYear()} M.A.I.A. Business Solutions Academy · Mommy Ann Import Academy. All rights reserved.</p>
        <p className="leading-relaxed">
          M.A.I.A. Business Solutions Academy provides practical business education. Course activities and outputs are
          learning exercises, not guarantees of income or business results — your results depend on your own effort,
          products, capital, market conditions and decisions. Third-party software (such as Claude, Canva, Google AI tools,
          Meta Ads Manager and website builders) is not included in the course price and may require separate accounts or
          subscriptions.
        </p>
      </div>
    </footer>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1 0-5.2c.27 0 .53.04.77.12V9.65a5.7 5.7 0 0 0-.77-.05 5.69 5.69 0 1 0 5.69 5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />
    </svg>
  );
}
