import { CalendarDays, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useSite } from "@/lib/context";
import { peso } from "@/lib/format";
import { CheckItem, CheckoutButton, StatusBadge } from "@/components/ui";

/** The ₱15,000 Complete 5-Workshop Business Solutions Program offer block. */
export function ProgramCard() {
  const { site, courses } = useSite();
  if (!site) return null;
  const p = site.program;
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <div>
        <span className="eyebrow">Complete program</span>
        <h2 className="h-display mt-4 text-3xl text-ivory sm:text-4xl">
          All five guided workshops, <span className="text-gold-grad">in one program.</span>
        </h2>
        <p className="mt-5 max-w-xl leading-relaxed text-ivory/80">
          For entrepreneurs who want the full set of practical digital skills with structured guidance — from creating
          your content and ads, to automating follow-ups, to launching your website.
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {(courses ?? []).map((c, i) => (
            <li key={c.id}>
              <Link
                to={`/courses/${c.slug}`}
                className="flex items-center gap-3 rounded-xl border border-gold/20 bg-ink/40 px-4 py-3 text-sm text-ivory/90 transition hover:border-gold/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-xs text-gold-bright">
                  {i + 1}
                </span>
                {c.title}
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-start gap-2 text-sm text-muted">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          {p.journey}
        </p>
      </div>

      <div className="glass relative overflow-hidden p-8 shadow-[0_0_80px_-30px_rgba(214,165,36,0.6)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-gold-pale to-gold-bright" />
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl text-ivory">{p.title}</h3>
          <StatusBadge status={p.status} />
        </div>
        <div className="mt-6 flex items-end gap-3">
          <span className="font-display text-5xl text-gold-grad">{peso(p.price)}</span>
          <span className="pb-1.5 text-sm text-muted">one-time</span>
        </div>
        <dl className="mt-6 space-y-2 rounded-xl border border-gold/20 bg-ink/40 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{p.courseCount} individual guided workshops</dt>
            <dd className="text-ivory/70 line-through">{peso(p.guidedTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Complete program</dt>
            <dd className="font-semibold text-ivory">{peso(p.price)}</dd>
          </div>
          <div className="hairline my-2" />
          <div className="flex justify-between">
            <dt className="font-semibold text-gold-pale">You save</dt>
            <dd className="font-semibold text-gold-bright">{peso(p.savings)}</dd>
          </div>
        </dl>
        <ul className="mt-6 space-y-3">
          <CheckItem>Guided workshop access for all {p.courseCount} workshops</CheckItem>
          <CheckItem>Proposed 30-day guided learning journey</CheckItem>
          <CheckItem>Zoom first; face-to-face once our training center opens</CheckItem>
          <CheckItem>One-time payment — no monthly subscription</CheckItem>
        </ul>
        <div className="mt-7">
          <CheckoutButton
            checkoutUrl={p.checkoutUrl}
            status={p.status}
            inquireTopic="Complete 5-Workshop Program"
            label={`Enroll in the program — ${peso(p.price)}`}
            tracking={{ offer: "complete-program", format: "guided", value: p.price }}
            className="btn-lg"
          />
        </div>
        <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Not an unlimited membership. Recording access periods and the live session calendar are set per batch and
          announced before you enroll.
        </p>
      </div>
    </div>
  );
}
