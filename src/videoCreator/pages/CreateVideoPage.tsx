import clsx from "clsx";
import { ChevronDown, Clapperboard, Coins, Megaphone, Smartphone, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, newIdempotencyKey, vcApi, type ProductDetails, type VideoLanguage, type VideoStyle } from "../api";
import { useMe } from "../components/Layout";
import { PhotoDropzone, type UploadedPhoto } from "../components/PhotoDropzone";
import { Alert, Button, Card, Input, Label, LANGUAGE_LABEL, SectionTitle, TextArea } from "../components/ui";

const STYLES: { id: VideoStyle; title: string; tagline: string; description: string; icon: typeof Clapperboard }[] = [
  { id: "PRODUCT_COMMERCIAL", title: "Product Commercial", tagline: "Cinematic & premium", description: "Slow cinematic camera moves, studio lighting and an elegant hero shot of your product.", icon: Clapperboard },
  { id: "UGC_PROMO", title: "UGC-Style Promo", tagline: "Natural & relatable", description: "Looks like a real customer filmed it on their phone — an AI presenter shows your product.", icon: Smartphone },
  { id: "SALES_PROMOTION", title: "Sales Promotion", tagline: "Bold & energetic", description: "Fast, exciting reveal of your product with your price and call to action on screen.", icon: Megaphone },
];

export function CreateVideoPage() {
  const { me, reload } = useMe();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
  const [style, setStyle] = useState<VideoStyle>("PRODUCT_COMMERCIAL");
  const [product, setProduct] = useState<ProductDetails>({});
  const [showDetails, setShowDetails] = useState(true);
  const [language, setLanguage] = useState<VideoLanguage>("ENGLISH");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [duration, setDuration] = useState<number>(() => (me?.options.durations.includes(8) ? 8 : me?.options.durations.at(-1) ?? 8));
  const [resolution, setResolution] = useState<string>(() => me?.options.resolutions[0] ?? "720p");
  const [overlay, setOverlay] = useState(true);
  const [voiceover, setVoiceover] = useState(true);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per "Generate" intent: a double-click or a retry after a network
  // blip re-sends the SAME key, so the server never charges twice.
  const idemKey = useRef(newIdempotencyKey());

  const cost = me?.options.creditCost[resolution] ?? 1;
  const balance = me?.account.creditBalance ?? 0;
  const blocked = useMemo(() => {
    if (!me) return "Loading…";
    if (me.account.accessStatus !== "ACTIVE") return "Your access is not active. Please contact M.A.I.A. support.";
    if (!me.service.providerConnected) return "The AI video service is not connected yet.";
    if (!me.service.generationEnabled) return "Video creation is temporarily paused. Please try again later.";
    if (balance < cost) return `You need ${cost} credit${cost === 1 ? "" : "s"} for this video but have ${balance}.`;
    return null;
  }, [me, balance, cost]);

  if (!me) return null;
  const set = (k: keyof ProductDetails) => (e: { target: { value: string } }) => setProduct((p) => ({ ...p, [k]: e.target.value }));

  async function generate() {
    if (!photo) {
      setError("Please upload your product photo first (step 1).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { video } = await vcApi.createVideo({
        productPhotoId: photo.id,
        style,
        language,
        aspectRatio,
        durationSeconds: duration,
        resolution,
        product: Object.fromEntries(Object.entries(product).filter(([, v]) => v && v.trim())) as ProductDetails,
        overlay,
        voiceover,
        customInstructions: custom.trim() || undefined,
        idempotencyKey: idemKey.current,
      });
      idemKey.current = newIdempotencyKey();
      void reload();
      navigate(`/studio/videos/${video.id}`);
    } catch (e) {
      // Only a definite server answer means the request is finished; on a
      // network error keep the same key so retrying can't double-charge.
      if (e instanceof ApiError && e.status !== 0) idemKey.current = newIdempotencyKey();
      setError(e instanceof Error ? e.message : "Could not start your video.");
      void reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-vc-gold">M.A.I.A. AI Video Creator</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-vc-ivory">Create Your Product Video with AI</h1>
        <p className="mt-1 text-vc-muted">Only the photo is required — everything else is optional.</p>
      </div>

      <Card>
        <SectionTitle step={1} title="Upload Product Photo" hint="Your product will appear exactly as in this photo." />
        <PhotoDropzone value={photo} onChange={setPhoto} disabled={submitting} />
      </Card>

      <Card>
        <SectionTitle step={2} title="Choose Video Style" />
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Video style">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={style === s.id}
              onClick={() => setStyle(s.id)}
              className={clsx("rounded-2xl border p-4 text-left transition", style === s.id ? "border-vc-gold-bright bg-vc-gold/10 ring-1 ring-vc-gold-bright" : "border-vc-border bg-vc-black hover:border-vc-gold/50")}
            >
              <s.icon className={clsx("h-6 w-6", style === s.id ? "text-vc-gold-bright" : "text-vc-muted")} />
              <p className="mt-3 font-semibold text-vc-ivory">{s.title}</p>
              <p className="text-xs font-medium text-vc-gold">{s.tagline}</p>
              <p className="mt-2 text-xs leading-relaxed text-vc-muted">{s.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <button type="button" className="flex w-full items-start justify-between text-left" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
          <SectionTitle step={3} title="Product Details" optional hint="Helps the AI. Only what you write here is said or shown — nothing is made up." />
          <ChevronDown className={clsx("mt-1 h-5 w-5 shrink-0 text-vc-muted transition", showDetails && "rotate-180")} />
        </button>
        {showDetails && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pn">Product name</Label>
              <Input id="pn" maxLength={60} value={product.productName ?? ""} onChange={set("productName")} placeholder="e.g. Kape Barako Premium Blend" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pd">Short description</Label>
              <TextArea id="pd" maxLength={600} value={product.description ?? ""} onChange={set("description")} placeholder="What is it? What is it made of? How is it used?" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pb" hint="(one per line)">Benefits</Label>
              <TextArea id="pb" maxLength={400} value={product.benefits ?? ""} onChange={set("benefits")} placeholder={"Rich, bold aroma\nLocally sourced from Batangas"} />
            </div>
            <div>
              <Label htmlFor="pp">Price</Label>
              <Input id="pp" maxLength={24} value={product.price ?? ""} onChange={set("price")} placeholder="e.g. ₱299" />
            </div>
            <div>
              <Label htmlFor="pc">Call to action</Label>
              <Input id="pc" maxLength={60} value={product.callToAction ?? ""} onChange={set("callToAction")} placeholder={me.options.defaultCta[language]} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pa">Target audience</Label>
              <Input id="pa" maxLength={160} value={product.targetAudience ?? ""} onChange={set("targetAudience")} placeholder="e.g. busy moms, office workers, coffee lovers" />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle step={4} title="Video Settings" />
        <div className="space-y-5">
          <Choice label="Shape" value={aspectRatio} onChange={(v) => setAspectRatio(v as "9:16" | "16:9")} options={me.options.aspectRatios.map((a) => ({ value: a, label: a === "9:16" ? "Vertical 9:16" : "Horizontal 16:9", hint: a === "9:16" ? "TikTok · Reels · Shorts" : "YouTube · Facebook feed" }))} />
          <Choice label="Length" value={String(duration)} onChange={(v) => setDuration(Number(v))} options={me.options.durations.map((d) => ({ value: String(d), label: `${d} seconds` }))} />
          {me.options.resolutions.length > 1 && (
            <Choice label="Quality" value={resolution} onChange={setResolution} options={me.options.resolutions.map((r) => ({ value: r, label: r === "1080p" ? "Full HD 1080p" : "HD 720p", hint: `${me.options.creditCost[r]} credit${me.options.creditCost[r] === 1 ? "" : "s"}` }))} />
          )}
          <Choice label="Language" value={language} onChange={(v) => setLanguage(v as VideoLanguage)} options={me.options.languages.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle checked={voiceover} onChange={setVoiceover} title="AI voiceover" text="A voice says your product name, benefits and call to action." />
            <Toggle checked={overlay} onChange={setOverlay} title="Exact text on video" text="Adds your product name, price and call to action as clear, correctly spelled text." />
          </div>
          <div>
            <Label htmlFor="ci" hint="(optional)">Extra instructions for the AI</Label>
            <TextArea id="ci" maxLength={400} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Beach background, warm sunset light" />
          </div>
        </div>
      </Card>

      <div className="sticky bottom-20 z-10 rounded-2xl border border-vc-gold/40 bg-vc-surface/95 p-4 shadow-2xl backdrop-blur lg:bottom-4">
        {error && (
          <div className="mb-3">
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        {blocked && !error && (
          <div className="mb-3">
            <Alert kind="warning">{blocked}</Alert>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-vc-muted">
            <Coins className="h-4 w-4 text-vc-gold" />
            Uses <strong className="text-vc-gold-bright">{cost}</strong> credit{cost === 1 ? "" : "s"} · you have <strong className="text-vc-ivory">{balance}</strong>
          </p>
          <Button size="lg" onClick={generate} loading={submitting} disabled={!!blocked} className="w-full sm:w-auto" data-testid="generate-button">
            <Sparkles className="h-5 w-5" /> Generate Video
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-vc-dim sm:text-right">
          Usually ready in a few minutes. If it fails, your credits are returned automatically. <Link to="/studio/help" className="text-vc-gold">Tips</Link>
        </p>
      </div>
    </div>
  );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; hint?: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx("rounded-xl border px-4 py-2.5 text-left text-sm transition", value === o.value ? "border-vc-gold-bright bg-vc-gold/10 text-vc-ivory ring-1 ring-vc-gold-bright" : "border-vc-border bg-vc-black text-vc-muted hover:border-vc-gold/50")}
          >
            <span className="block font-semibold">{o.label}</span>
            {o.hint && <span className="block text-xs text-vc-dim">{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={clsx("flex items-start gap-3 rounded-xl border p-4 text-left transition", checked ? "border-vc-gold/60 bg-vc-gold/5" : "border-vc-border bg-vc-black")}>
      <span className={clsx("mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition", checked ? "bg-vc-gold-bright" : "bg-vc-border")}>
        <span className={clsx("h-5 w-5 rounded-full bg-vc-black transition", checked && "translate-x-5")} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-vc-ivory">{title}</span>
        <span className="block text-xs text-vc-muted">{text}</span>
      </span>
    </button>
  );
}
