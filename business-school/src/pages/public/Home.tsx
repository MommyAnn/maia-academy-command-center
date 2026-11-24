import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  MonitorPlay,
  Quote,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Testimonial } from "@/lib/api";
import { useSite } from "@/lib/context";
import { peso } from "@/lib/format";
import { CheckItem, CourseArt, Ornament, SectionHeading } from "@/components/ui";
import { ProgramCard } from "./ProgramCard";

export default function Home() {
  const { courses, site } = useSite();
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);
  useEffect(() => {
    api.get<Testimonial[]>("/api/public/testimonials").then(setTestimonials).catch(() => setTestimonials([]));
  }, []);
  const minSelf = courses?.length ? Math.min(...courses.map((c) => c.priceSelfPaced)) : 1499;
  const minGuided = courses?.length ? Math.min(...courses.map((c) => c.priceGuided)) : 4999;

  return (
    <>
      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden">
        <div className="container-x grid items-center gap-12 pt-14 pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:pt-20">
          <div>
            <span className="eyebrow">M.A.I.A. Business Solutions Academy</span>
            <h1 className="h-display mt-6 text-[2.6rem] text-ivory sm:text-6xl">
              Practical business skills, <span className="text-gold-grad">with proper guidance.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ivory/80">
              A school for aspiring entrepreneurs and business owners. Matuto ng AI creatives, Facebook Ads, automation,
              Claude at website creation — step by step, para mabawasan ang magastos na trial and error.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/courses" className="btn btn-gold btn-lg">
                Explore the workshops <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#program" className="btn btn-outline btn-lg">
                See the complete program
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ivory/75">
              <li className="flex items-center gap-2">
                <MonitorPlay className="h-4 w-4 text-gold" /> Self-paced or guided
              </li>
              <li className="flex items-center gap-2">
                <Video className="h-4 w-4 text-gold" /> Zoom workshops first
              </li>
              <li className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-gold" /> One-time payment, no subscription
              </li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(214,165,36,0.28),transparent)] blur-2xl" />
            <figure className="glass relative overflow-hidden p-2">
              <img
                src="/brand/founder-mommy-ann.jpg"
                alt="Mommy Ann, founder of M.A.I.A. Business Solutions Academy"
                className="aspect-[4/5] w-full rounded-[1rem] object-cover object-top"
              />
              <figcaption className="absolute inset-x-2 bottom-2 rounded-b-[1rem] bg-gradient-to-t from-ink via-ink/85 to-transparent px-6 pt-16 pb-5">
                <div className="font-script text-4xl text-gold-pale">Mommy Ann</div>
                <div className="mt-1 text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                  Founder & Business Mentor
                </div>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ───── Principle ───── */}
      <section className="border-y border-gold/15 bg-ink-2/70">
        <div className="container-x py-14 text-center">
          <Ornament />
          <p className="h-display mx-auto mt-6 max-w-4xl text-2xl leading-snug text-ivory sm:text-3xl">
            It's not just about learning AI tools.{" "}
            <span className="text-gold-grad">It's about learning how to use them strategically and practically.</span>
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-muted">
            AI is a tool — it becomes valuable when you know how to use it correctly for your own business. Kaya dito,
            hindi ka lang manonood. Magpa-practice ka, at gagawa ka ng output na magagamit mo.
          </p>
        </div>
      </section>

      {/* ───── Workshops ───── */}
      <section className="container-x py-20">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="The workshops"
            title="Five practical skills for"
            gold="today's business."
            sub="Each workshop is available as a recorded self-paced course or as an instructor-guided workshop via Zoom."
          />
          <Link to="/courses" className="btn btn-outline shrink-0">
            View all courses <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(courses ?? []).map((c, i) => (
            <Link
              key={c.id}
              to={`/courses/${c.slug}`}
              className="glass group overflow-hidden transition hover:-translate-y-1 hover:border-gold/60"
            >
              <div className="relative aspect-[16/8]">
                <CourseArt title={c.title} icon={c.icon} coverImage={c.coverImage} index={i} />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                  <div className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">Workshop {i + 1}</div>
                  <h3 className="h-display mt-1 text-2xl text-ivory">{c.title}</h3>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm leading-relaxed text-ivory/75">{c.tagline}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="badge badge-muted">Self-paced {peso(c.priceSelfPaced)}</span>
                  <span className="badge badge-gold">Guided {peso(c.priceGuided)}</span>
                </div>
              </div>
            </Link>
          ))}
          {courses && courses.length < 6 && (
            <a href="#program" className="glass flex flex-col justify-center gap-3 p-6 transition hover:border-gold/60">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">All five, guided</span>
              <h3 className="h-display text-2xl text-ivory">Complete Business Solutions Program</h3>
              <p className="text-sm text-muted">One program, all five guided workshops, in a proposed 30-day learning journey.</p>
              <span className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-gold-bright">
                See program details <ArrowRight className="h-4 w-4" />
              </span>
            </a>
          )}
        </div>
      </section>

      {/* ───── Learning options ───── */}
      <section className="container-x pb-20">
        <SectionHeading
          center
          eyebrow="Learning options"
          title="Choose how you"
          gold="want to learn."
          sub="Same practical topics, two ways to learn — plus a complete program if you want all five workshops guided."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <OptionCard
            icon={MonitorPlay}
            name="Recorded Mini Course"
            price={`${peso(minSelf)}`}
            per="per course · one-time"
            points={[
              "Recorded lessons you can watch at your own pace",
              "Access through your Student Portal",
              "Track your lesson progress",
              "Available per course once its recordings are ready",
            ]}
          />
          <OptionCard
            featured
            icon={Users}
            name="Guided Workshop"
            price={`${peso(minGuided)}`}
            per="per workshop · one-time"
            points={[
              "Instructor-guided workshop via Zoom",
              "Scheduled batches, subject to available capacity",
              "Practice activities and a practical output",
              "Face-to-face sessions once our training center opens",
            ]}
          />
          <OptionCard
            icon={GraduationCap}
            name="Complete Program"
            price={site ? peso(site.program.price) : "₱15,000"}
            per="all five guided workshops · one-time"
            points={[
              "AI Creatives, Facebook Ads, Automation, Claude & Website Creation",
              "Proposed 30-day guided learning journey",
              site ? `Save ${peso(site.program.savings)} vs. five individual workshops` : "Bundle savings",
            ]}
            href="#program"
          />
        </div>
      </section>

      {/* ───── Complete program ───── */}
      <section id="program" className="scroll-mt-24 border-y border-gold/15 bg-ink-2/60 py-20">
        <div className="container-x">
          <ProgramCard />
        </div>
      </section>

      {/* ───── How it works ───── */}
      <section className="container-x py-20">
        <SectionHeading center eyebrow="How it works" title="Step by step," gold="walang hulaan." />
        <ol className="mt-12 grid gap-5 md:grid-cols-4">
          {[
            { icon: BookOpenCheck, t: "Choose your workshop", d: "Pick the skill your business needs right now — or take all five." },
            { icon: ClipboardList, t: "Choose your format", d: "Self-paced recordings, or a guided workshop via Zoom." },
            { icon: GraduationCap, t: "Get portal access", d: "Once your enrollment is confirmed, your course appears in your Student Portal." },
            { icon: CalendarClock, t: "Learn, practice, build", d: "Follow the lessons and workshop schedule, and work on a practical output." },
          ].map((s, i) => (
            <li key={s.t} className="glass p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-bright">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-sm text-gold">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-ivory">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───── Founder ───── */}
      <section className="container-x pb-20">
        <div className="glass grid items-center gap-10 overflow-hidden p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr]">
          <img
            src="/brand/founder-mommy-ann.jpg"
            alt="Mommy Ann"
            className="aspect-square w-full rounded-2xl object-cover object-top"
            loading="lazy"
          />
          <div>
            <span className="eyebrow">Meet your mentor</span>
            <h2 className="h-display mt-4 text-3xl text-ivory sm:text-4xl">
              Hindi ka mag-iisa. <span className="text-gold-grad">May gabay ka.</span>
            </h2>
            <p className="mt-5 leading-relaxed text-ivory/80">
              Mommy Ann is the founder of Mommy Ann Import Academy and M.A.I.A. Business Solutions Academy. She teaches
              and guides business owners through practical business education — importation, AI, marketing and
              business-building systems.
            </p>
            <p className="mt-4 leading-relaxed text-ivory/80">
              M.A.I.A. Business Solutions Academy was created as a school for entrepreneurs: a place where students can
              develop practical skills and receive step-by-step guidance, instead of figuring everything out alone.
            </p>
            <div className="mt-6 font-script text-4xl text-gold-pale">Mommy Ann</div>
            <p className="mt-6 text-xs font-semibold tracking-[0.3em] text-gold uppercase">Import • Learn • Build • Grow</p>
          </div>
        </div>
      </section>

      {/* ───── Testimonials ───── */}
      <section className="container-x pb-20">
        <SectionHeading center eyebrow="Student feedback" title="Real feedback," gold="from real students." />
        {testimonials && testimonials.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.slice(0, 3).map((t) => (
              <figure key={t.id} className="glass p-6">
                <Quote className="h-6 w-6 text-gold" />
                <blockquote className="mt-3 font-display text-lg leading-relaxed text-ivory/90 italic">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-ivory">{t.name}</span>
                  {t.role && <span className="text-muted"> · {t.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="placeholder-note mx-auto mt-8 max-w-xl text-center">
            Student testimonials and workshop photos will be posted here as our first batches complete their workshops.
          </div>
        )}
        <div className="mt-8 text-center">
          <Link to="/testimonials" className="btn btn-outline">
            View testimonials <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="container-x pb-8">
        <SectionHeading center eyebrow="FAQ" title="Questions before" gold="you enroll." />
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="glass group p-5 open:border-gold/50">
              <summary className="cursor-pointer list-none font-semibold text-ivory marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span className="text-gold transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}

function OptionCard({
  icon: Icon,
  name,
  price,
  per,
  points,
  featured,
  href = "/courses",
}: {
  icon: typeof Users;
  name: string;
  price: string;
  per: string;
  points: string[];
  featured?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      {featured && <span className="badge badge-gold absolute top-5 right-5">Most guidance</span>}
      <Icon className="h-7 w-7 text-gold-bright" strokeWidth={1.5} />
      <h3 className="mt-4 font-display text-xl text-ivory">{name}</h3>
      <div className="mt-3 font-display text-4xl text-gold-grad">{price}</div>
      <div className="mt-1 text-xs text-muted">{per}</div>
      <ul className="mt-6 space-y-3">
        {points.map((p) => (
          <CheckItem key={p}>{p}</CheckItem>
        ))}
      </ul>
    </>
  );
  const cls = `glass relative block p-7 transition hover:-translate-y-1 ${featured ? "border-gold/60 shadow-[0_0_60px_-20px_rgba(214,165,36,0.5)]" : ""}`;
  return href.startsWith("#") ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link to={href} className={cls}>
      {inner}
    </Link>
  );
}

const FAQ = [
  {
    q: "What's the difference between Self-Paced and Guided?",
    a: "Self-Paced (₱1,499 per course) gives you recorded lessons to watch on your own schedule in the Student Portal. Guided (₱4,999 per workshop) is an instructor-guided workshop via Zoom, scheduled in batches. Face-to-face workshops will become available once our physical training center is operational.",
  },
  {
    q: "Is this a monthly subscription?",
    a: "No. All prices are one-time payments. There is no monthly subscription in our current offer.",
  },
  {
    q: "What does the ₱15,000 Complete Program include?",
    a: "The five guided workshops — AI Creatives, Facebook Ads, Automation, Claude and Website Creation — designed around a proposed 30-day guided learning journey. It is not an unlimited all-access membership; recording access periods and the live session calendar are announced per batch.",
  },
  {
    q: "Kailangan ko ba ng experience?",
    a: "The workshops are designed for aspiring entrepreneurs, business owners, online sellers and beginners learning digital business skills. Each course page lists what it covers and the learning objectives so you can check if it fits you.",
  },
  {
    q: "Are the AI tools and software included?",
    a: "No. The workshops may discuss tools such as Claude, Canva, Google AI tools, Meta Ads Manager, automation platforms and website builders. These are third-party products — some features may require your own account or paid subscription, which is not included in the course price.",
  },
  {
    q: "Will I earn money after the course?",
    a: "We teach practical skills and you'll work toward a useful business output, but we don't promise income or business results. Your results depend on your own effort, products, market and decisions.",
  },
  {
    q: "What is your refund policy?",
    a: "Please see our Refund & Rescheduling Policy page. If you have questions before enrolling, send us an inquiry and our team will assist you.",
  },
];

export function CtaBand() {
  return (
    <section className="container-x pt-16">
      <div className="glass relative overflow-hidden px-6 py-14 text-center sm:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(214,165,36,0.18),transparent)]" />
        <div className="relative">
          <Ornament />
          <h2 className="h-display mt-6 text-3xl text-ivory sm:text-4xl">
            Ready to learn with <span className="text-gold-grad">proper guidance?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            May tanong ka pa? Send us a message and our team will help you choose the right workshop or format.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/courses" className="btn btn-gold btn-lg">
              Browse courses
            </Link>
            <Link to="/contact" className="btn btn-outline btn-lg">
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

