import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth, useSite } from "@/lib/context";
import { formatDateTime, MODE_LABEL, peso } from "@/lib/format";
import { Logo, Spinner } from "@/components/ui";
import { AdminPageHeader, useToast } from "./kit";
import { ResourceManager } from "./ResourceManager";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/courses", label: "Courses & Lessons", icon: BookOpen },
  { to: "/admin/program", label: "Complete Program", icon: GraduationCap },
  { to: "/admin/students", label: "Students & Enrollments", icon: Users },
  { to: "/admin/schedules", label: "Workshop Schedules", icon: CalendarDays },
  { to: "/admin/store", label: "Store Products", icon: ShoppingBag },
  { to: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { to: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { to: "/admin/settings", label: "Site Settings", icon: SettingsIcon },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Admin">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isActive ? "bg-gold/12 font-semibold text-gold-bright" : "text-ivory/80 hover:bg-ivory/5 hover:text-ivory"
            }`
          }
        >
          <n.icon className="h-4 w-4" /> {n.label}
        </NavLink>
      ))}
      <div className="hairline my-3" />
      <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ivory/70 hover:text-ivory">
        <ExternalLink className="h-4 w-4" /> View website
      </Link>
      <Link to="/portal" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ivory/70 hover:text-ivory">
        <GraduationCap className="h-4 w-4" /> Student portal view
      </Link>
      <button
        onClick={async () => {
          await logout();
          navigate("/");
        }}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ivory/70 hover:text-ivory"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-gold/15 bg-ink-2/80 lg:block">
        <div className="border-b border-gold/15 p-5">
          <Logo />
          <div className="mt-3 text-[11px] tracking-[0.16em] text-muted uppercase">Admin Dashboard</div>
        </div>
        {nav}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gold/15 bg-ink/85 px-4 backdrop-blur lg:hidden">
          <Logo compact />
          <button className="btn btn-ghost p-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        {open && <div className="border-b border-gold/15 bg-ink-2 lg:hidden">{nav}</div>}
        <div className="px-4 py-8 sm:px-8">
          <div className="mb-6 text-xs text-muted">Signed in as {user?.name} · {user?.email}</div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

type Overview = {
  students: number;
  activeEnrollments: number;
  newInquiries: number;
  openBatches: number;
  publishedCourses: number;
  lessonsWithoutVideo: number;
  publishedProducts: number;
  publishedTestimonials: number;
  missingCheckoutLinks: number;
  programCheckoutSet: boolean;
  recentAudit: { action: string; detail: string; createdAt: string; actor: string | null }[];
};

export function AdminOverview() {
  const [o, setO] = useState<Overview | null>(null);
  const { site } = useSite();
  useEffect(() => {
    api.get<Overview>("/api/admin/overview").then(setO).catch(() => {});
  }, []);
  if (!o) return <Spinner />;
  const s = site?.settings ?? {};
  const setup = [
    { ok: o.missingCheckoutLinks === 0, text: `GoHighLevel checkout links for every course (${o.missingCheckoutLinks} missing)`, to: "/admin/courses" },
    { ok: o.programCheckoutSet, text: "GoHighLevel checkout link for the Complete Program", to: "/admin/program" },
    { ok: o.lessonsWithoutVideo === 0, text: `Lesson videos uploaded (${o.lessonsWithoutVideo} lesson(s) without a video)`, to: "/admin/courses" },
    { ok: o.openBatches > 0, text: "At least one guided workshop batch scheduled", to: "/admin/schedules" },
    { ok: !!(s["contact.email"] || s["contact.messengerUrl"]), text: "Official email / Messenger link", to: "/admin/settings" },
    { ok: !!s["tracking.metaPixelId"], text: "Meta Pixel ID", to: "/admin/settings" },
    { ok: o.publishedTestimonials > 0, text: "Real student testimonials published (with consent)", to: "/admin/testimonials" },
    { ok: o.publishedProducts > 0, text: "Store products published", to: "/admin/store" },
    { ok: false, text: "Review Terms, Refund Policy and Privacy Notice (currently placeholders)", to: "/admin/settings" },
  ];
  const stats = [
    { label: "Students", value: o.students, to: "/admin/students" },
    { label: "Active enrollments", value: o.activeEnrollments, to: "/admin/students" },
    { label: "New inquiries", value: o.newInquiries, to: "/admin/inquiries" },
    { label: "Open batches", value: o.openBatches, to: "/admin/schedules" },
  ];
  return (
    <>
      <AdminPageHeader title="Overview" sub="Your school at a glance, plus what still needs to be configured before launch." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((st) => (
          <Link key={st.label} to={st.to} className="glass p-5 transition hover:border-gold/60">
            <div className="text-xs tracking-[0.14em] text-muted uppercase">{st.label}</div>
            <div className="mt-2 font-display text-4xl text-gold-grad">{st.value}</div>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass p-6">
          <h2 className="font-display text-lg text-ivory">Launch checklist</h2>
          <ul className="mt-4 space-y-2">
            {setup.map((x) => (
              <li key={x.text}>
                <Link to={x.to} className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-ivory/5">
                  {x.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright" />
                  )}
                  <span className={x.ok ? "text-ivory/60 line-through" : "text-ivory/90"}>{x.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="glass p-6">
          <h2 className="font-display text-lg text-ivory">Recent activity</h2>
          {o.recentAudit.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No admin activity yet.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {o.recentAudit.map((a, i) => (
                <li key={i} className="border-b border-gold/10 pb-2 last:border-0">
                  <div className="text-ivory/90">
                    <span className="font-mono text-xs text-gold">{a.action}</span> {a.detail}
                  </div>
                  <div className="text-xs text-muted">
                    {a.actor ?? "—"} · {formatDateTime(a.createdAt.replace(" ", "T") + "Z")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function AdminProgram() {
  const [data, setData] = useState<Record<string, string> | null>(null);
  const toast = useToast();
  const { reload, site } = useSite();
  useEffect(() => {
    api.get<Record<string, string>>("/api/admin/settings").then(setData).catch(toast.err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!data) return <Spinner />;
  const set = (k: string) => (e: { target: { value: string } }) => setData({ ...data, [k]: e.target.value });
  const save = async () => {
    try {
      const keys = ["program.title", "program.price", "program.checkoutUrl", "program.status", "program.journey"];
      await api.put("/api/admin/settings", Object.fromEntries(keys.map((k) => [k, data[k] ?? ""])));
      toast.ok("Program saved.");
      reload();
    } catch (e) {
      toast.err(e);
    }
  };
  return (
    <>
      <AdminPageHeader
        title="Complete Program"
        sub="The bundle of all five guided workshops. Granting the program to a student (Students → Grant program) gives guided access to every published course."
      />
      <div className="glass max-w-3xl space-y-4 p-6">
        <div>
          <label className="label" htmlFor="p-title">Program name</label>
          <input id="p-title" className="input" value={data["program.title"] ?? ""} onChange={set("program.title")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-price">Price (₱, one-time)</label>
            <input id="p-price" type="number" className="input" value={data["program.price"] ?? ""} onChange={set("program.price")} />
            {site && (
              <p className="hint">
                5 guided workshops currently total {peso(site.program.guidedTotal)}. Savings shown on the site:{" "}
                {peso(Math.max(0, site.program.guidedTotal - Number(data["program.price"] || 0)))}.
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="p-status">Enrollment status</label>
            <select id="p-status" className="input" value={data["program.status"]} onChange={set("program.status")}>
              <option value="coming_soon">Opening soon (button → inquiry form)</option>
              <option value="open">Open (button → checkout link)</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="p-checkout">GoHighLevel checkout link</label>
          <input id="p-checkout" className="input" placeholder="https://… (GHL order form / checkout page)" value={data["program.checkoutUrl"] ?? ""} onChange={set("program.checkoutUrl")} />
          <p className="hint">Placeholder until your GHL checkout is ready. The Enroll button only links here when status is “Open”.</p>
        </div>
        <div>
          <label className="label" htmlFor="p-journey">Learning journey & access note</label>
          <textarea id="p-journey" rows={3} className="input" value={data["program.journey"] ?? ""} onChange={set("program.journey")} />
        </div>
        <button className="btn btn-gold" onClick={save}>Save program</button>
      </div>
      {toast.node}
    </>
  );
}

const yesNo = (v: unknown) => (v ? <span className="badge badge-success">Yes</span> : <span className="badge badge-muted">No</span>);
const statusBadge = (v: unknown) => {
  const s = String(v);
  const cls = s === "published" || s === "open" ? "badge-success" : s === "full" || s === "draft" ? "badge-gold" : "badge-muted";
  return <span className={`badge ${cls}`}>{s.replace(/_/g, " ")}</span>;
};
const courseName = (id: unknown, courses: { id: number; title: string }[]) =>
  courses.find((c) => c.id === id)?.title ?? <span className="text-muted">—</span>;

export function AdminSchedules() {
  return (
    <ResourceManager
      endpoint="batches"
      title="Workshop Schedules"
      noun="Batch"
      sub="Guided workshop batches. Only batches marked Open or Full appear publicly (without join links). The Zoom join link is shown only to students you assign to that batch."
      emptyText="No batches yet. Add your first Zoom batch when the schedule is confirmed — nothing is shown publicly until you do."
      blank={{ courseId: null, title: "", mode: "zoom", startsAt: "", endsAt: "", scheduleText: "", capacity: null, status: "draft", joinUrl: "", location: "", notes: "" }}
      fields={[
        { key: "courseId", label: "Course", type: "course" },
        { key: "title", label: "Batch name", type: "text", placeholder: "e.g. Batch 1 — Zoom" },
        { key: "mode", label: "Mode", type: "select", options: [{ value: "zoom", label: "Zoom (online)" }, { value: "face_to_face", label: "Face-to-face" }] },
        { key: "status", label: "Status", type: "select", options: ["draft", "open", "full", "completed", "cancelled"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
        { key: "startsAt", label: "Starts", type: "datetime" },
        { key: "endsAt", label: "Ends", type: "datetime" },
        { key: "scheduleText", label: "Schedule details", type: "text", wide: true, placeholder: "e.g. Saturdays, 1:00–4:00 PM (4 sessions)" },
        { key: "capacity", label: "Capacity (optional)", type: "number", nullable: true, hint: "Internal only — not shown publicly." },
        { key: "location", label: "Location (face-to-face)", type: "text" },
        { key: "joinUrl", label: "Zoom / join link", type: "url", wide: true, hint: "Visible only to students assigned to this batch." },
        { key: "notes", label: "Notes for assigned students", type: "textarea" },
      ]}
      columns={[
        { label: "Batch", render: (r) => <span className="font-semibold text-ivory">{String(r.title)}</span> },
        { label: "Course", render: (r, { courses }) => courseName(r.courseId, courses) },
        { label: "When", render: (r) => (r.startsAt ? formatDateTime(String(r.startsAt)) : <span className="text-muted">TBA</span>) },
        { label: "Mode", render: (r) => MODE_LABEL[String(r.mode)] },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Join link", render: (r) => yesNo(r.joinUrl) },
      ]}
    />
  );
}

export function AdminStore() {
  return (
    <ResourceManager
      endpoint="products"
      title="Store Products"
      noun="Product"
      sub="Digital business products, AI tools, templates and skill resources. Add a GHL checkout link for each product; without one, the button becomes an inquiry."
      emptyText="No products yet. Add your first digital product when it's ready."
      blank={{ title: "", category: "Templates", description: "", price: null, checkoutUrl: "", imageUrl: "", status: "draft", sort: 0 }}
      fields={[
        { key: "title", label: "Product name", type: "text" },
        { key: "category", label: "Category", type: "select", options: ["Digital business products", "AI tools", "Templates", "Skill resources"].map((v) => ({ value: v, label: v })) },
        { key: "price", label: "Price (optional)", type: "price", nullable: true },
        { key: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draft (hidden)" }, { value: "published", label: "Published" }] },
        { key: "description", label: "Description", type: "textarea" },
        { key: "checkoutUrl", label: "GoHighLevel checkout link", type: "url", wide: true },
        { key: "imageUrl", label: "Product image", type: "image" },
        { key: "sort", label: "Sort order", type: "number" },
      ]}
      columns={[
        { label: "Product", render: (r) => <span className="font-semibold text-ivory">{String(r.title)}</span> },
        { label: "Category", render: (r) => String(r.category) },
        { label: "Price", render: (r) => (r.price != null ? peso(Number(r.price)) : "—") },
        { label: "Checkout", render: (r) => yesNo(r.checkoutUrl) },
        { label: "Status", render: (r) => statusBadge(r.status) },
      ]}
    />
  );
}

export function AdminTestimonials() {
  return (
    <ResourceManager
      endpoint="testimonials"
      title="Testimonials"
      noun="Testimonial"
      sub="Real student feedback only. A testimonial can be published only after you record the student's consent."
      emptyText="No testimonials yet. Add real student feedback (video or written) as your batches complete."
      blank={{ name: "", role: "", quote: "", videoUrl: "", photoUrl: "", courseId: null, consent: false, status: "draft", sort: 0 }}
      fields={[
        { key: "name", label: "Student name (as they agreed to be shown)", type: "text" },
        { key: "role", label: "Role / business", type: "text", placeholder: "e.g. Online seller, Cavite" },
        { key: "courseId", label: "Course", type: "course" },
        { key: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draft (hidden)" }, { value: "published", label: "Published" }] },
        { key: "quote", label: "Written feedback", type: "textarea", hint: "Use the student's own words. Don't edit their meaning." },
        { key: "videoUrl", label: "Video link (YouTube, Vimeo, Facebook, Drive…)", type: "url", wide: true },
        { key: "photoUrl", label: "Photo / video thumbnail", type: "image" },
        { key: "consent", label: "The student gave permission to publish this feedback", type: "checkbox", wide: true, hint: "Required before publishing." },
        { key: "sort", label: "Sort order", type: "number" },
      ]}
      columns={[
        { label: "Student", render: (r) => <span className="font-semibold text-ivory">{String(r.name)}</span> },
        { label: "Course", render: (r, { courses }) => courseName(r.courseId, courses) },
        { label: "Type", render: (r) => (r.videoUrl ? "Video" : "Written") },
        { label: "Consent", render: (r) => yesNo(r.consent) },
        { label: "Status", render: (r) => statusBadge(r.status) },
      ]}
    />
  );
}

type Inquiry = { id: number; name: string; email: string; mobile: string; topic: string; message: string; status: string; adminNote: string; createdAt: string };

export function AdminInquiries() {
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [filter, setFilter] = useState("open");
  const toast = useToast();
  const load = () => api.get<Inquiry[]>("/api/admin/inquiries").then(setRows).catch(toast.err);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = async (id: number, patch: Partial<Inquiry>) => {
    try {
      const r = await api.put<Inquiry>(`/api/admin/inquiries/${id}`, patch);
      setRows((rs) => rs?.map((x) => (x.id === id ? r : x)) ?? null);
    } catch (e) {
      toast.err(e);
    }
  };
  const shown = (rows ?? []).filter((r) => (filter === "open" ? r.status !== "closed" : filter === "all" ? true : r.status === filter));
  return (
    <>
      <AdminPageHeader
        title="Inquiries"
        sub="Messages from the Contact Us form. (Email notifications and GoHighLevel CRM sync are not connected yet — check this page regularly.)"
        actions={
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">Open (new + in progress)</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        }
      />
      {!rows ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="placeholder-note">No inquiries in this view.</p>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => (
            <article key={r.id} className="glass p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <div className="font-semibold text-ivory">{r.name}</div>
                  <div className="text-sm text-muted">
                    <a href={`mailto:${r.email}`} className="text-gold">{r.email}</a>
                    {r.mobile && ` · ${r.mobile}`}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {r.topic} · {formatDateTime(r.createdAt.replace(" ", "T") + "Z")}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <select className="input w-auto py-1.5" value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}>
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    className="btn btn-danger px-3 py-1.5 text-xs"
                    onClick={async () => {
                      if (!confirm("Delete this inquiry?")) return;
                      await api.del(`/api/admin/inquiries/${r.id}`).catch(toast.err);
                      load();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-ivory/85">{r.message}</p>
              <textarea
                className="input mt-4 text-xs"
                rows={2}
                placeholder="Internal note (only admins see this)"
                defaultValue={r.adminNote}
                onBlur={(e) => e.target.value !== r.adminNote && update(r.id, { adminNote: e.target.value })}
              />
            </article>
          ))}
        </div>
      )}
      {toast.node}
    </>
  );
}

const SETTINGS_GROUPS: { title: string; sub?: string; fields: { key: string; label: string; type?: "textarea" | "url" | "text"; hint?: string }[] }[] = [
  {
    title: "Contact & Messenger",
    sub: "Shown on the Contact Us page and footer. Leave empty to hide.",
    fields: [
      { key: "contact.email", label: "Official email address" },
      { key: "contact.messengerUrl", label: "Messenger link", type: "url", hint: "e.g. https://m.me/yourpage" },
      { key: "contact.phone", label: "Phone number" },
    ],
  },
  {
    title: "Social media",
    fields: [
      { key: "social.facebook", label: "Facebook page", type: "url" },
      { key: "social.instagram", label: "Instagram", type: "url" },
      { key: "social.tiktok", label: "TikTok", type: "url" },
      { key: "social.youtube", label: "YouTube", type: "url" },
    ],
  },
  {
    title: "Tracking",
    sub: "The Meta Pixel loads only when an ID is saved here. It records PageView, InitiateCheckout (enroll clicks) and Contact (form sent).",
    fields: [{ key: "tracking.metaPixelId", label: "Meta Pixel ID", hint: "Digits only, from Meta Events Manager." }],
  },
  {
    title: "Branding & announcement",
    fields: [
      { key: "brand.logoUrl", label: "Logo image URL", type: "url", hint: "Defaults to the official M.A.I.A. monogram (/brand/maia-monogram.png)." },
      { key: "home.announcement", label: "Announcement bar (optional)", hint: "Short line shown above the site header. Leave empty to hide." },
    ],
  },
  {
    title: "Policies",
    sub: "These are placeholders. Please have them reviewed before accepting payments.",
    fields: [
      { key: "policy.terms", label: "Terms of Enrollment", type: "textarea" },
      { key: "policy.refund", label: "Refund & Rescheduling Policy", type: "textarea" },
      { key: "policy.privacy", label: "Privacy Notice", type: "textarea" },
    ],
  },
];

export function AdminSettings() {
  const [data, setData] = useState<Record<string, string> | null>(null);
  const toast = useToast();
  const { reload } = useSite();
  useEffect(() => {
    api.get<Record<string, string>>("/api/admin/settings").then(setData).catch(toast.err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!data) return <Spinner />;
  const save = async (keys: string[]) => {
    try {
      await api.put("/api/admin/settings", Object.fromEntries(keys.map((k) => [k, data[k] ?? ""])));
      toast.ok("Settings saved.");
      reload();
    } catch (e) {
      toast.err(e);
    }
  };
  return (
    <>
      <AdminPageHeader title="Site Settings" sub="Contact links, social media, tracking, branding and policies." />
      <div className="max-w-3xl space-y-6">
        {SETTINGS_GROUPS.map((g) => (
          <section key={g.title} className="glass p-6">
            <h2 className="font-display text-lg text-ivory">{g.title}</h2>
            {g.sub && <p className="mt-1 text-sm text-muted">{g.sub}</p>}
            <div className="mt-5 space-y-4">
              {g.fields.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={`s-${f.key}`}>{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea id={`s-${f.key}`} rows={6} className="input" value={data[f.key] ?? ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} />
                  ) : (
                    <input id={`s-${f.key}`} className="input" placeholder={f.type === "url" ? "https://" : ""} value={data[f.key] ?? ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} />
                  )}
                  {f.hint && <p className="hint">{f.hint}</p>}
                </div>
              ))}
            </div>
            <button className="btn btn-gold mt-5" onClick={() => save(g.fields.map((f) => f.key))}>
              Save {g.title.toLowerCase()}
            </button>
          </section>
        ))}
      </div>
      {toast.node}
    </>
  );
}
