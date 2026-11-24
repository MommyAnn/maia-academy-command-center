import { Card, PageHeader } from "../components/ui";

const FAQ: { q: string; a: string }[] = [
  { q: "What kind of photo works best?", a: "A sharp, well-lit photo of ONE product, filling most of the picture, on a plain or simple background. Avoid blurry photos, photos with many products, or photos with people's faces." },
  { q: "How long does a video take?", a: "Usually a few minutes. Google's AI does the heavy work, and busy periods can take longer. You can close the page — the video keeps generating and will appear in My Videos." },
  { q: "Will the AI change my product?", a: "M.A.I.A. tells the AI to keep your product exactly as it looks, but AI video can still slightly change small details like tiny label text. That's why your product name, price and call to action are added afterwards as exact, correctly spelled text." },
  { q: "Which style should I choose?", a: "Product Commercial: elegant, premium look. UGC-Style Promo: looks like a real customer filmed it, with an AI presenter — great for Facebook and TikTok. Sales Promotion: bold and fast, perfect for sales and promos." },
  { q: "What do English, Filipino and Taglish do?", a: "They choose the language of the AI voiceover. Write your product details in the same language you choose for the best result." },
  { q: "What happens if a video fails?", a: "Your credits are returned automatically. Sometimes Google's safety filters decline a video (for example if a photo shows a person or a sensitive product) — try a different photo or description." },
  { q: "How do I post my video?", a: "Tap Download MP4, then upload the file to Facebook, Instagram Reels, TikTok, YouTube Shorts or your Shopee/Lazada listing like any other video." },
  { q: "How do I get more credits?", a: "Contact M.A.I.A. support. Credits are added by our team — you are never charged automatically." },
];

export function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Help & Tutorials" subtitle="Everything you need to make great product videos." />
      <Card className="mb-6 border-vc-gold/40">
        <h2 className="font-display text-lg font-bold text-vc-gold-bright">Quick start — your first video in 3 steps</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-vc-ivory/90">
          <li>
            Tap <strong>Create AI Video</strong> and upload a clear photo of your product.
          </li>
          <li>
            Choose a <strong>style</strong>. Add your product name, price and call to action if you'd like them on screen.
          </li>
          <li>
            Tap <strong>Generate Video</strong>, wait a few minutes, then <strong>Download MP4</strong>.
          </li>
        </ol>
      </Card>
      <div className="space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-vc-border bg-vc-surface p-5 open:border-vc-gold/40">
            <summary className="cursor-pointer list-none font-semibold text-vc-ivory marker:hidden">
              <span className="mr-2 text-vc-gold transition group-open:rotate-90">›</span>
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-vc-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-vc-dim">Still need help? Message the M.A.I.A. Business Solutions Academy support team.</p>
    </div>
  );
}
