import { CalendarClock, ChevronDown, Lock, MapPin, MonitorPlay, PlayCircle, Target, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type CourseDetail as TCourse } from "@/lib/api";
import { useSite } from "@/lib/context";
import { formatDateTime, MODE_LABEL, peso } from "@/lib/format";
import { CheckItem, CheckoutButton, CourseArt, EmptyState, Spinner, StatusBadge, VideoEmbed } from "@/components/ui";
import { CtaBand } from "./Home";

export default function CourseDetail() {
  const { slug } = useParams();
  const { courses, site } = useSite();
  const [course, setCourse] = useState<TCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    setCourse(null);
    setError(null);
    api
      .get<TCourse>(`/api/public/courses/${slug}`)
      .then(setCourse)
      .catch((e: ApiError) => setError(e.message));
  }, [slug]);

  if (error)
    return (
      <div className="container-x py-20">
        <EmptyState title="Course not found">
          <Link to="/courses" className="btn btn-outline mt-4">
            Back to courses
          </Link>
        </EmptyState>
      </div>
    );
  if (!course) return <Spinner />;

  const index = courses?.findIndex((c) => c.id === course.id) ?? 0;
  const lessonCount = course.outline.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-gold/15">
        <div className="absolute inset-0 -z-10">
          <CourseArt title={course.title} icon={course.icon} coverImage={course.coverImage} index={index} size="lg" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/30" />
        </div>
        <div className="container-x py-16">
          <Link to="/courses" className="text-sm text-gold hover:text-gold-pale">
            ← All courses
          </Link>
          <div className="mt-6 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            M.A.I.A. Workshop {index + 1}
          </div>
          <h1 className="h-display mt-2 max-w-3xl text-4xl text-ivory sm:text-5xl">{course.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ivory/80">{course.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#self-paced" className="badge badge-muted">
              <MonitorPlay className="h-3.5 w-3.5" /> Self-paced {peso(course.priceSelfPaced)}
            </a>
            <a href="#guided" className="badge badge-gold">
              <Users className="h-3.5 w-3.5" /> Guided workshop {peso(course.priceGuided)}
            </a>
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-14 lg:grid-cols-[1fr_380px]">
        {/* Main */}
        <div className="space-y-12">
          <section>
            <h2 className="h-display text-2xl text-ivory">About this workshop</h2>
            <p className="mt-4 leading-relaxed whitespace-pre-line text-ivory/80">{course.description}</p>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="glass p-6">
              <h3 className="flex items-center gap-2 font-semibold text-ivory">
                <Target className="h-4 w-4 text-gold-bright" /> What this course covers
              </h3>
              <ul className="mt-4 space-y-2.5">
                {course.topics.map((t) => (
                  <CheckItem key={t}>{t}</CheckItem>
                ))}
              </ul>
            </div>
            <div className="glass p-6">
              <h3 className="flex items-center gap-2 font-semibold text-ivory">
                <Target className="h-4 w-4 text-gold-bright" /> Learning objective
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-ivory/85">{course.outcome}</p>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                This is an intended practical learning activity, not a guaranteed business result.
              </p>
              {course.tools.length > 0 && (
                <>
                  <h3 className="mt-6 flex items-center gap-2 font-semibold text-ivory">
                    <Wrench className="h-4 w-4 text-gold-bright" /> Tools we may discuss
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {course.tools.map((t) => (
                      <span key={t} className="badge badge-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    Third-party software subscriptions are not included in the course price.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Clear training inclusions */}
          <section>
            <h2 className="h-display text-2xl text-ivory">Training inclusions</h2>
            <p className="mt-2 text-sm text-muted">Exactly what you get with each learning format.</p>
            <div className="glass mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gold/20 text-xs tracking-[0.12em] text-gold uppercase">
                    <th className="px-5 py-4 font-semibold"> </th>
                    <th className="px-5 py-4 font-semibold">Self-paced</th>
                    <th className="px-5 py-4 font-semibold">Guided workshop</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10 text-ivory/85">
                  <tr>
                    <td className="px-5 py-3.5 text-muted">Price (one-time)</td>
                    <td className="px-5 py-3.5 font-semibold">{peso(course.priceSelfPaced)}</td>
                    <td className="px-5 py-3.5 font-semibold">{peso(course.priceGuided)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5 text-muted">Learning format</td>
                    <td className="px-5 py-3.5">Recorded lessons in the Student Portal</td>
                    <td className="px-5 py-3.5">Instructor-guided via Zoom (face-to-face later)</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5 text-muted">Recorded lessons</td>
                    <td className="px-5 py-3.5">Included</td>
                    <td className="px-5 py-3.5">{course.guidedIncludesRecordings ? "Included" : "Not included"}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5 text-muted">Live workshop</td>
                    <td className="px-5 py-3.5">—</td>
                    <td className="px-5 py-3.5">Scheduled batch, subject to capacity</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5 text-muted">Course content</td>
                    <td className="px-5 py-3.5" colSpan={2}>
                      {lessonCount > 0 ? `${course.outline.length} module(s) · ${lessonCount} lesson(s) so far` : "Curriculum to be announced"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5 text-muted">Access details</td>
                    <td className="px-5 py-3.5" colSpan={2}>
                      {course.accessNote || "To be announced."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5 text-muted">Enrollment</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={course.selfPacedStatus} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={course.guidedStatus} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Curriculum */}
          <section>
            <h2 className="h-display text-2xl text-ivory">Curriculum</h2>
            <p className="mt-2 text-sm text-muted">
              Module and lesson details are being finalized and will be updated here.
            </p>
            <div className="mt-5 space-y-3">
              {course.outline.map((m, i) => (
                <details key={m.id} className="glass group overflow-hidden" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
                    <span>
                      <span className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Module {i + 1}</span>
                      <span className="mt-1 block font-semibold text-ivory">{m.title}</span>
                    </span>
                    <ChevronDown className="h-5 w-5 text-gold transition group-open:rotate-180" />
                  </summary>
                  <ul className="border-t border-gold/10">
                    {m.lessons.length === 0 && <li className="px-5 py-3 text-sm text-muted">Lessons to be announced.</li>}
                    {m.lessons.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 border-b border-gold/5 px-5 py-3 text-sm last:border-0">
                        <span className="flex items-center gap-3 text-ivory/85">
                          {l.isPreview && l.previewVideoUrl ? (
                            <PlayCircle className="h-4 w-4 text-gold-bright" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted" />
                          )}
                          {l.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                          {l.durationLabel}
                          {l.isPreview && l.previewVideoUrl && (
                            <button className="badge badge-gold" onClick={() => setPreview({ title: l.title, url: l.previewVideoUrl })}>
                              Free preview
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
            {preview && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ivory">Preview: {preview.title}</span>
                  <button className="text-gold" onClick={() => setPreview(null)}>
                    Close
                  </button>
                </div>
                <VideoEmbed url={preview.url} title={preview.title} />
              </div>
            )}
          </section>

          {/* Schedule */}
          <section id="schedule">
            <h2 className="h-display text-2xl text-ivory">Workshop schedule</h2>
            {course.batches.length === 0 ? (
              <div className="placeholder-note mt-4">
                <CalendarClock className="mr-2 inline h-4 w-4 text-gold" />
                No guided batch is scheduled yet. {course.scheduleNote}
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {course.batches.map((b) => (
                  <div key={b.id} className="glass flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
                    <div>
                      <div className="font-semibold text-ivory">{b.title}</div>
                      <div className="mt-1 text-sm text-muted">
                        {b.startsAt ? formatDateTime(b.startsAt) : "Date to be announced"}
                        {b.scheduleText && ` · ${b.scheduleText}`}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <MapPin className="h-3 w-3" /> {MODE_LABEL[b.mode]}
                        {b.location && ` · ${b.location}`}
                      </div>
                    </div>
                    <span className={`badge ${b.status === "full" ? "badge-muted" : "badge-success"}`}>
                      {b.status === "full" ? "Batch full" : "Open for enrollment"}
                    </span>
                  </div>
                ))}
                {course.scheduleNote && <p className="text-xs text-muted">{course.scheduleNote}</p>}
              </div>
            )}
          </section>
        </div>

        {/* Pricing sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <PriceCard
            id="self-paced"
            icon={MonitorPlay}
            name="Self-Paced Course"
            price={course.priceSelfPaced}
            status={course.selfPacedStatus}
            points={["Recorded lessons", "Learn anytime in the Student Portal", "Lesson progress tracking"]}
            checkout={
              <CheckoutButton
                checkoutUrl={course.checkoutSelfPaced}
                status={course.selfPacedStatus}
                inquireTopic={`${course.title} — Self-paced`}
                label={`Enroll self-paced — ${peso(course.priceSelfPaced)}`}
                tracking={{ offer: course.slug, format: "self_paced", value: course.priceSelfPaced }}
                variant="outline"
              />
            }
          />
          <PriceCard
            id="guided"
            featured
            icon={Users}
            name="Guided Workshop"
            price={course.priceGuided}
            status={course.guidedStatus}
            points={[
              "Instructor-guided workshop via Zoom",
              "Scheduled batch, subject to capacity",
              ...(course.guidedIncludesRecordings ? ["Includes the recorded lessons"] : []),
              "Face-to-face once our training center opens",
            ]}
            checkout={
              <CheckoutButton
                checkoutUrl={course.checkoutGuided}
                status={course.guidedStatus}
                inquireTopic={`${course.title} — Guided workshop`}
                label={`Enroll in guided — ${peso(course.priceGuided)}`}
                tracking={{ offer: course.slug, format: "guided", value: course.priceGuided }}
              />
            }
          />
          {site && (
            <Link to="/#program" className="glass block p-5 text-sm transition hover:border-gold/60">
              <span className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Want all five?</span>
              <span className="mt-1 block font-semibold text-ivory">
                Complete program — {peso(site.program.price)}
              </span>
              <span className="mt-1 block text-muted">
                All {site.program.courseCount} guided workshops. Save {peso(site.program.savings)}.
              </span>
            </Link>
          )}
          <p className="px-1 text-xs leading-relaxed text-muted">
            One-time payment. Please read our{" "}
            <Link to="/policies/terms" className="text-gold underline-offset-2 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/policies/refund" className="text-gold underline-offset-2 hover:underline">
              Refund Policy
            </Link>{" "}
            before enrolling.
          </p>
        </aside>
      </div>
      <CtaBand />
    </>
  );
}

function PriceCard({
  id,
  icon: Icon,
  name,
  price,
  status,
  points,
  checkout,
  featured,
}: {
  id: string;
  icon: typeof Users;
  name: string;
  price: number;
  status: "coming_soon" | "open" | "closed";
  points: string[];
  checkout: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div id={id} className={`glass scroll-mt-28 p-6 ${featured ? "border-gold/60 shadow-[0_0_60px_-25px_rgba(214,165,36,0.6)]" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold text-ivory">
          <Icon className="h-4 w-4 text-gold-bright" /> {name}
        </span>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 font-display text-4xl text-gold-grad">{peso(price)}</div>
      <div className="text-xs text-muted">one-time payment</div>
      <ul className="mt-5 space-y-2.5">
        {points.map((p) => (
          <CheckItem key={p}>{p}</CheckItem>
        ))}
      </ul>
      <div className="mt-6">{checkout}</div>
    </div>
  );
}
