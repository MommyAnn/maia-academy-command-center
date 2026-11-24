import { CheckCircle2, Mail, MessageCircle, Phone, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { trackEvent, useSite } from "@/lib/context";
import { ErrorNote, PageHero } from "@/components/ui";

export default function Contact() {
  const { site, courses } = useSite();
  const [params] = useSearchParams();
  const initialTopic = params.get("topic") ?? "";
  const topics = [
    "General inquiry",
    ...(courses ?? []).flatMap((c) => [`${c.title} — Self-paced`, `${c.title} — Guided workshop`]),
    "Complete 5-Workshop Program",
    "Store",
    "Student feedback",
  ];
  if (initialTopic && !topics.includes(initialTopic)) topics.splice(1, 0, initialTopic);

  const [form, setForm] = useState({ name: "", email: "", mobile: "", topic: initialTopic || "General inquiry", message: "", consent: false, website: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      await api.post("/api/public/inquiries", form);
      trackEvent("Contact", { content_name: form.topic });
      setStatus("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your message. Please try again.");
      setStatus("idle");
    }
  };

  const s = site?.settings ?? {};
  const channels = [
    s["contact.messengerUrl"] && { icon: MessageCircle, label: "Message us on Messenger", href: s["contact.messengerUrl"], external: true },
    s["contact.email"] && { icon: Mail, label: s["contact.email"], href: `mailto:${s["contact.email"]}` },
    s["contact.phone"] && { icon: Phone, label: s["contact.phone"], href: `tel:${s["contact.phone"].replace(/\s/g, "")}` },
  ].filter(Boolean) as { icon: typeof Mail; label: string; href: string; external?: boolean }[];

  return (
    <>
      <PageHero
        eyebrow="Contact us"
        title="May tanong ka?"
        gold="We're here to help."
        sub="Ask about the workshops, the complete program, schedules or the store. Our team will get back to you."
      />
      <div className="container-x grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="glass p-6 sm:p-8">
          {status === "sent" ? (
            <div className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-gold-bright" />
              <h2 className="h-display mt-5 text-2xl text-ivory">Salamat! Your message was received.</h2>
              <p className="mt-3 max-w-md text-muted">
                Our team will review your inquiry and contact you using the details you provided.
              </p>
              <Link to="/courses" className="btn btn-outline mt-8">
                Browse courses
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="c-name">Full name</label>
                  <input id="c-name" className="input" value={form.name} onChange={set("name")} autoComplete="name" required />
                </div>
                <div>
                  <label className="label" htmlFor="c-email">Email address</label>
                  <input id="c-email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="email" required />
                </div>
                <div>
                  <label className="label" htmlFor="c-mobile">Mobile number <span className="text-muted">(optional)</span></label>
                  <input id="c-mobile" className="input" value={form.mobile} onChange={set("mobile")} autoComplete="tel" placeholder="09XX XXX XXXX" />
                </div>
                <div>
                  <label className="label" htmlFor="c-topic">Topic</label>
                  <select id="c-topic" className="input" value={form.topic} onChange={set("topic")}>
                    {topics.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="c-message">Message</label>
                <textarea id="c-message" rows={6} className="input" value={form.message} onChange={set("message")} required />
              </div>
              {/* Honeypot — hidden from people, catches bots */}
              <div className="hidden" aria-hidden>
                <label>
                  Website <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
                </label>
              </div>
              <label className="flex items-start gap-3 text-sm text-ivory/85">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#d6a524]"
                  checked={form.consent}
                  onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
                />
                <span>
                  I agree that M.A.I.A. Business Solutions Academy may contact me about this inquiry, as described in the{" "}
                  <Link to="/policies/privacy" className="text-gold underline-offset-2 hover:underline">
                    Privacy Notice
                  </Link>
                  .
                </span>
              </label>
              <ErrorNote message={error} />
              <button className="btn btn-gold btn-lg w-full sm:w-auto" disabled={status === "sending"}>
                <Send className="h-4 w-4" /> {status === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>

        <aside className="space-y-5">
          <div className="glass p-6">
            <h2 className="font-display text-lg text-ivory">Other ways to reach us</h2>
            {channels.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {channels.map((c) => (
                  <li key={c.href}>
                    <a
                      href={c.href}
                      {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="flex items-center gap-3 rounded-xl border border-gold/20 px-4 py-3 text-sm text-ivory/90 transition hover:border-gold/60"
                    >
                      <c.icon className="h-4 w-4 text-gold-bright" /> {c.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="placeholder-note mt-4">Our official email, Messenger and social media links will be posted here soon.</p>
            )}
          </div>
          <div className="glass p-6 text-sm leading-relaxed text-muted">
            <div className="font-semibold text-ivory">Before you enroll</div>
            Each course page lists what the workshop covers, the learning format, price, access details, schedule and
            learning objectives — para malinaw ang lahat bago ka mag-decide.
          </div>
        </aside>
      </div>
    </>
  );
}
