import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  Aperture,
  CalendarDays,
  Clapperboard,
  Globe,
  Megaphone,
  Mic,
  Music,
  Palette,
  PenLine,
  ScanFace,
  Video,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { AiMasterclass, AiSkillIcon } from "@/types/aiSkills";

// Shared building blocks for the M.A.I.A. AI Skills Academy funnel pages.

export const SKILL_ICONS: Record<AiSkillIcon, LucideIcon> = {
  "digital-twin": ScanFace,
  interview: Mic,
  ugc: Clapperboard,
  photography: Aperture,
  music: Music,
  website: Globe,
  "content-system": CalendarDays,
  video: Video,
  design: Palette,
  marketing: Megaphone,
  automation: Workflow,
  writing: PenLine,
};

/** Fades a block in once it scrolls into view (disabled for reduced motion via CSS). */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={clsx("ais-reveal", visible && "is-visible", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

type CtaVariant = "gold" | "outline" | "dark";

const ctaClasses: Record<CtaVariant, string> = {
  gold:
    "bg-ais-gold text-ais-black hover:bg-ais-gold-bright shadow-[0_10px_30px_-12px_rgba(214,165,36,0.6)] border border-ais-gold",
  outline: "border border-ais-gold/70 text-ais-gold-pale hover:bg-ais-gold/10 hover:border-ais-gold",
  dark: "bg-ais-black text-ais-gold-pale border border-ais-bronze hover:border-ais-gold",
};

const ctaBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.08em] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ais-gold-bright";

export function CtaLink({
  to,
  children,
  variant = "gold",
  className,
}: {
  to: string;
  children: ReactNode;
  variant?: CtaVariant;
  className?: string;
}) {
  const isHash = to.startsWith("#");
  if (isHash) {
    return (
      <a href={to} className={clsx(ctaBase, ctaClasses[variant], className)}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={clsx(ctaBase, ctaClasses[variant], className)}>
      {children}
    </Link>
  );
}

export function CtaButton({
  children,
  variant = "gold",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: CtaVariant }) {
  return (
    <button
      className={clsx(ctaBase, ctaClasses[variant], "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CtaAnchor({
  href,
  children,
  variant = "gold",
  className,
  newTab = false,
}: {
  href: string;
  children: ReactNode;
  variant?: CtaVariant;
  className?: string;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      className={clsx(ctaBase, ctaClasses[variant], className)}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("text-[11px] font-bold uppercase tracking-[0.28em] text-ais-gold sm:text-xs", className)}>{children}</p>
  );
}

export function SectionHeading({
  index,
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <Reveal className={clsx("mb-10 sm:mb-14", align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl")}>
      {(index || eyebrow) && (
        <Eyebrow className={clsx("mb-4 flex items-center gap-3", align === "center" && "justify-center")}>
          {index && <span className="text-ais-gold-pale/60">{index}</span>}
          {index && eyebrow && <span className="h-px w-8 bg-ais-gold/50" />}
          {eyebrow && <span>{eyebrow}</span>}
        </Eyebrow>
      )}
      <h2 className="font-display text-3xl font-extrabold uppercase leading-[1.08] tracking-tight text-ais-ivory sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && <p className="mt-5 text-base leading-relaxed text-ais-muted sm:text-lg">{subtitle}</p>}
    </Reveal>
  );
}

/** Course cover: the admin's image when set, otherwise a branded generated cover. */
export function CourseCover({ course, className }: { course: AiMasterclass; className?: string }) {
  const Icon = SKILL_ICONS[course.icon] ?? Video;
  const [failed, setFailed] = useState(false);
  if (course.coverImageUrl && !failed) {
    return (
      <div className={clsx("relative overflow-hidden bg-ais-panel-2", className)}>
        <img
          src={course.coverImageUrl}
          alt={course.title}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={clsx(
        "relative flex items-end overflow-hidden bg-gradient-to-br from-ais-panel-2 via-ais-black to-ais-bronze-dim",
        className,
      )}
      aria-hidden
    >
      <div className="ais-grid-bg absolute inset-0 opacity-60" />
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-ais-gold/20" />
      <div className="absolute -right-2 -top-2 h-28 w-28 rounded-full border border-ais-gold/30" />
      <Icon className="absolute right-6 top-6 h-12 w-12 text-ais-gold" strokeWidth={1.25} />
      <div className="relative w-full p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ais-gold/80">M.A.I.A. AI Masterclass</p>
        <p className="mt-1 font-display text-lg font-extrabold uppercase leading-tight text-ais-ivory">{course.shortTitle}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ais-gold/70 to-transparent" />
    </div>
  );
}

export function GoldRule({ className }: { className?: string }) {
  return <div className={clsx("h-px w-full bg-gradient-to-r from-transparent via-ais-gold/40 to-transparent", className)} />;
}
