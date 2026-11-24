import {
  Bot,
  CheckCircle2,
  Globe,
  ImageIcon,
  Loader2,
  Megaphone,
  PlayCircle,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { trackEvent, useSite } from "@/lib/context";
import { toEmbed } from "@/lib/format";

/** Official M.A.I.A. monogram + temporary text wordmark (replaceable via Settings → Logo). */
export function Logo({ compact = false }: { compact?: boolean }) {
  const { site } = useSite();
  const logo = site?.settings["brand.logoUrl"] || "/brand/maia-monogram.png";
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label="M.A.I.A. Business Solutions Academy — Home">
      <img
        src={logo}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-gold/30 transition group-hover:ring-gold/70"
      />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] tracking-wide text-ivory">M.A.I.A.</span>
          <span className="block text-[11px] font-semibold tracking-[0.16em] text-gold uppercase">
            Business Solutions Academy
          </span>
        </span>
      )}
    </Link>
  );
}

/** Thin gold rule with a centred diamond — the recurring ornament from the M.A.I.A. slide system. */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/70" />
      <span className="h-2 w-2 rotate-45 bg-gold-bright" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/70" />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  gold,
  sub,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  gold?: ReactNode;
  sub?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="h-display mt-4 text-3xl text-ivory sm:text-4xl">
        {title} {gold && <span className="text-gold-grad">{gold}</span>}
      </h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{sub}</p>}
    </div>
  );
}

export const COURSE_ICONS: Record<string, LucideIcon> = {
  image: ImageIcon,
  megaphone: Megaphone,
  workflow: Workflow,
  bot: Bot,
  globe: Globe,
  sparkles: Sparkles,
};

/**
 * Course "poster" art. Uses the admin-uploaded cover image when present,
 * otherwise a branded black-and-gold faceted placeholder.
 */
export function CourseArt({
  title,
  icon,
  coverImage,
  index = 0,
  size = "md",
}: {
  title: string;
  icon: string;
  coverImage?: string;
  index?: number;
  size?: "md" | "lg";
}) {
  const Icon = COURSE_ICONS[icon] ?? Sparkles;
  if (coverImage)
    return <img src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />;
  const angle = [18, -14, 32, -24, 8][index % 5];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_80%_10%,#3f3626_0%,#12100d_55%,#0a0908_100%)]">
      <div
        className="absolute -right-10 -top-16 h-[140%] w-1/2 border-l border-gold/25 bg-gradient-to-b from-gold/12 to-transparent"
        style={{ transform: `rotate(${angle}deg)` }}
      />
      <div
        className="absolute -left-20 bottom-[-40%] h-[90%] w-[70%] border-t border-gold/20 bg-gradient-to-tr from-bronze/25 to-transparent"
        style={{ transform: `rotate(${-angle / 2}deg)` }}
      />
      <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#c29646_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(135deg,black,transparent_45%)]" />
      <Icon
        className={`absolute text-gold-bright/90 drop-shadow-[0_0_24px_rgba(214,165,36,0.45)] ${
          size === "lg" ? "right-10 top-10 h-24 w-24" : "right-5 top-5 h-12 w-12"
        }`}
        strokeWidth={1.25}
        aria-hidden
      />
      <span className="sr-only">{title}</span>
    </div>
  );
}

type CheckoutProps = {
  checkoutUrl: string;
  status: "coming_soon" | "open" | "closed";
  inquireTopic: string;
  label: string;
  tracking: { offer: string; format: string; value: number };
  variant?: "gold" | "outline";
  className?: string;
};

/**
 * Enrollment button. Goes to the GoHighLevel checkout link once the admin has
 * added it and opened enrollment; otherwise falls back to an inquiry — it never
 * pretends a payment happened.
 */
export function CheckoutButton({ checkoutUrl, status, inquireTopic, label, tracking, variant = "gold", className = "" }: CheckoutProps) {
  const cls = `btn btn-${variant} w-full ${className}`;
  if (status === "open" && checkoutUrl) {
    return (
      <a
        href={checkoutUrl}
        className={cls}
        data-offer={tracking.offer}
        data-format={tracking.format}
        rel="noopener"
        onClick={() =>
          trackEvent("InitiateCheckout", { content_name: tracking.offer, value: tracking.value, currency: "PHP" })
        }
      >
        {label}
      </a>
    );
  }
  return (
    <Link to={`/contact?topic=${encodeURIComponent(inquireTopic)}`} className={cls}>
      {status === "closed" ? "Enrollment closed — inquire" : "Inquire to enroll"}
    </Link>
  );
}

export function StatusBadge({ status }: { status: "coming_soon" | "open" | "closed" }) {
  if (status === "open") return <span className="badge badge-success">Enrollment open</span>;
  if (status === "closed") return <span className="badge badge-muted">Enrollment closed</span>;
  return <span className="badge badge-gold">Opening soon</span>;
}

export function VideoEmbed({ url, title, placeholder }: { url: string; title: string; placeholder?: ReactNode }) {
  const embed = toEmbed(url);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-gold/25 bg-ink">
      {embed?.kind === "video" ? (
        <video src={embed.src} controls controlsList="nodownload" className="h-full w-full" title={title} />
      ) : embed ? (
        <iframe
          src={embed.src}
          title={title}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(80%_80%_at_50%_30%,#3f3626_0%,#0a0908_70%)] p-6 text-center">
          <PlayCircle className="h-14 w-14 text-gold/70" strokeWidth={1.2} />
          <div className="font-display text-lg text-ivory">Recording coming soon</div>
          <div className="max-w-md text-sm text-muted">
            {placeholder ?? "This lesson video has not been uploaded yet. Babalikan natin ito once it's ready."}
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed text-ivory/90">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright" />
      <span>{children}</span>
    </li>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-gold" /> {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Sparkles, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
        <Icon className="h-6 w-6 text-gold-bright" />
      </div>
      <h3 className="h-display mt-5 text-xl text-ivory">{title}</h3>
      {children && <div className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

export function PageHero({ eyebrow, title, gold, sub }: { eyebrow?: string; title: ReactNode; gold?: ReactNode; sub?: ReactNode }) {
  return (
    <section className="container-x pt-14 pb-10 sm:pt-20">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className="h-display mt-5 max-w-4xl text-4xl text-ivory sm:text-5xl">
        {title} {gold && <span className="text-gold-grad">{gold}</span>}
      </h1>
      {sub && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{sub}</p>}
    </section>
  );
}
