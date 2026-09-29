import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  Clock,
  GraduationCap,
  Hammer,
  Lightbulb,
  Rocket,
  ShieldCheck,
  Sprout,
  Store,
  Tag,
  TrendingUp,
  UserRound,
  Users,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { FunnelLayout } from "@/components/aiSkills/FunnelLayout";
import { CourseCard } from "@/components/aiSkills/CourseCard";
import { HeroVisual } from "@/components/aiSkills/HeroVisual";
import { CtaLink, Eyebrow, GoldRule, Reveal, SectionHeading } from "@/components/aiSkills/FunnelUi";
import { useFunnelCatalog } from "@/data/aiSkillsStore";
import { CORE_MESSAGE } from "@/data/aiSkillsConfig";
import { ALL_ACCESS_KEY, bundleMasterclasses, formatPeso, publicMasterclasses, startingPrice } from "@/utils/aiSkills";

const AUDIENCES: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "Aspiring Freelancers", body: "Learn practical AI skills that can become services you offer to clients.", icon: Briefcase },
  { title: "Business Owners", body: "Use AI to create content, creatives and marketing assets for your own business.", icon: TrendingUp },
  { title: "Content Creators", body: "Improve and accelerate your creative workflow using AI.", icon: Wand2 },
  { title: "Online Sellers", body: "Create product content, promotional assets and marketing materials.", icon: Store },
  { title: "Beginners", body: "Start developing practical AI skills even without previous experience.", icon: Sprout },
  { title: "Service Providers", body: "Add AI-powered creative services to your existing skills.", icon: Wrench },
  { title: "Aspiring Entrepreneurs", body: "Develop digital skills before or while building your business.", icon: Rocket },
];

const PROGRESSION: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "Learn", body: "Understand practical AI tools and workflows.", icon: BookOpen },
  { title: "Create", body: "Create videos, images, content, websites and marketing assets.", icon: Wand2 },
  { title: "Use", body: "Apply the skills to your own projects or business.", icon: Hammer },
  { title: "Offer", body: "Turn selected skills into services you can offer.", icon: Users },
  { title: "Grow", body: "Continue building your digital skillset and opportunities.", icon: TrendingUp },
];

const HOW_IT_WORKS = [
  { title: "Choose", body: "Choose one AI skill or the All-Access Bundle." },
  { title: "Enroll", body: "Complete your details and payment." },
  { title: "Learn", body: "Access your selected AI training." },
  { title: "Create", body: "Practice what you learn through actual projects." },
  { title: "Apply", body: "Use your new skills for your own projects, business or services." },
];

const CHANGING = [
  "create content",
  "produce videos",
  "design marketing materials",
  "build websites",
  "market businesses",
  "serve clients",
];

function CoreMessageStrip() {
  return (
    <div className="border-y border-ais-gold/20 bg-ais-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-5 sm:gap-x-10">
        {CORE_MESSAGE.map((line, i) => (
          <span key={line} className="flex items-center gap-6 sm:gap-10">
            <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-ais-ivory sm:text-base">
              <span className="text-ais-gold">{line.split(" ")[0]}</span> {line.split(" ").slice(1).join(" ")}
            </span>
            {i < CORE_MESSAGE.length - 1 && <span className="hidden h-1.5 w-1.5 rotate-45 bg-ais-gold sm:block" />}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SalesPage() {
  const { catalog, loading } = useFunnelCatalog();
  const courses = publicMasterclasses(catalog);
  const included = bundleMasterclasses(catalog);
  const fromPrice = startingPrice(catalog);
  const bundlePrice = catalog.bundle.regularPrice;
  const campaign = catalog.bundle.campaign;

  const faqs: { q: string; a: string }[] = [
    { q: "Do I need to own a business?", a: "No. You can learn these skills even if you do not currently own a business." },
    { q: "Can beginners join?", a: "Yes. The masterclasses are designed to provide practical, step-by-step learning." },
    { q: "Can I purchase only one masterclass?", a: `Yes. Choose the specific AI Masterclass you want for ${formatPeso(fromPrice)}.` },
    {
      q: "What if I want all the AI masterclasses?",
      a: `Choose the M.A.I.A. AI Skills All-Access Bundle for ${formatPeso(bundlePrice)} regular price.`,
    },
    {
      q: "Can I use a discount code?",
      a: "Yes, when a valid promotional discount code is available and supported by the checkout. You apply it on the secure payment step, and the discount shown there is the one that applies.",
    },
    {
      q: "Does All-Access include every future AI course?",
      a: "No. All-Access includes the AI Masterclasses currently specified as part of the bundle. We do not promise that future courses will be added automatically.",
    },
    {
      q: "How will I access my training?",
      a: "After successful enrollment and payment, you will receive your course access instructions by email, and you can open your training from your M.A.I.A. AI Skills dashboard.",
    },
    {
      q: "Is this the same as M.A.I.A. Business Solutions Academy?",
      a: "No. M.A.I.A. AI Skills Academy is skills-based training you can join even without a business. M.A.I.A. Business Solutions Academy (Level 1, Level 2 and Level 3 / Build With You) is our separate business-building, marketing, automation and systems program.",
    },
    {
      q: "Will I earn money from these skills?",
      a: "We teach practical skills you can use for your own projects or potentially offer as services. We do not guarantee income or specific earnings — results depend on your effort, practice and how you apply what you learn.",
    },
  ];

  return (
    <FunnelLayout>
      {/* 01 — HERO */}
      <section className="relative overflow-hidden">
        <div className="ais-grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-ais-gold/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
          <Reveal>
            <Eyebrow>M.A.I.A. Business Solutions Academy presents</Eyebrow>
            <p className="mt-6 font-display text-2xl font-extrabold uppercase tracking-[0.12em] text-ais-ivory sm:text-3xl">
              M.A.I.A.
              <span className="ais-gold-text block text-4xl tracking-[0.04em] sm:text-5xl">AI Skills Academy™</span>
            </p>
            <GoldRule className="my-7 max-w-xs !bg-gradient-to-r !from-ais-gold !via-ais-gold/40 !to-transparent" />
            <h1 className="font-display text-[1.7rem] font-extrabold uppercase leading-[1.12] text-ais-ivory sm:text-4xl lg:text-[2.6rem]">
              Build AI skills you can use for business —{" "}
              <span className="text-ais-gold-pale">or turn into services you can offer.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ais-muted sm:text-lg">
              Learn practical, step-by-step AI skills for content, videos, creatives, websites and digital marketing—even
              if you’re starting from zero.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaLink to="#library" className="sm:whitespace-nowrap">
                Explore AI Masterclasses <ArrowRight className="h-4 w-4" />
              </CtaLink>
              <CtaLink to="#all-access" variant="outline" className="sm:whitespace-nowrap">
                Get AI Skills All-Access
              </CtaLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-ais-muted">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ais-gold" /> Beginner-friendly</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ais-gold" /> No business required</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ais-gold" /> From {formatPeso(fromPrice)}</li>
            </ul>
          </Reveal>
          <Reveal delay={150}>
            <HeroVisual />
          </Reveal>
        </div>
      </section>

      <CoreMessageStrip />

      {/* 02 — WHO THIS IS FOR */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          index="02"
          eyebrow="Who this is for"
          title={<>You don’t need a business <span className="text-ais-gold">to start.</span></>}
          subtitle="Whether you’re building skills for yourself, your business or future clients, you can start with one practical AI skill."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delay={(i % 4) * 80} className={i === AUDIENCES.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""}>
              <div className="h-full rounded-2xl border border-ais-gold/15 bg-gradient-to-b from-ais-panel to-ais-black p-6 transition-colors hover:border-ais-gold/50">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ais-gold/40 bg-ais-gold/10">
                  <a.icon className="h-5 w-5 text-ais-gold" />
                </span>
                <h3 className="mt-5 font-display text-base font-extrabold uppercase tracking-wide text-ais-ivory">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ais-muted">{a.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 03 — WHAT YOU CAN DO */}
      <section className="border-y border-ais-gold/10 bg-ais-panel/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading
            index="03"
            eyebrow="What you can do with these skills"
            title={<>Learn it. Use it. <span className="text-ais-gold">Offer it.</span></>}
            subtitle="Every masterclass is built around a simple progression — from understanding the tools to applying them where they matter to you."
          />
          <ol className="relative grid gap-4 lg:grid-cols-5 lg:gap-3">
            <div className="absolute left-7 top-8 bottom-8 w-px bg-gradient-to-b from-ais-gold/60 to-ais-gold/5 lg:hidden" />
            <div className="absolute left-[10%] right-[10%] top-9 hidden h-px bg-gradient-to-r from-ais-gold/10 via-ais-gold/60 to-ais-gold/10 lg:block" />
            {PROGRESSION.map((step, i) => (
              <Reveal key={step.title} delay={i * 90}>
                <li className="relative flex gap-5 lg:flex-col lg:items-center lg:text-center">
                  <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ais-gold bg-ais-black lg:h-[4.5rem] lg:w-[4.5rem]">
                    <step.icon className="h-6 w-6 text-ais-gold" />
                  </span>
                  <div className="pt-1 lg:pt-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-ais-gold/70">Step {String(i + 1).padStart(2, "0")}</p>
                    <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-wide text-ais-ivory">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ais-muted">{step.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 04 — MASTERCLASS LIBRARY */}
      <section id="library" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          index="04"
          eyebrow="AI Masterclass Library"
          title={<>Pick the AI skill <span className="text-ais-gold">you want to learn.</span></>}
          subtitle={`Each masterclass is ${formatPeso(fromPrice)} — practical, step-by-step and beginner-friendly. Start with one skill, or unlock them all.`}
        />
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[30rem] animate-pulse rounded-2xl border border-ais-gold/10 bg-ais-panel" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="rounded-2xl border border-ais-gold/20 bg-ais-panel p-10 text-center text-ais-muted">
            New AI Masterclasses are being prepared. Please check back soon.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, i) => (
              <Reveal key={course.id} delay={(i % 3) * 90} className="h-full">
                <CourseCard course={course} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* 05 — SINGLE VS ALL-ACCESS */}
      <section id="choose" className="scroll-mt-16 border-y border-ais-gold/10 bg-ais-panel/60">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading index="05" eyebrow="Your options" title={<>Choose how you want <span className="text-ais-gold">to start.</span></>} />
          <div className="grid items-stretch gap-6 md:grid-cols-2">
            <Reveal className="h-full">
              <div className="flex h-full flex-col rounded-3xl border border-ais-gold/20 bg-ais-black p-7 sm:p-9">
                <Eyebrow>Start with one skill</Eyebrow>
                <p className="mt-5 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-extrabold text-ais-ivory">{formatPeso(fromPrice)}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ais-muted">per masterclass</span>
                </p>
                <p className="mt-5 text-base leading-relaxed text-ais-ivory/85">Choose one specific AI skill you want to learn.</p>
                <p className="mt-2 text-sm text-ais-muted">Ideal for someone who wants to start small.</p>
                <ul className="mt-6 space-y-2 text-sm text-ais-ivory/85">
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-ais-gold" /> Access to the masterclass you choose</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-ais-gold" /> Step-by-step, beginner-friendly lessons</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-ais-gold" /> Learn at your own pace</li>
                </ul>
                <div className="mt-auto pt-8">
                  <CtaLink to="#library" variant="outline" className="w-full">Choose My Masterclass</CtaLink>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120} className="h-full">
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ais-gold bg-gradient-to-br from-ais-panel-2 via-ais-black to-ais-bronze-dim p-7 shadow-[0_30px_80px_-40px_rgba(214,165,36,0.7)] sm:p-9">
                <span className="absolute right-5 top-5 rounded-full bg-ais-gold px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ais-black">
                  Complete learning option
                </span>
                <Eyebrow>M.A.I.A.</Eyebrow>
                <p className="mt-1 font-display text-lg font-extrabold uppercase tracking-wide text-ais-ivory">AI Skills All-Access</p>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-extrabold text-ais-gold-pale">{formatPeso(bundlePrice)}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ais-muted">regular price</span>
                </p>
                <p className="mt-5 text-base leading-relaxed text-ais-ivory/85">
                  Unlock all AI Masterclasses currently included in the bundle.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-ais-ivory/85">
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-ais-gold" /> {included.length} AI Masterclasses currently included</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-ais-gold" /> Build a wider set of AI skills</li>
                  <li className="flex gap-2"><Tag className="h-4 w-4 shrink-0 text-ais-gold" /> Valid promo codes can be applied at checkout</li>
                </ul>
                <div className="mt-auto pt-8">
                  <CtaLink to={`/ai-skills/checkout/${ALL_ACCESS_KEY}`} className="w-full">Get All-Access</CtaLink>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 06 — ALL-ACCESS BUNDLE */}
      <section id="all-access" className="scroll-mt-16 relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-10 h-80 w-80 rounded-full bg-ais-gold/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                align="left"
                index="06"
                eyebrow="All-Access Bundle"
                title={<>Want more than <span className="text-ais-gold">one AI skill?</span></>}
                subtitle="Unlock the M.A.I.A. AI Skills collection currently included in the All-Access Bundle."
              />
              {campaign.enabled && (campaign.label || campaign.message) && (
                <Reveal className="mb-6 rounded-2xl border border-ais-gold-bright/60 bg-ais-gold-bright/10 p-5">
                  {campaign.label && (
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-ais-gold-bright">{campaign.label}</p>
                  )}
                  {campaign.message && <p className="mt-1 text-sm text-ais-ivory">{campaign.message}</p>}
                </Reveal>
              )}
            </div>
            <Reveal delay={100}>
              <div className="rounded-3xl border border-ais-gold/40 bg-gradient-to-b from-ais-panel-2 to-ais-black p-7 sm:p-9">
                <div className="text-center">
                  <Eyebrow>M.A.I.A.</Eyebrow>
                  <p className="mt-2 font-display text-2xl font-extrabold uppercase leading-tight text-ais-ivory">
                    AI Skills <span className="text-ais-gold">All-Access</span> Bundle
                  </p>
                  <GoldRule className="my-6" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-ais-muted">Regular price</p>
                  <p className="mt-1 font-display text-5xl font-extrabold text-ais-gold-pale">{formatPeso(bundlePrice)}</p>
                </div>
                <ul className="mt-8 space-y-3">
                  {included.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-sm font-semibold text-ais-ivory">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ais-gold">
                        <Check className="h-3.5 w-3.5 text-ais-black" strokeWidth={3} />
                      </span>
                      {c.shortTitle}
                    </li>
                  ))}
                  {catalog.bundle.extraIncludedNote && (
                    <li className="flex items-center gap-3 text-sm font-semibold text-ais-ivory">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ais-gold">
                        <Check className="h-3.5 w-3.5 text-ais-black" strokeWidth={3} />
                      </span>
                      {catalog.bundle.extraIncludedNote}
                    </li>
                  )}
                </ul>
                <CtaLink to={`/ai-skills/checkout/${ALL_ACCESS_KEY}`} className="mt-8 w-full">
                  Get AI Skills All-Access
                </CtaLink>
                <div className="mt-5 rounded-xl border border-dashed border-ais-gold/30 p-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-bold text-ais-gold-pale">
                    <Tag className="h-4 w-4" /> Have a promo code?
                  </p>
                  <p className="mt-1 text-xs text-ais-muted">Apply your valid discount code during checkout.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 07 — HOW IT WORKS */}
      <section className="border-y border-ais-gold/10 bg-ais-panel/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading index="07" eyebrow="How it works" title={<>Simple steps. <span className="text-ais-gold">Practical results.</span></>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_IT_WORKS.map((s, i) => (
              <Reveal key={s.title} delay={i * 80} className="h-full">
                <div className="h-full rounded-2xl border border-ais-gold/15 bg-ais-black p-6">
                  <p className="font-display text-4xl font-extrabold text-ais-gold/80">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide text-ais-ivory">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ais-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 08 — WHY AI SKILLS */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              align="left"
              index="08"
              eyebrow="Why learn practical AI skills"
              title={<>The way people create is <span className="text-ais-gold">changing.</span></>}
              subtitle="AI tools are becoming part of everyday digital work. Knowing how to use them well is a practical, modern skill — for your own projects, your business, or the clients you serve."
            />
            <Reveal className="flex flex-wrap gap-2">
              {CHANGING.map((item) => (
                <span key={item} className="rounded-full border border-ais-gold/30 bg-ais-panel px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ais-ivory/90">
                  {item}
                </span>
              ))}
            </Reveal>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Lightbulb, title: "You don’t need to master everything at once.", body: "Focus on one practical skill and build from there." },
              { icon: GraduationCap, title: "You can start with one skill.", body: `Each masterclass is available on its own for ${formatPeso(fromPrice)}.` },
              { icon: Clock, title: "Learn at your own pace.", body: "Go through the lessons on your own schedule." },
              { icon: ShieldCheck, title: "Build practical skills you can actually use.", body: "Step-by-step workflows you can apply to real projects." },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 80} className="h-full">
                <div className="h-full rounded-2xl border border-ais-gold/15 bg-gradient-to-b from-ais-panel to-ais-black p-6">
                  <item.icon className="h-6 w-6 text-ais-gold" />
                  <h3 className="mt-4 font-display text-base font-extrabold leading-snug text-ais-ivory">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ais-muted">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 09 — FAQ */}
      <section id="faq" className="scroll-mt-16 border-y border-ais-gold/10 bg-ais-panel/60">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading index="09" eyebrow="FAQ" title={<>Questions, <span className="text-ais-gold">answered.</span></>} />
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-ais-gold/15 bg-ais-black open:border-ais-gold/50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left font-display text-sm font-extrabold uppercase tracking-wide text-ais-ivory sm:text-base [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-ais-gold transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-ais-muted sm:text-base">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10 — FINAL CTA */}
      <section className="relative overflow-hidden pb-28 sm:pb-0">
        <div className="ais-grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <UserRound className="mx-auto h-8 w-8 text-ais-gold" />
            <h2 className="mt-6 font-display text-3xl font-extrabold uppercase leading-[1.08] text-ais-ivory sm:text-5xl">
              Your next AI skill can <span className="ais-gold-text">start today.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ais-muted sm:text-lg">
              Choose one skill or unlock the complete M.A.I.A. AI Skills collection currently included in All-Access.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <CtaLink to="#library" variant="outline">Start With One — {formatPeso(fromPrice)}</CtaLink>
              <CtaLink to={`/ai-skills/checkout/${ALL_ACCESS_KEY}`}>Get All-Access — {formatPeso(bundlePrice)}</CtaLink>
            </div>
            <p className="mt-12 font-display text-sm font-extrabold uppercase tracking-[0.2em] text-ais-gold">
              {CORE_MESSAGE.join(" ")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ais-gold/25 bg-ais-black/95 p-3 backdrop-blur sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <CtaLink to="#library" variant="outline" className="min-h-11 px-2 text-[11px]">One Skill · {formatPeso(fromPrice)}</CtaLink>
          <CtaLink to={`/ai-skills/checkout/${ALL_ACCESS_KEY}`} className="min-h-11 px-2 text-[11px]">All-Access</CtaLink>
        </div>
      </div>
    </FunnelLayout>
  );
}
