import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Eye } from "lucide-react";
import { useAiSkillsStore, useFunnelCatalog } from "@/data/aiSkillsStore";
import { CORE_MESSAGE } from "@/data/aiSkillsConfig";

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/ai-skills" className="group flex items-center gap-3" aria-label="M.A.I.A. AI Skills Academy home">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ais-gold/60 bg-ais-black font-display text-sm font-extrabold text-ais-gold">
        M
      </span>
      <span className="leading-none">
        <span className="block font-display text-sm font-extrabold tracking-[0.18em] text-ais-ivory">M.A.I.A.</span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.24em] text-ais-gold">
          AI Skills Academy™
        </span>
        {!compact && (
          <span className="mt-1 hidden text-[9px] uppercase tracking-[0.2em] text-ais-muted/70 sm:block">
            by Mommy Ann Import Academy
          </span>
        )}
      </span>
    </Link>
  );
}

export function FunnelLayout({ children, minimalHeader = false }: { children: ReactNode; minimalHeader?: boolean }) {
  const { pathname, hash } = useLocation();
  const { previewingDraft } = useFunnelCatalog();
  const { setPreviewingDraft } = useAiSkillsStore();

  useEffect(() => {
    document.title = "M.A.I.A. AI Skills Academy™";
  }, []);

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="min-h-full bg-ais-black font-sans text-ais-ivory selection:bg-ais-gold selection:text-ais-black">
      {previewingDraft && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-ais-gold-bright px-4 py-2 text-center text-xs font-bold text-ais-black">
          <Eye className="h-4 w-4" />
          ADMIN DRAFT PREVIEW — visitors still see the published catalog.
          <button
            onClick={() => setPreviewingDraft(false)}
            className="cursor-pointer rounded-md bg-ais-black px-2 py-1 text-ais-gold-pale"
          >
            Exit preview
          </button>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-ais-gold/15 bg-ais-black/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <BrandLockup />
          {!minimalHeader && (
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/ai-skills#library"
                className="hidden rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ais-muted hover:text-ais-gold-pale md:inline-block"
              >
                Masterclasses
              </Link>
              <Link
                to="/ai-skills#all-access"
                className="hidden rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ais-muted hover:text-ais-gold-pale md:inline-block"
              >
                All-Access
              </Link>
              <Link
                to="/ai-skills#faq"
                className="hidden rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ais-muted hover:text-ais-gold-pale md:inline-block"
              >
                FAQ
              </Link>
              <Link
                to="/ai-skills#choose"
                className="rounded-lg border border-ais-gold/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-ais-gold-pale transition-colors hover:bg-ais-gold hover:text-ais-black"
              >
                Enroll
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-ais-gold/15 bg-ais-black">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
            <div>
              <BrandLockup compact />
              <p className="mt-5 max-w-md text-sm leading-relaxed text-ais-muted">
                Part of the M.A.I.A. Business Solutions Academy ecosystem. Powered by Mommy Ann Import Academy.
              </p>
              <p className="mt-5 font-display text-sm font-extrabold uppercase tracking-[0.14em] text-ais-gold">
                {CORE_MESSAGE.join(" ")}
              </p>
            </div>
            <div className="text-xs leading-relaxed text-ais-muted/80">
              <p className="font-semibold uppercase tracking-[0.16em] text-ais-ivory/80">Responsible learning</p>
              <p className="mt-3">
                M.A.I.A. AI Skills Academy teaches practical skills. Results depend on each student’s effort, practice,
                and application. We do not guarantee income or specific earnings.
              </p>
              <p className="mt-3">
                M.A.I.A. AI Skills Academy is a skills-based program and is separate from the M.A.I.A. Business
                Solutions Academy Level 1, Level 2 and Level 3 business-building programs.
              </p>
            </div>
          </div>
          <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-ais-muted/60">
            © {new Date().getFullYear()} Mommy Ann Import Academy · M.A.I.A. Business Solutions Academy
          </p>
        </div>
      </footer>
    </div>
  );
}
