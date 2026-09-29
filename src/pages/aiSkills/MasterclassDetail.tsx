import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clock, Layers, Sprout } from "lucide-react";
import { FunnelLayout } from "@/components/aiSkills/FunnelLayout";
import { CourseCover, CtaLink, Eyebrow, GoldRule, Reveal } from "@/components/aiSkills/FunnelUi";
import { useFunnelCatalog } from "@/data/aiSkillsStore";
import { ALL_ACCESS_KEY, bundleMasterclasses, formatPeso, resolveProduct } from "@/utils/aiSkills";

export function MasterclassDetail() {
  const { slug } = useParams();
  const { catalog, loading } = useFunnelCatalog();
  const product = resolveProduct(catalog, slug);
  const course = product?.kind === "single" ? product.course : null;

  if (!course) {
    return (
      <FunnelLayout>
        <div className="mx-auto max-w-xl px-4 py-32 text-center">
          {loading ? (
            <p className="text-ais-muted">Loading masterclass…</p>
          ) : (
            <>
              <h1 className="font-display text-2xl font-extrabold uppercase text-ais-ivory">Masterclass not available</h1>
              <p className="mt-3 text-ais-muted">This masterclass may have been renamed or is not open for enrollment right now.</p>
              <CtaLink to="/ai-skills#library" className="mt-8">See all AI Masterclasses</CtaLink>
            </>
          )}
        </div>
      </FunnelLayout>
    );
  }

  const inBundle = bundleMasterclasses(catalog).some((c) => c.id === course.id);

  return (
    <FunnelLayout>
      <div className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 sm:pb-24">
        <Link to="/ai-skills#library" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ais-muted hover:text-ais-gold-pale">
          <ArrowLeft className="h-4 w-4" /> All masterclasses
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
          <Reveal>
            <CourseCover course={course} className="aspect-[16/9] rounded-3xl border border-ais-gold/25" />
            <Eyebrow className="mt-10">M.A.I.A. AI Masterclass</Eyebrow>
            <h1 className="mt-3 font-display text-3xl font-extrabold uppercase leading-[1.1] text-ais-ivory sm:text-4xl">{course.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-ais-muted">{course.description}</p>

            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-ais-ivory/85">
              <span className="flex items-center gap-2 rounded-full border border-ais-gold/30 px-4 py-2"><Sprout className="h-4 w-4 text-ais-gold" /> Beginner-friendly</span>
              <span className="flex items-center gap-2 rounded-full border border-ais-gold/30 px-4 py-2"><Clock className="h-4 w-4 text-ais-gold" /> Learn at your own pace</span>
              {course.modules.length > 0 && (
                <span className="flex items-center gap-2 rounded-full border border-ais-gold/30 px-4 py-2"><Layers className="h-4 w-4 text-ais-gold" /> {course.modules.length} modules</span>
              )}
            </div>

            {course.learnPoints.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-xl font-extrabold uppercase text-ais-ivory">What you will learn</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {course.learnPoints.map((p) => (
                    <li key={p} className="flex gap-3 rounded-xl border border-ais-gold/15 bg-ais-panel p-4 text-sm text-ais-ivory/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ais-gold" /> {p}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {course.modules.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-xl font-extrabold uppercase text-ais-ivory">Course content</h2>
                <ol className="mt-5 divide-y divide-ais-gold/10 rounded-2xl border border-ais-gold/15 bg-ais-panel">
                  {course.modules.map((m, i) => (
                    <li key={m} className="flex items-center gap-4 px-5 py-4 text-sm text-ais-ivory/90">
                      <span className="font-display text-base font-extrabold text-ais-gold">{String(i + 1).padStart(2, "0")}</span>
                      {m}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="mt-12 rounded-2xl border border-ais-gold/15 bg-gradient-to-br from-ais-panel to-ais-black p-6">
              <h2 className="font-display text-base font-extrabold uppercase text-ais-ivory">How you can use this skill</h2>
              <p className="mt-2 text-sm leading-relaxed text-ais-muted">
                Use it for your own business or personal projects, or build it into a service you can offer to businesses
                or clients. No existing business is required to enroll.
              </p>
            </section>
          </Reveal>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Reveal delay={100}>
              <div className="rounded-3xl border-2 border-ais-gold/70 bg-gradient-to-b from-ais-panel-2 to-ais-black p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-ais-muted">Single masterclass</p>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-extrabold text-ais-gold-pale">{formatPeso(course.price)}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-ais-muted">one-time</span>
                </p>
                <p className="mt-4 text-sm text-ais-ivory/85">You get access to this masterclass only.</p>
                <CtaLink to={`/ai-skills/checkout/${course.slug}`} className="mt-6 w-full">
                  Get This Masterclass — {formatPeso(course.price)}
                </CtaLink>
                <GoldRule className="my-7" />
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-ais-ivory">Want more than one AI skill?</p>
                <p className="mt-2 text-sm text-ais-muted">
                  {inBundle ? "This masterclass is included in " : "See "}
                  the M.A.I.A. AI Skills All-Access Bundle — {formatPeso(catalog.bundle.regularPrice)} regular price.
                </p>
                <CtaLink to={`/ai-skills/checkout/${ALL_ACCESS_KEY}`} variant="outline" className="mt-4 w-full">
                  Get All-Access Instead
                </CtaLink>
              </div>
            </Reveal>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ais-gold/25 bg-ais-black/95 p-3 backdrop-blur lg:hidden">
        <CtaLink to={`/ai-skills/checkout/${course.slug}`} className="w-full">
          Get This Masterclass — {formatPeso(course.price)}
        </CtaLink>
      </div>
    </FunnelLayout>
  );
}
