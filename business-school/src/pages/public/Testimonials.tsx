import { MessageSquareQuote, PlayCircle, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Testimonial } from "@/lib/api";
import { EmptyState, PageHero, Spinner, VideoEmbed } from "@/components/ui";

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [filter, setFilter] = useState<"all" | "video" | "written">("all");
  const [playing, setPlaying] = useState<number | null>(null);
  useEffect(() => {
    api.get<Testimonial[]>("/api/public/testimonials").then(setItems).catch(() => setItems([]));
  }, []);
  const shown = (items ?? []).filter((t) =>
    filter === "all" ? true : filter === "video" ? !!t.videoUrl : !t.videoUrl,
  );

  return (
    <>
      <PageHero
        eyebrow="Testimonials"
        title="Real feedback from"
        gold="real students."
        sub="Unedited student feedback, workshop moments and student outputs — shared with each student's permission."
      />
      <div className="container-x">
        {items && items.length > 0 && (
          <div className="mb-8 flex gap-2">
            {(["all", "video", "written"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`btn ${filter === f ? "btn-gold" : "btn-outline"}`}>
                {f === "all" ? "All" : f === "video" ? "Video" : "Written"}
              </button>
            ))}
          </div>
        )}
        {!items ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState icon={MessageSquareQuote} title="Student stories are coming soon">
            We'll share real feedback, workshop photos and student outputs here as our first batches complete their
            workshops. Wala kaming ilalagay na hindi totoo — only real students, with their permission.
          </EmptyState>
        ) : (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {shown.map((t) => (
              <figure key={t.id} className="glass mb-5 break-inside-avoid overflow-hidden">
                {t.videoUrl &&
                  (playing === t.id ? (
                    <VideoEmbed url={t.videoUrl} title={`Testimonial from ${t.name}`} />
                  ) : (
                    <button
                      onClick={() => setPlaying(t.id)}
                      className="group relative block aspect-video w-full bg-[radial-gradient(80%_80%_at_50%_30%,#3f3626,#0a0908)]"
                      aria-label={`Play video testimonial from ${t.name}`}
                    >
                      {t.photoUrl && <img src={t.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
                      <PlayCircle className="relative mx-auto h-14 w-14 text-gold-bright transition group-hover:scale-110" strokeWidth={1.2} />
                    </button>
                  ))}
                <div className="p-6">
                  {!t.videoUrl && <Quote className="h-6 w-6 text-gold" />}
                  {t.quote && (
                    <blockquote className="mt-3 font-display leading-relaxed whitespace-pre-line text-ivory/90 italic">
                      “{t.quote}”
                    </blockquote>
                  )}
                  <figcaption className="mt-5 flex items-center gap-3">
                    {t.photoUrl && !t.videoUrl && (
                      <img src={t.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-gold/40" />
                    )}
                    <div className="text-sm">
                      <div className="font-semibold text-ivory">{t.name}</div>
                      <div className="text-muted">
                        {[t.role, t.courseTitle].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        )}
        <div className="glass mt-12 flex flex-col items-center justify-between gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div>
            <div className="font-semibold text-ivory">Student ka ng M.A.I.A.?</div>
            <div className="text-sm text-muted">We'd love to hear about your experience and what you built.</div>
          </div>
          <Link to="/contact?topic=Student%20feedback" className="btn btn-gold">
            Share your feedback
          </Link>
        </div>
      </div>
    </>
  );
}
