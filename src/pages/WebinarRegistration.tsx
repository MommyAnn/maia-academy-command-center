import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { useWebinarStore } from "@/data/webinarStore";
import {
  BUSINESS_STATUSES,
  START_TIMELINES,
  REGISTRATION_COMMS_CONSENT_STATEMENT,
  WEBINAR_MARKETING_CONSENT_STATEMENT,
  blankUtmAttribution,
} from "@/types/webinar";
import type { BusinessStatus, StartTimeline, WebinarSession } from "@/types/webinar";

function YesNoToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
            value === option ? "border-maia-gold bg-maia-gold-bg text-maia-gold-deep" : "border-maia-border text-maia-ink-soft hover:border-maia-gold"
          }`}
        >
          {option ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function buildIcsFile(session: WebinarSession): string {
  const start = new Date(`${session.date}T${session.startTime}:00+08:00`);
  const end = new Date(`${session.date}T${session.endTime}:00+08:00`);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${session.sessionId}@maiaacademy.demo`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${session.title}`,
    `LOCATION:${session.platform}${session.meetingLink ? " - " + session.meetingLink : ""}`,
    `DESCRIPTION:${session.title} — M.A.I.A. Academy Free Webinar`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(session: WebinarSession) {
  const blob = new Blob([buildIcsFile(session)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.title.replace(/[^a-z0-9]+/gi, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function WebinarRegistration() {
  const { sessions, registerForWebinar } = useWebinarStore();
  const openSessions = useMemo(() => sessions.filter((s) => s.status === "Open for Registration"), [sessions]);

  const [fullName, setFullName] = useState("");
  const [facebookName, setFacebookName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [city, setCity] = useState("");
  const [businessStatus, setBusinessStatus] = useState<BusinessStatus>("Planning to Start a Business");
  const [businessName, setBusinessName] = useState("");
  const [businessChallenge, setBusinessChallenge] = useState("");
  const [sellingCurrently, setSellingCurrently] = useState<boolean | null>(null);
  const [importationExperience, setImportationExperience] = useState<boolean | null>(null);
  const [timeline, setTimeline] = useState<StartTimeline | "">("");
  const [webinarSessionId, setWebinarSessionId] = useState(openSessions.length === 1 ? openSessions[0].id : "");
  const [registrationCommsConsent, setRegistrationCommsConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmedSession, setConfirmedSession] = useState<WebinarSession | null>(null);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Required";
    if (!facebookName.trim()) next.facebookName = "Required";
    if (!email.trim() || !email.includes("@")) next.email = "A valid email is required";
    if (!contactNumber.trim()) next.contactNumber = "Required";
    if (!city.trim()) next.city = "Required";
    if (!webinarSessionId) next.webinarSessionId = "Please select a webinar session";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    registerForWebinar({
      fullName: fullName.trim(),
      facebookName: facebookName.trim(),
      email: email.trim(),
      contactNumber: contactNumber.trim(),
      city: city.trim(),
      businessStatus,
      businessName: businessName.trim(),
      businessChallenge: businessChallenge.trim(),
      sellingCurrently,
      importationExperience,
      timeline,
      webinarSessionId,
      leadSource: "Website",
      campaign: "",
      utm: blankUtmAttribution(),
      registrationCommsConsent,
      marketingConsent,
    });
    setConfirmedSession(sessions.find((s) => s.id === webinarSessionId) ?? null);
  }

  return (
    <div className="min-h-screen bg-maia-bg">
      <header className="border-b border-maia-border bg-maia-black">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-4 py-8 text-center sm:py-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-maia-gold/40 bg-maia-black-soft">
            <span className="font-display text-lg font-bold text-maia-gold">M</span>
          </div>
          <p className="font-display text-xs font-bold tracking-[0.3em] text-maia-gold">M.A.I.A.</p>
          <p className="text-xs text-white/60">Mommy Ann Import Academy</p>
          <h1 className="mt-1 font-display text-xl font-extrabold text-white sm:text-2xl">FREE GROUP WEBINAR REGISTRATION</h1>
          {!confirmedSession && <p className="mt-1 max-w-md text-sm text-white/60">Reserve your free seat — takes less than a minute.</p>}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 sm:py-10">
        <div className="rounded-2xl border border-maia-border bg-maia-surface p-5 shadow-sm sm:p-8">
          {confirmedSession ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 size={44} className="text-maia-success" />
              <h2 className="font-display text-xl font-extrabold text-maia-ink">YOU'RE REGISTERED!</h2>
              <div className="w-full rounded-xl bg-maia-bg px-5 py-4 text-left">
                <p className="font-display text-base font-bold text-maia-ink">{confirmedSession.title}</p>
                <p className="mt-1 text-sm text-maia-ink-soft">
                  {new Date(confirmedSession.date).toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
                <p className="text-sm text-maia-ink-soft">
                  {confirmedSession.startTime} – {confirmedSession.endTime}
                </p>
                <p className="text-sm text-maia-ink-soft">{confirmedSession.platform}</p>
              </div>
              <p className="rounded-lg bg-maia-gold-bg px-4 py-3 text-sm font-semibold text-maia-gold-deep">
                IMPORTANT: Please save your webinar schedule.
              </p>
              <Button className="w-full justify-center" onClick={() => downloadIcs(confirmedSession)}>
                <CalendarPlus size={15} />
                ADD TO CALENDAR
              </Button>
              <p className="text-xs text-maia-ink-soft">
                We'll also prepare reminder messages closer to the date — this demo does not send real SMS/email yet.
              </p>
            </div>
          ) : (
            <>
              {openSessions.length === 0 ? (
                <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">
                  No webinar is open for registration right now. Please check back soon.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <SelectField
                    label="Select Webinar Session"
                    required
                    value={webinarSessionId}
                    onChange={(e) => setWebinarSessionId(e.target.value)}
                    error={errors.webinarSessionId}
                    placeholder="Choose a session"
                    options={openSessions.map((s) => ({
                      value: s.id,
                      label: `${new Date(s.date).toLocaleDateString("en-PH", { weekday: "long" })} ${s.startTime} — ${s.title}`,
                    }))}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField label="Real Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
                    <TextField label="Facebook Name" required value={facebookName} onChange={(e) => setFacebookName(e.target.value)} error={errors.facebookName} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField label="Email Address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
                    <TextField label="Contact Number" required value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} error={errors.contactNumber} />
                  </div>
                  <TextField label="City / Location" required value={city} onChange={(e) => setCity(e.target.value)} error={errors.city} />

                  <SelectField
                    label="What best describes you?"
                    value={businessStatus}
                    onChange={(e) => setBusinessStatus(e.target.value as BusinessStatus)}
                    options={BUSINESS_STATUSES.map((b) => ({ value: b, label: b }))}
                  />
                  <TextField label="Business / Brand Name (optional)" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />

                  <TextAreaField
                    label="What is your biggest business challenge right now?"
                    rows={2}
                    value={businessChallenge}
                    onChange={(e) => setBusinessChallenge(e.target.value)}
                  />

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Are you currently selling products?</label>
                    <YesNoToggle value={sellingCurrently} onChange={setSellingCurrently} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Have you tried importing before?</label>
                    <YesNoToggle value={importationExperience} onChange={setImportationExperience} />
                  </div>

                  <SelectField
                    label="How soon are you planning to start or grow your business?"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value as StartTimeline)}
                    placeholder="Select one"
                    options={START_TIMELINES.map((t) => ({ value: t, label: t }))}
                  />

                  <div className="flex flex-col gap-2.5 rounded-xl border border-maia-border p-4">
                    <label className="flex items-start gap-2.5 text-sm text-maia-ink">
                      <input
                        type="checkbox"
                        checked={registrationCommsConsent}
                        onChange={(e) => setRegistrationCommsConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-maia-border accent-maia-gold-deep"
                      />
                      <span>{REGISTRATION_COMMS_CONSENT_STATEMENT}</span>
                    </label>
                    <label className="flex items-start gap-2.5 text-sm text-maia-ink">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-maia-border accent-maia-gold-deep"
                      />
                      <span>{WEBINAR_MARKETING_CONSENT_STATEMENT}</span>
                    </label>
                  </div>

                  <Button className="w-full justify-center" onClick={handleSubmit}>
                    <Send size={15} />
                    RESERVE MY FREE SEAT
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-maia-ink-soft">
          &copy; {new Date().getFullYear()} Mommy Ann Import Academy &middot; M.A.I.A. Business Solutions Academy
        </p>
      </main>
    </div>
  );
}
