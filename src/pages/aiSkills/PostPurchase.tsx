import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CircleCheck, ExternalLink, Inbox, KeyRound, LayoutDashboard, MessageCircle, PlayCircle, Sparkles } from "lucide-react";
import { FunnelLayout } from "@/components/aiSkills/FunnelLayout";
import { CourseCover, CtaAnchor, CtaLink, Eyebrow, GoldRule, Reveal } from "@/components/aiSkills/FunnelUi";
import { useFunnelCatalog } from "@/data/aiSkillsStore";
import { CORE_MESSAGE, PENDING_ORDER_KEY } from "@/data/aiSkillsConfig";
import { bundleMasterclasses, isHttpUrl, resolveProduct } from "@/utils/aiSkills";

// ---------------------------------------------------------------------------
// ORDER CONFIRMATION (step 12) + COURSE ACCESS / NEXT STEP (step 13)
// ---------------------------------------------------------------------------
// GHL's order form redirects here ONLY after a successful payment (set each
// product's "thank you page" in GHL to the URL shown in the Funnel Manager).
// These pages never grant access themselves: access is enforced by GHL's
// membership / course login, which only enrolled contacts can open. Opening
// this URL directly unlocks nothing.
// ---------------------------------------------------------------------------

function readFirstName(productKey: string | null): string {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { productKey?: string; firstName?: string };
    return parsed.productKey === productKey && typeof parsed.firstName === "string" ? parsed.firstName : "";
  } catch {
    return "";
  }
}

export function OrderConfirmation() {
  const [params] = useSearchParams();
  const productKey = params.get("product");
  const { catalog, loading } = useFunnelCatalog();
  const product = resolveProduct(catalog, productKey ?? undefined);
  const firstName = useMemo(() => readFirstName(productKey), [productKey]);
  const settings = catalog.settings;
  const accessLabel = product?.kind === "bundle" ? "Go to my AI Skills Dashboard" : "Access my Masterclass";
  const showUpsell = product?.kind === "single" && isHttpUrl(settings.upgradeCheckoutUrl);

  return (
    <FunnelLayout minimalHeader>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-ais-gold/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <Reveal>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-ais-gold bg-ais-gold/10">
              <CircleCheck className="h-8 w-8 text-ais-gold" />
            </span>
            <Eyebrow className="mt-8">{firstName ? `Welcome, ${firstName}` : "Welcome to"}</Eyebrow>
            <h1 className="mt-3 font-display text-3xl font-extrabold uppercase leading-[1.1] text-ais-ivory sm:text-5xl">
              {firstName && <span className="block text-lg tracking-[0.18em] text-ais-muted sm:text-xl">Welcome to</span>}
              M.A.I.A. <span className="ais-gold-text">AI Skills Academy™</span>
            </h1>
            <p className="mt-6 font-display text-lg font-extrabold uppercase tracking-[0.14em] text-ais-gold-pale">
              Your enrollment is confirmed.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-10 rounded-3xl border border-ais-gold/40 bg-gradient-to-b from-ais-panel-2 to-ais-black p-6 text-left sm:p-8">
              {loading && !product ? (
                <p className="text-ais-muted">Loading your order…</p>
              ) : (
                <dl className="grid gap-5 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.24em] text-ais-muted">Purchased product</dt>
                    <dd className="mt-1 font-display text-lg font-extrabold uppercase leading-snug text-ais-ivory">
                      {product ? product.name : "Your M.A.I.A. AI Skills enrollment"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.24em] text-ais-muted">Payment status</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm font-bold text-ais-gold-pale">
                      <CircleCheck className="h-4 w-4" /> Completed
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.24em] text-ais-muted">Next step</dt>
                    <dd className="mt-1 text-sm text-ais-ivory/90">
                      Check your email for your receipt and course login details, then open your training.
                    </dd>
                  </div>
                </dl>
              )}
              <CtaLink to={`/ai-skills/access${productKey ? `?product=${encodeURIComponent(productKey)}` : ""}`} className="mt-8 w-full">
                {product?.kind === "bundle" ? <LayoutDashboard className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                {accessLabel}
              </CtaLink>
            </div>
          </Reveal>

          {showUpsell && (
            <Reveal delay={200}>
              <div className="mt-8 rounded-3xl border-2 border-ais-gold bg-gradient-to-br from-ais-panel-2 via-ais-black to-ais-bronze-dim p-6 text-left sm:p-8">
                <Sparkles className="h-6 w-6 text-ais-gold" />
                <p className="mt-4 font-display text-sm font-extrabold uppercase tracking-[0.2em] text-ais-gold">Ready to learn more?</p>
                <h2 className="mt-2 font-display text-2xl font-extrabold uppercase leading-tight text-ais-ivory">
                  Upgrade to M.A.I.A. AI Skills All-Access
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ais-muted">
                  Unlock the {bundleMasterclasses(catalog).length} AI Masterclasses currently included in the All-Access Bundle.
                  {settings.upgradeOfferNote ? ` ${settings.upgradeOfferNote}` : ""}
                </p>
                <p className="mt-3 text-xs text-ais-muted/80">
                  Optional — you won’t be charged unless you choose to upgrade and complete a separate checkout.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <CtaAnchor href={settings.upgradeCheckoutUrl}>
                    Yes, show me the upgrade <ArrowRight className="h-4 w-4" />
                  </CtaAnchor>
                  <CtaLink to={`/ai-skills/access?product=${encodeURIComponent(productKey ?? "")}`} variant="outline">
                    No thanks, take me to my course
                  </CtaLink>
                </div>
              </div>
            </Reveal>
          )}

          <p className="mt-14 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-ais-gold/80">{CORE_MESSAGE.join(" ")}</p>
        </div>
      </section>
    </FunnelLayout>
  );
}

export function CourseAccess() {
  const [params] = useSearchParams();
  const productKey = params.get("product");
  const { catalog } = useFunnelCatalog();
  const product = resolveProduct(catalog, productKey ?? undefined);
  const settings = catalog.settings;

  const singleAccessUrl = product?.kind === "single" && isHttpUrl(product.course.accessUrl) ? product.course.accessUrl : null;
  const portalUrl = isHttpUrl(settings.memberPortalUrl) ? settings.memberPortalUrl : null;
  const primaryUrl = singleAccessUrl ?? portalUrl;
  const primaryLabel = product?.kind === "single" && singleAccessUrl ? "Access my Masterclass" : "Go to my AI Skills Dashboard";
  const courses = product?.kind === "single" ? [product.course] : product?.kind === "bundle" ? bundleMasterclasses(catalog) : [];

  const steps = [
    { icon: Inbox, title: "Check your email", body: "Look for your enrollment email with your login details. Please check Spam or Promotions too." },
    { icon: KeyRound, title: "Log in", body: "Use the email address you enrolled with to log in to your M.A.I.A. AI Skills dashboard." },
    {
      icon: PlayCircle,
      title: product?.kind === "bundle" ? "Open your masterclasses" : "Open your masterclass",
      body: "Start with the first lesson and learn at your own pace.",
    },
  ];

  return (
    <FunnelLayout minimalHeader>
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="text-center">
          <Eyebrow>Course access · Next step</Eyebrow>
          <h1 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight text-ais-ivory sm:text-4xl">
            Let’s get you <span className="text-ais-gold">learning.</span>
          </h1>
          {product && <p className="mt-4 text-ais-muted">{product.name}</p>}
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 90} className="h-full">
              <div className="h-full rounded-2xl border border-ais-gold/20 bg-ais-panel p-6">
                <p className="font-display text-3xl font-extrabold text-ais-gold/80">{String(i + 1).padStart(2, "0")}</p>
                <s.icon className="mt-3 h-6 w-6 text-ais-gold" />
                <h2 className="mt-3 font-display text-base font-extrabold uppercase text-ais-ivory">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ais-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 rounded-3xl border border-ais-gold/40 bg-gradient-to-b from-ais-panel-2 to-ais-black p-6 text-center sm:p-8">
          {primaryUrl ? (
            <>
              <CtaAnchor href={primaryUrl} className="w-full sm:w-auto">
                {primaryLabel} <ExternalLink className="h-4 w-4" />
              </CtaAnchor>
              <p className="mt-4 text-xs text-ais-muted">You’ll be asked to log in with the email you used at checkout.</p>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-extrabold uppercase text-ais-ivory">Your access details are on the way</p>
              <p className="mx-auto mt-2 max-w-lg text-sm text-ais-muted">
                Your login link will arrive by email. Use it to open your M.A.I.A. AI Skills dashboard.
              </p>
            </>
          )}
          {isHttpUrl(settings.supportUrl) && (
            <p className="mt-6 text-sm text-ais-muted">
              Didn’t get your email?{" "}
              <a href={settings.supportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ais-gold-pale underline-offset-4 hover:underline">
                <MessageCircle className="h-4 w-4" /> {settings.supportLabel}
              </a>
            </p>
          )}
        </Reveal>

        {courses.length > 0 && (
          <Reveal className="mt-14">
            <h2 className="text-center font-display text-sm font-extrabold uppercase tracking-[0.2em] text-ais-gold">
              {product?.kind === "bundle" ? "Included in your All-Access" : "Your masterclass"}
            </h2>
            <GoldRule className="my-6" />
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-ais-gold/15 bg-ais-panel p-3">
                  <CourseCover course={c} className="h-16 w-24 shrink-0 rounded-lg" />
                  <p className="font-display text-sm font-extrabold uppercase leading-snug text-ais-ivory">{c.title}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <p className="mt-14 text-center text-sm text-ais-muted">
          <Link to="/ai-skills#library" className="font-semibold text-ais-gold-pale underline-offset-4 hover:underline">
            Browse more AI Masterclasses
          </Link>
        </p>
      </div>
    </FunnelLayout>
  );
}
