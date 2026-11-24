import { Bot, FileText, Package, ShoppingBag, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Product } from "@/lib/api";
import { trackEvent } from "@/lib/context";
import { peso } from "@/lib/format";
import { EmptyState, PageHero, Spinner } from "@/components/ui";

const CATEGORIES = [
  { name: "Digital business products", icon: Package },
  { name: "AI tools", icon: Bot },
  { name: "Templates", icon: FileText },
  { name: "Skill resources", icon: Sparkles },
];

export default function Store() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cat, setCat] = useState("All");
  useEffect(() => {
    api.get<Product[]>("/api/public/products").then(setProducts).catch(() => setProducts([]));
  }, []);
  const cats = useMemo(
    () => ["All", ...new Set([...CATEGORIES.map((c) => c.name), ...(products ?? []).map((p) => p.category)])],
    [products],
  );
  const shown = (products ?? []).filter((p) => cat === "All" || p.category === cat);

  return (
    <>
      <PageHero
        eyebrow="M.A.I.A. Store"
        title="Business tools &"
        gold="skill resources."
        sub="Digital business products, AI tools, templates and resources to help you apply what you learn — ready-to-use, para mas mabilis kang makapag-implement."
      />
      <div className="container-x">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`btn shrink-0 ${cat === c ? "btn-gold" : "btn-outline"}`}
              aria-pressed={cat === c}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {!products ? (
            <Spinner />
          ) : shown.length === 0 ? (
            <>
              <EmptyState icon={ShoppingBag} title="Our first products are being prepared">
                We're preparing digital products, templates and resources for M.A.I.A. students and business owners.
                Check back soon — or{" "}
                <Link to="/contact?topic=Store" className="text-gold underline-offset-2 hover:underline">
                  send us a message
                </Link>{" "}
                to be updated.
              </EmptyState>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {CATEGORIES.map(({ name, icon: Icon }) => (
                  <div key={name} className="glass p-5 opacity-80">
                    <Icon className="h-6 w-6 text-gold" strokeWidth={1.5} />
                    <div className="mt-3 font-semibold text-ivory">{name}</div>
                    <div className="mt-1 text-xs text-muted">Coming soon</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => (
                <article key={p.id} className="glass flex flex-col overflow-hidden">
                  <div className="relative aspect-[4/3] bg-[radial-gradient(80%_80%_at_70%_20%,#3f3626,#0a0908)]">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <ShoppingBag className="absolute inset-0 m-auto h-12 w-12 text-gold/60" strokeWidth={1.2} />
                    )}
                    <span className="badge badge-gold absolute top-3 left-3 bg-ink/70">{p.category}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-lg text-ivory">{p.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed whitespace-pre-line text-muted">{p.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="font-display text-2xl text-gold-grad">{p.price != null ? peso(p.price) : ""}</span>
                      {p.checkoutUrl ? (
                        <a
                          href={p.checkoutUrl}
                          rel="noopener"
                          className="btn btn-gold"
                          onClick={() => trackEvent("InitiateCheckout", { content_name: p.title, value: p.price, currency: "PHP" })}
                        >
                          Buy now
                        </a>
                      ) : (
                        <Link to={`/contact?topic=${encodeURIComponent(`Store — ${p.title}`)}`} className="btn btn-outline">
                          Inquire
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
