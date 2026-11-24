import { ArrowRight, ChevronLeft, ChevronRight, MonitorPlay, Play, Users } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Course } from "@/lib/api";
import { useSite } from "@/lib/context";
import { peso } from "@/lib/format";
import { CourseArt, EmptyState, Spinner } from "@/components/ui";
import { ProgramCard } from "./ProgramCard";

export default function Courses() {
  const { courses } = useSite();
  const [featuredIdx, setFeaturedIdx] = useState(0);
  if (!courses) return <Spinner />;
  if (courses.length === 0)
    return (
      <div className="container-x py-20">
        <EmptyState title="Courses are being prepared">New workshops will be published here soon.</EmptyState>
      </div>
    );
  const featured = courses[featuredIdx % courses.length];

  return (
    <div className="pb-4">
      {/* Featured banner */}
      <section className="relative isolate overflow-hidden border-b border-gold/15">
        <div className="absolute inset-0 -z-10">
          <CourseArt title={featured.title} icon={featured.icon} coverImage={featured.coverImage} index={featuredIdx} size="lg" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
        </div>
        <div className="container-x flex min-h-[460px] flex-col justify-end py-14">
          <span className="eyebrow w-fit">Course library</span>
          <div className="mt-5 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            Featured · Workshop {featuredIdx + 1} of {courses.length}
          </div>
          <h1 className="h-display mt-2 max-w-2xl text-4xl text-ivory sm:text-6xl">{featured.title}</h1>
          <p className="mt-4 max-w-xl text-lg text-ivory/80">{featured.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <span className="badge badge-muted">
              <MonitorPlay className="h-3.5 w-3.5" /> Self-paced {peso(featured.priceSelfPaced)}
            </span>
            <span className="badge badge-gold">
              <Users className="h-3.5 w-3.5" /> Guided via Zoom {peso(featured.priceGuided)}
            </span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={`/courses/${featured.slug}`} className="btn btn-gold btn-lg">
              <Play className="h-4 w-4 fill-current" /> View course
            </Link>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => setFeaturedIdx((i) => (i + 1) % courses.length)}
              aria-label="Show next featured course"
            >
              Next featured <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <Row title="All workshops" sub="Five practical business skills — each available self-paced or guided.">
        {courses.map((c, i) => (
          <PosterCard key={c.id} course={c} index={i} />
        ))}
      </Row>

      <Row
        title="Learn at your own pace"
        sub={`Recorded mini courses · ${peso(Math.min(...courses.map((c) => c.priceSelfPaced)))} per course`}
      >
        {courses.map((c, i) => (
          <PosterCard key={c.id} course={c} index={i} format="self_paced" />
        ))}
      </Row>

      <Row
        title="Guided workshops via Zoom"
        sub={`Instructor-guided, scheduled batches · ${peso(Math.min(...courses.map((c) => c.priceGuided)))} per workshop`}
      >
        {courses.map((c, i) => (
          <PosterCard key={c.id} course={c} index={i} format="guided" />
        ))}
      </Row>

      <section className="container-x mt-16">
        <div className="glass p-6 sm:p-10">
          <ProgramCard />
        </div>
      </section>
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="mt-12">
      <div className="container-x flex items-end justify-between gap-4">
        <div>
          <h2 className="h-display text-2xl text-ivory">{title}</h2>
          <p className="mt-1 text-sm text-muted">{sub}</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button className="btn btn-outline h-9 w-9 p-0" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="btn btn-outline h-9 w-9 p-0" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 sm:scroll-px-6 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]"
      >
        {children}
      </div>
    </section>
  );
}

function PosterCard({ course: c, index, format }: { course: Course; index: number; format?: "self_paced" | "guided" }) {
  const price = format === "guided" ? c.priceGuided : c.priceSelfPaced;
  return (
    <Link
      to={`/courses/${c.slug}${format ? `#${format === "guided" ? "guided" : "self-paced"}` : ""}`}
      className="group relative w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border border-gold/20 bg-ink-2 transition duration-300 hover:z-10 hover:scale-[1.03] hover:border-gold/60 hover:shadow-[0_20px_60px_-20px_rgba(214,165,36,0.45)] sm:w-[340px]"
    >
      <div className="relative aspect-video">
        <CourseArt title={c.title} icon={c.icon} coverImage={c.coverImage} index={index} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
        <span className="absolute top-3 left-3 rounded-md bg-ink/70 px-2 py-1 font-display text-xs text-gold-pale backdrop-blur">
          {String(index + 1).padStart(2, "0")}
        </span>
        {format && (
          <span className={`absolute top-3 right-3 badge ${format === "guided" ? "badge-gold" : "badge-muted"} bg-ink/70`}>
            {format === "guided" ? "Guided" : "Self-paced"}
          </span>
        )}
        <h3 className="absolute right-4 bottom-3 left-4 font-display text-xl text-ivory">{c.title}</h3>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="line-clamp-1 text-xs text-muted">{c.topics.slice(0, 3).join(" · ")}</p>
        <span className="shrink-0 font-display text-sm text-gold-bright">
          {format ? peso(price) : `from ${peso(Math.min(c.priceSelfPaced, c.priceGuided))}`}
        </span>
      </div>
    </Link>
  );
}
