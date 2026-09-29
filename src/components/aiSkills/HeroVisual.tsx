import { Aperture, CalendarDays, Globe, Megaphone, Play, Sparkles, Video } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";

// Hero collage: five premium "studio panels" drawn in the parent-brand
// black/gold palette — AI video, photography, content, websites, and
// marketing creatives. Pure markup (no stock imagery), so it stays crisp
// on every screen and never looks like a generic AI template.

function Panel({ label, icon, className, children }: { label: string; icon: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-ais-gold/25 bg-gradient-to-br from-ais-panel-2 to-ais-black p-3 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-ais-gold sm:text-[10px]">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-hidden>
      <div className="absolute -inset-8 rounded-full bg-ais-gold/10 blur-3xl" />
      <div className="relative grid grid-cols-6 gap-3">
        {/* AI VIDEO */}
        <Panel label="AI Video" icon={<Video className="h-3 w-3" />} className="ais-float col-span-4 row-span-2">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-ais-bronze-dim via-ais-panel to-ais-black">
            <div className="absolute left-1/2 top-[28%] h-[34%] w-[22%] -translate-x-1/2 rounded-full bg-gradient-to-b from-ais-gold-pale/40 to-ais-bronze/40" />
            <div className="absolute bottom-0 left-1/2 h-[34%] w-[46%] -translate-x-1/2 rounded-t-[50%] bg-gradient-to-b from-ais-bronze/60 to-ais-bronze-dim/60" />
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-ais-black/70 px-1.5 py-0.5 text-[8px] font-bold text-ais-gold-pale">
              <span className="h-1.5 w-1.5 rounded-full bg-ais-gold-bright" /> AI TWIN
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ais-gold/70 bg-ais-black/60">
                <Play className="ml-0.5 h-4 w-4 fill-ais-gold text-ais-gold" />
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-end gap-[3px]">
            {[4, 7, 5, 9, 6, 11, 8, 5, 10, 7, 4, 8, 6, 9, 5, 7, 10, 6].map((h, i) => (
              <span key={i} className={clsx("w-full rounded-sm", i < 10 ? "bg-ais-gold" : "bg-ais-bronze")} style={{ height: h * 2 }} />
            ))}
          </div>
        </Panel>

        {/* AI PHOTOGRAPHY */}
        <Panel label="AI Photo" icon={<Aperture className="h-3 w-3" />} className="col-span-2">
          <div className="relative flex aspect-square items-end justify-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_30%,rgba(240,212,138,0.35),transparent_60%)]">
            <div className="mb-3 flex flex-col items-center">
              <span className="h-2 w-3 rounded-t-sm bg-ais-gold" />
              <span className="h-10 w-8 rounded-md bg-gradient-to-b from-ais-gold-pale to-ais-gold" />
            </div>
            <span className="absolute bottom-2 h-1 w-14 rounded-full bg-ais-black/60 blur-[2px]" />
          </div>
        </Panel>

        {/* AI CONTENT */}
        <Panel label="30-Day Content" icon={<CalendarDays className="h-3 w-3" />} className="ais-float col-span-2 [animation-delay:1.5s]">
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 15 }).map((_, i) => (
              <span
                key={i}
                className={clsx(
                  "aspect-square rounded-[3px]",
                  [0, 2, 3, 6, 8, 9, 12, 14].includes(i) ? "bg-ais-gold/80" : "bg-ais-bronze-dim",
                )}
              />
            ))}
          </div>
        </Panel>

        {/* AI WEBSITE */}
        <Panel label="AI Website" icon={<Globe className="h-3 w-3" />} className="col-span-3">
          <div className="overflow-hidden rounded-lg border border-ais-gold/20 bg-ais-black">
            <div className="flex gap-1 border-b border-ais-gold/15 px-2 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-ais-bronze" />
              <span className="h-1.5 w-1.5 rounded-full bg-ais-bronze" />
              <span className="h-1.5 w-1.5 rounded-full bg-ais-gold" />
            </div>
            <div className="space-y-1.5 p-2">
              <span className="block h-2 w-3/4 rounded bg-ais-gold/80" />
              <span className="block h-1.5 w-full rounded bg-ais-bronze-dim" />
              <span className="block h-1.5 w-5/6 rounded bg-ais-bronze-dim" />
              <span className="mt-2 block h-3 w-16 rounded bg-ais-gold" />
            </div>
          </div>
        </Panel>

        {/* AI MARKETING CREATIVE */}
        <Panel label="AI Creative" icon={<Megaphone className="h-3 w-3" />} className="ais-float col-span-3 [animation-delay:3s]">
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-ais-gold/90 to-ais-bronze p-2.5 text-ais-black">
            <p className="text-[8px] font-bold uppercase tracking-[0.2em]">New arrival</p>
            <p className="font-display text-sm font-extrabold uppercase leading-tight">Your product,<br />premium look</p>
            <span className="mt-2 inline-block rounded-full bg-ais-black px-2 py-0.5 text-[8px] font-bold text-ais-gold-pale">SHOP NOW</span>
            <Sparkles className="absolute right-2 top-2 h-4 w-4 text-ais-black/70" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
