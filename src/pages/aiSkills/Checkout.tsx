import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Lock, MessageCircle, ShieldCheck, Tag, TriangleAlert } from "lucide-react";
import { FunnelLayout } from "@/components/aiSkills/FunnelLayout";
import { CourseCover, CtaAnchor, CtaButton, CtaLink, Eyebrow, GoldRule } from "@/components/aiSkills/FunnelUi";
import { useFunnelCatalog } from "@/data/aiSkillsStore";
import { PENDING_ORDER_KEY } from "@/data/aiSkillsConfig";
import {
  bundleMasterclasses,
  buildCheckoutUrl,
  formatPeso,
  isHttpUrl,
  resolveProduct,
  type BuyerDetails,
} from "@/utils/aiSkills";
import type { AiSkillsProduct } from "@/types/aiSkills";

// ---------------------------------------------------------------------------
// CHECKOUT (funnel step 11)
// ---------------------------------------------------------------------------
// This page collects the buyer's details and shows exactly what they are
// buying — then hands off to the product's GHL order form, where the real
// payment, coupon validation, and final amount due happen. This page never
// charges anything, never validates a coupon, and never shows a discount
// amount it has not received from GHL.
// ---------------------------------------------------------------------------

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-ais-gold/25 bg-ais-black px-4 py-3.5 text-base text-ais-ivory placeholder:text-ais-muted/50 outline-none transition-colors focus:border-ais-gold focus:ring-2 focus:ring-ais-gold/25";

function Field({ label, error, children, optional }: { label: string; error?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-ais-ivory/85">
        {label} {optional && <span className="font-medium normal-case tracking-normal text-ais-muted">(optional)</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-sm text-[#f0a48a]">{error}</span>}
    </label>
  );
}

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Your details", "Secure payment", "Access"];
  return (
    <ol className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] sm:text-xs">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={clsx(
              "flex h-6 w-6 items-center justify-center rounded-full border",
              i + 1 < step && "border-ais-gold bg-ais-gold text-ais-black",
              i + 1 === step && "border-ais-gold text-ais-gold",
              i + 1 > step && "border-ais-bronze text-ais-muted",
            )}
          >
            {i + 1 < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span className={i + 1 === step ? "text-ais-ivory" : "text-ais-muted"}>{label}</span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-ais-bronze sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}

function OrderSummary({ product, promoCode, includedNames }: { product: AiSkillsProduct; promoCode: string; includedNames: string[] }) {
  const code = promoCode.trim();
  return (
    <div className="rounded-3xl border border-ais-gold/40 bg-gradient-to-b from-ais-panel-2 to-ais-black p-6 sm:p-7">
      <Eyebrow>Order summary</Eyebrow>
      <div className="mt-5 flex gap-4">
        {product.kind === "single" ? (
          <CourseCover course={product.course} className="h-16 w-24 shrink-0 rounded-lg" />
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-ais-gold/50 bg-ais-black font-display text-[10px] font-extrabold uppercase leading-tight tracking-[0.14em] text-ais-gold">
            All<br />Access
          </div>
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ais-muted">
            {product.kind === "single" ? "Single AI Masterclass" : "All-Access Bundle"}
          </p>
          <p className="mt-1 font-display text-base font-extrabold uppercase leading-snug text-ais-ivory">{product.name}</p>
        </div>
      </div>

      {product.kind === "bundle" && includedNames.length > 0 && (
        <ul className="mt-5 grid gap-1.5 text-sm text-ais-ivory/85">
          {includedNames.map((n) => (
            <li key={n} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ais-gold" /> {n}</li>
          ))}
        </ul>
      )}
      {product.kind === "single" && (
        <p className="mt-4 text-sm text-ais-muted">Includes access to this masterclass only.</p>
      )}

      <GoldRule className="my-6" />
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ais-muted">{product.kind === "bundle" ? "Regular price" : "Price"}</dt>
          <dd className="font-semibold text-ais-ivory">{formatPeso(product.price)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ais-muted">Discount</dt>
          <dd className="text-right font-semibold text-ais-ivory">
            {code ? (
              <span className="text-ais-gold-pale">Code “{code}” — validated at secure payment</span>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-ais-gold/15 pt-4">
          <dt className="font-bold uppercase tracking-[0.12em] text-ais-ivory">Final amount due</dt>
          <dd className="text-right">
            {code ? (
              <span className="text-sm font-semibold text-ais-gold-pale">Shown on the secure payment step</span>
            ) : (
              <span className="font-display text-3xl font-extrabold text-ais-gold-pale">{formatPeso(product.price)}</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-5 flex gap-2 text-xs leading-relaxed text-ais-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-ais-gold" />
        Payment is processed on our secure checkout. The amount charged — including any valid discount — is always the
        one confirmed on that payment step.
      </p>
    </div>
  );
}

export function Checkout() {
  const { productKey } = useParams();
  const { catalog, loading } = useFunnelCatalog();
  const product = resolveProduct(catalog, productKey);
  const settings = catalog.settings;

  const [buyer, setBuyer] = useState<BuyerDetails>({ fullName: "", email: "", phone: "", facebookName: "" });
  const [promoCode, setPromoCode] = useState("");
  const [showPromo, setShowPromo] = useState(productKey === "all-access");
  const [errors, setErrors] = useState<Partial<Record<keyof BuyerDetails, string>>>({});
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  if (!product) {
    return (
      <FunnelLayout minimalHeader>
        <div className="mx-auto max-w-xl px-4 py-32 text-center">
          {loading ? (
            <p className="text-ais-muted">Loading checkout…</p>
          ) : (
            <>
              <h1 className="font-display text-2xl font-extrabold uppercase text-ais-ivory">This product isn’t available</h1>
              <p className="mt-3 text-ais-muted">It may have been renamed or closed for enrollment.</p>
              <CtaLink to="/ai-skills#library" className="mt-8">See AI Masterclasses</CtaLink>
            </>
          )}
        </div>
      </FunnelLayout>
    );
  }

  const checkoutReady = isHttpUrl(product.checkoutUrl);
  const includedNames = bundleMasterclasses(catalog).map((c) => c.shortTitle);
  const backTo = product.kind === "single" ? `/ai-skills/masterclass/${product.key}` : "/ai-skills#all-access";

  function update(field: keyof BuyerDetails, value: string) {
    setBuyer((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (buyer.fullName.trim().length < 2) next.fullName = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(buyer.email.trim())) next.email = "Please enter a valid email address.";
    const digits = buyer.phone.replace(/[^\d]/g, "");
    if (digits.length < 10 || digits.length > 13) next.phone = "Please enter a valid mobile number (e.g. 0917 123 4567).";
    if (settings.requireFacebookName && buyer.facebookName.trim().length < 2) next.facebookName = "Please enter your Facebook name.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product || !checkoutReady || !validate()) return;
    const url = buildCheckoutUrl(product.checkoutUrl, settings, buyer, promoCode);
    if (!url) return;

    try {
      sessionStorage.setItem(
        PENDING_ORDER_KEY,
        JSON.stringify({ productKey: product.key, firstName: buyer.fullName.trim().split(/\s+/)[0], at: Date.now() }),
      );
    } catch {
      // Not required for checkout — only personalises the confirmation page.
    }

    if (isHttpUrl(settings.leadWebhookUrl)) {
      // Fire-and-forget to the admin's GHL Inbound Webhook (optional).
      void fetch(settings.leadWebhookUrl, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          event: "ai_skills_checkout_started",
          full_name: buyer.fullName.trim(),
          email: buyer.email.trim(),
          phone: buyer.phone.trim(),
          facebook_name: buyer.facebookName.trim(),
          product_key: product.key,
          product_name: product.name,
          product_type: product.kind,
          listed_price: product.price,
          promo_code: promoCode.trim(),
          tags: product.tags,
          source: "maia-ai-skills-funnel",
        }),
      }).catch(() => undefined);
    }

    if (settings.checkoutMode === "embed") {
      setEmbedUrl(url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setRedirecting(true);
      window.location.assign(url);
    }
  }

  return (
    <FunnelLayout minimalHeader>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {embedUrl ? (
            <button onClick={() => setEmbedUrl(null)} className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ais-muted hover:text-ais-gold-pale">
              <ArrowLeft className="h-4 w-4" /> Edit my details
            </button>
          ) : (
            <Link to={backTo} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ais-muted hover:text-ais-gold-pale">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          )}
          <StepBar step={embedUrl ? 2 : 1} />
        </div>

        <h1 className="mt-8 font-display text-2xl font-extrabold uppercase leading-tight text-ais-ivory sm:text-4xl">
          {embedUrl ? "Complete your secure payment" : "Complete your enrollment"}
        </h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
          <div className="order-2 lg:order-1">
            {!checkoutReady ? (
              <div className="rounded-3xl border border-ais-gold-bright/50 bg-ais-gold-bright/5 p-7">
                <TriangleAlert className="h-7 w-7 text-ais-gold-bright" />
                <h2 className="mt-4 font-display text-xl font-extrabold uppercase text-ais-ivory">Online checkout is being set up</h2>
                <p className="mt-3 text-sm leading-relaxed text-ais-muted">
                  Online payment for <strong className="text-ais-ivory">{product.name}</strong> isn’t open yet. No payment
                  has been taken.
                  {isHttpUrl(settings.supportUrl) ? " Send us a message and our team will help you enroll." : " Please check back soon."}
                </p>
                {isHttpUrl(settings.supportUrl) && (
                  <CtaAnchor href={settings.supportUrl} newTab className="mt-6">
                    <MessageCircle className="h-4 w-4" /> {settings.supportLabel}
                  </CtaAnchor>
                )}
              </div>
            ) : embedUrl ? (
              <div className="overflow-hidden rounded-3xl border border-ais-gold/30 bg-white">
                <iframe
                  src={embedUrl}
                  title={`Secure checkout — ${product.name}`}
                  className="block h-[1150px] w-full"
                  allow="payment"
                />
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="rounded-3xl border border-ais-gold/20 bg-ais-panel p-6 sm:p-8">
                <h2 className="font-display text-lg font-extrabold uppercase text-ais-ivory">Your details</h2>
                <p className="mt-1 text-sm text-ais-muted">We’ll use these to send your receipt and course access.</p>
                <div className="mt-6 grid gap-5">
                  <Field label="Full name" error={errors.fullName}>
                    <input className={inputClass} autoComplete="name" value={buyer.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Juan Dela Cruz" />
                  </Field>
                  <Field label="Email address" error={errors.email}>
                    <input className={inputClass} type="email" inputMode="email" autoComplete="email" value={buyer.email} onChange={(e) => update("email", e.target.value)} placeholder="you@email.com" />
                  </Field>
                  <Field label="Mobile number" error={errors.phone}>
                    <input className={inputClass} type="tel" inputMode="tel" autoComplete="tel" value={buyer.phone} onChange={(e) => update("phone", e.target.value)} placeholder="0917 123 4567" />
                  </Field>
                  <Field label="Facebook name" optional={!settings.requireFacebookName} error={errors.facebookName}>
                    <input className={inputClass} value={buyer.facebookName} onChange={(e) => update("facebookName", e.target.value)} placeholder="As shown on your Facebook profile" />
                  </Field>

                  {showPromo ? (
                    <Field label="Promo / discount code" optional>
                      <div className="relative">
                        <Tag className="pointer-events-none absolute left-4 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-ais-gold" />
                        <input
                          className={clsx(inputClass, "pl-11 uppercase tracking-[0.12em]")}
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.replace(/\s+/g, "").toUpperCase())}
                          placeholder="ENTER CODE"
                          autoCapitalize="characters"
                        />
                      </div>
                      <span className="mt-2 block text-xs leading-relaxed text-ais-muted">
                        {settings.prefillParams.promoCode.trim()
                          ? "Your code is carried to the secure payment step, where it is validated and the discount is shown."
                          : "Keep this code handy — enter it in the coupon field on the secure payment step, where it is validated and the discount is shown."}
                      </span>
                    </Field>
                  ) : (
                    <button type="button" onClick={() => setShowPromo(true)} className="flex cursor-pointer items-center gap-2 text-left text-sm font-semibold text-ais-gold-pale hover:text-ais-gold">
                      <Tag className="h-4 w-4" /> Have a promo code?
                    </button>
                  )}
                </div>

                <CtaButton type="submit" disabled={redirecting} className="mt-8 w-full text-base">
                  <Lock className="h-4 w-4" />
                  {redirecting ? "Opening secure payment…" : "Continue to secure payment"}
                  {!redirecting && <ArrowRight className="h-4 w-4" />}
                </CtaButton>
                <p className="mt-4 text-center text-xs leading-relaxed text-ais-muted">
                  Next, you’ll complete payment on our secure checkout. Card and payment details are entered there — never on
                  this page.
                </p>
              </form>
            )}
          </div>

          <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <OrderSummary product={product} promoCode={promoCode} includedNames={includedNames} />
          </div>
        </div>
      </div>
    </FunnelLayout>
  );
}
