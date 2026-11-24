import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
  PlayCircle,
  Shield,
  UserCog,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type ScheduleItem, type User } from "@/lib/api";
import { useAuth } from "@/lib/context";
import { FORMAT_LABEL, formatDate, formatDateTime, MODE_LABEL } from "@/lib/format";
import { CourseArt, EmptyState, ErrorNote, Logo, Spinner, VideoEmbed } from "@/components/ui";

export function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== "admin") return <Navigate to="/portal" replace />;
  return <Outlet />;
}

export function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tabs = [
    { to: "/portal", label: "My Courses", icon: LayoutDashboard, end: true },
    { to: "/portal/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/portal/account", label: "Account", icon: UserCog },
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-gold/15 bg-ink/85 backdrop-blur-xl">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo compact />
            <div className="hidden leading-tight sm:block">
              <div className="font-display text-sm text-ivory">Student Portal</div>
              <div className="text-[11px] tracking-[0.14em] text-gold uppercase">M.A.I.A. Business Solutions Academy</div>
            </div>
          </div>
          <nav className="flex items-center gap-1" aria-label="Portal">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `btn px-3 py-2 ${isActive ? "bg-gold/12 text-gold-bright" : "btn-ghost"}`
                }
              >
                <t.icon className="h-4 w-4" />
                <span className="hidden md:inline">{t.label}</span>
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <Link to="/admin" className="btn btn-ghost px-3 py-2" title="Admin Dashboard">
                <Shield className="h-4 w-4" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}
            <button
              className="btn btn-ghost px-3 py-2"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

type DashCourse = {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  icon: string;
  coverImage: string;
  accessNote: string;
  formats: { format: string; expiresAt: string | null; batchId: number | null }[];
  canWatch: boolean;
  lessonsTotal: number;
  lessonsDone: number;
};

export function PortalDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<{ courses: DashCourse[]; schedule: ScheduleItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<typeof data>("/api/portal/dashboard").then(setData).catch((e: ApiError) => setError(e.message));
  }, []);
  if (error) return <div className="container-x py-10"><ErrorNote message={error} /></div>;
  if (!data) return <Spinner />;
  const upcoming = data.schedule.filter((s) => s.status !== "completed" && s.status !== "cancelled");

  return (
    <div className="container-x py-10">
      <span className="eyebrow">Student Portal</span>
      <h1 className="h-display mt-4 text-3xl text-ivory sm:text-4xl">
        Welcome, <span className="text-gold-grad">{user?.name.split(" ")[0]}.</span>
      </h1>
      <p className="mt-2 text-muted">Tuloy lang — step by step. Here are your courses and workshop schedule.</p>

      <section className="mt-10">
        <h2 className="h-display text-xl text-ivory">My courses</h2>
        {data.courses.length === 0 ? (
          <div className="mt-5">
            <EmptyState icon={BookOpen} title="No courses yet">
              Once your enrollment is confirmed by the M.A.I.A. team, your course will appear here. If you already paid
              and don't see it yet, please{" "}
              <Link to="/contact?topic=Enrollment%20confirmation" className="text-gold">
                contact us
              </Link>
              .
              <div className="mt-5">
                <Link to="/courses" className="btn btn-gold">
                  Browse courses
                </Link>
              </div>
            </EmptyState>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.map((c, i) => {
              const pct = c.lessonsTotal ? Math.round((c.lessonsDone / c.lessonsTotal) * 100) : 0;
              return (
                <Link key={c.id} to={`/portal/learn/${c.slug}`} className="glass group overflow-hidden transition hover:-translate-y-1 hover:border-gold/60">
                  <div className="relative aspect-video">
                    <CourseArt title={c.title} icon={c.icon} coverImage={c.coverImage} index={i} />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                    <PlayCircle className="absolute inset-0 m-auto h-12 w-12 text-gold-bright opacity-0 transition group-hover:opacity-100" />
                    <h3 className="absolute right-4 bottom-3 left-4 font-display text-xl text-ivory">{c.title}</h3>
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap gap-2">
                      {c.formats.map((f) => (
                        <span key={f.format} className={`badge ${f.format === "guided" ? "badge-gold" : "badge-muted"}`}>
                          {FORMAT_LABEL[f.format]}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted">
                      <span>
                        {c.lessonsDone} of {c.lessonsTotal} lessons
                      </span>
                      <span className="font-semibold text-gold-pale">{pct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ivory/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright" style={{ width: `${pct}%` }} />
                    </div>
                    {c.formats.some((f) => f.expiresAt) && (
                      <p className="mt-3 text-xs text-muted">
                        Access until {formatDate(c.formats.map((f) => f.expiresAt).filter(Boolean).sort().pop())}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between">
            <h2 className="h-display text-xl text-ivory">Upcoming workshops</h2>
            <Link to="/portal/schedule" className="text-sm text-gold">
              Full schedule →
            </Link>
          </div>
          <div className="mt-5 grid gap-3">
            {upcoming.slice(0, 3).map((b) => (
              <ScheduleCard key={`${b.courseId}-${b.id}`} b={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScheduleCard({ b }: { b: ScheduleItem }) {
  return (
    <div className={`glass flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center ${b.assigned ? "border-gold/60" : ""}`}>
      <div>
        <div className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">{b.courseTitle}</div>
        <div className="mt-1 font-semibold text-ivory">{b.title}</div>
        <div className="mt-1 text-sm text-muted">
          {b.startsAt ? formatDateTime(b.startsAt) : "Date to be announced"}
          {b.endsAt && ` – ${formatDateTime(b.endsAt)}`}
        </div>
        {b.scheduleText && <div className="mt-1 text-sm text-muted">{b.scheduleText}</div>}
        <div className="mt-1 flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3 w-3" /> {MODE_LABEL[b.mode]}
          {b.location && ` · ${b.location}`}
        </div>
        {b.notes && <p className="mt-2 text-sm whitespace-pre-line text-ivory/80">{b.notes}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        {b.assigned ? <span className="badge badge-success">Your batch</span> : <span className="badge badge-muted">Available batch</span>}
        {b.assigned && b.joinUrl ? (
          <a href={b.joinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
            <Video className="h-4 w-4" /> Join workshop
          </a>
        ) : b.assigned ? (
          <span className="text-xs text-muted">Join link will be posted before the session.</span>
        ) : (
          <span className="max-w-[220px] text-xs text-muted sm:text-right">
            Our team will confirm your batch assignment.
          </span>
        )}
      </div>
    </div>
  );
}

export function PortalSchedule() {
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  useEffect(() => {
    api.get<ScheduleItem[]>("/api/portal/schedule").then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) return <Spinner />;
  return (
    <div className="container-x py-10">
      <h1 className="h-display text-3xl text-ivory">
        Workshop <span className="text-gold-grad">schedule</span>
      </h1>
      <p className="mt-2 text-muted">Zoom sessions for your guided workshops. Face-to-face sessions will be added once our training center is operational.</p>
      <div className="mt-8 grid gap-3">
        {items.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No scheduled workshops yet">
            Guided workshop batches will appear here once they are scheduled. Self-paced courses don't need a schedule —
            you can learn anytime.
          </EmptyState>
        ) : (
          items.map((b) => <ScheduleCard key={`${b.courseId}-${b.id}`} b={b} />)
        )}
      </div>
    </div>
  );
}

type Lesson = {
  id: number;
  title: string;
  summary: string;
  durationLabel: string;
  completed: boolean;
  videoUrl: string;
  resources: { label: string; url: string }[];
};
type LearnCourse = {
  id: number;
  slug: string;
  title: string;
  accessNote: string;
  outcome: string;
  canWatch: boolean;
  formats: { format: string; expiresAt: string | null }[];
  modules: { id: number; title: string; description: string; lessons: Lesson[] }[];
  schedule: ScheduleItem[];
};

export function Learn() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<LearnCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<LearnCourse>(`/api/portal/courses/${slug}`).then(setCourse).catch((e: ApiError) => setError(e.message));
  }, [slug]);
  useEffect(load, [load]);

  const lessons = useMemo(() => course?.modules.flatMap((m) => m.lessons) ?? [], [course]);
  const current = lessons.find((l) => String(l.id) === lessonId) ?? lessons.find((l) => !l.completed) ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const done = lessons.filter((l) => l.completed).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

  if (error)
    return (
      <div className="container-x py-16">
        <EmptyState title="This course isn't available">
          {error}
          <div className="mt-5">
            <Link to="/portal" className="btn btn-outline">Back to my courses</Link>
          </div>
        </EmptyState>
      </div>
    );
  if (!course) return <Spinner />;

  const toggleComplete = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await api.post(`/api/portal/lessons/${current.id}/progress`, { completed: !current.completed });
      setCourse((c) =>
        c && {
          ...c,
          modules: c.modules.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) => (l.id === current.id ? { ...l, completed: !l.completed } : l)),
          })),
        },
      );
      if (!current.completed && lessons[idx + 1]) navigate(`/portal/learn/${slug}/${lessons[idx + 1].id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/portal" className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-pale">
            <ArrowLeft className="h-4 w-4" /> My courses
          </Link>
          <button className="btn btn-ghost hidden px-3 py-2 lg:inline-flex" onClick={() => setSidebar((v) => !v)}>
            {sidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            Curriculum
          </button>
        </div>
        <div className="mt-2 text-xs font-semibold tracking-[0.16em] text-gold uppercase">{course.title}</div>

        {!course.canWatch ? (
          <div className="mt-6 space-y-4">
            <EmptyState icon={CalendarDays} title="Your guided workshop">
              Recorded lessons are not part of your current enrollment. Your live workshop details are below.
            </EmptyState>
            {course.schedule.map((b) => (
              <ScheduleCard key={b.id} b={b} />
            ))}
          </div>
        ) : current ? (
          <>
            <h1 className="h-display mt-2 text-2xl text-ivory sm:text-3xl">{current.title}</h1>
            <div className="mt-5">
              <VideoEmbed url={current.videoUrl} title={current.title} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button className={`btn ${current.completed ? "btn-outline" : "btn-gold"}`} onClick={toggleComplete} disabled={saving}>
                <CheckCircle2 className="h-4 w-4" />
                {current.completed ? "Completed — mark as not done" : "Mark as complete"}
              </button>
              <div className="flex gap-2">
                <button
                  className="btn btn-outline"
                  disabled={idx <= 0}
                  onClick={() => navigate(`/portal/learn/${slug}/${lessons[idx - 1].id}`)}
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  className="btn btn-outline"
                  disabled={idx >= lessons.length - 1}
                  onClick={() => navigate(`/portal/learn/${slug}/${lessons[idx + 1].id}`)}
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            {current.summary && (
              <section className="glass mt-6 p-6">
                <h2 className="font-semibold text-ivory">About this lesson</h2>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ivory/80">{current.summary}</p>
              </section>
            )}
            {current.resources.length > 0 && (
              <section className="glass mt-4 p-6">
                <h2 className="font-semibold text-ivory">Resources</h2>
                <ul className="mt-3 space-y-2">
                  {current.resources.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-pale">
                        <FileText className="h-4 w-4" /> {r.label} <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {course.schedule.length > 0 && (
              <section className="mt-8">
                <h2 className="h-display text-xl text-ivory">Workshop schedule</h2>
                <div className="mt-4 grid gap-3">
                  {course.schedule.map((b) => (
                    <ScheduleCard key={b.id} b={b} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="mt-6">
            <EmptyState title="Lessons are being prepared">The lessons for this course will appear here once they're published.</EmptyState>
          </div>
        )}
      </div>

      {/* Curriculum sidebar */}
      {course.canWatch && (
        <aside
          className={`border-gold/15 bg-ink-2/70 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-l ${
            sidebar ? "" : "lg:hidden"
          } border-t lg:border-t-0`}
        >
          <div className="border-b border-gold/15 p-5">
            <div className="font-display text-lg text-ivory">Course content</div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>
                {done} / {lessons.length} lessons completed
              </span>
              <span className="font-semibold text-gold-pale">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ivory/10">
              <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright transition-all" style={{ width: `${pct}%` }} />
            </div>
            {course.formats.some((f) => f.expiresAt) && (
              <p className="mt-3 text-xs text-muted">
                Access until {formatDate(course.formats.map((f) => f.expiresAt).filter(Boolean).sort().pop())}
              </p>
            )}
          </div>
          {course.modules.map((m, mi) => (
            <div key={m.id} className="border-b border-gold/10">
              <div className="px-5 pt-4 pb-2">
                <div className="text-[11px] font-semibold tracking-[0.16em] text-gold uppercase">Module {mi + 1}</div>
                <div className="text-sm font-semibold text-ivory">{m.title}</div>
              </div>
              <ul className="pb-2">
                {m.lessons.map((l) => {
                  const active = current?.id === l.id;
                  return (
                    <li key={l.id}>
                      <Link
                        to={`/portal/learn/${slug}/${l.id}`}
                        className={`flex items-start gap-3 px-5 py-2.5 text-sm transition ${
                          active ? "bg-gold/10 text-gold-pale" : "text-ivory/80 hover:bg-ivory/5"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        {l.completed ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                        )}
                        <span className="flex-1">{l.title}</span>
                        {l.durationLabel && <span className="text-xs text-muted">{l.durationLabel}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

export function PortalAccount() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name ?? "", mobile: user?.mobile ?? "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pwMsg, setPwMsg] = useState<{ ok?: string; err?: string }>({});

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setMsg({});
    try {
      const r = await api.put<{ user: User }>("/api/auth/profile", profile);
      setUser(r.user);
      setMsg({ ok: "Profile saved." });
    } catch (err) {
      setMsg({ err: (err as Error).message });
    }
  };
  const savePw = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg({});
    try {
      await api.post("/api/auth/change-password", pw);
      setPw({ currentPassword: "", newPassword: "" });
      setPwMsg({ ok: "Password changed. Other devices have been signed out." });
    } catch (err) {
      setPwMsg({ err: (err as Error).message });
    }
  };

  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="h-display text-3xl text-ivory">
        My <span className="text-gold-grad">account</span>
      </h1>
      <form onSubmit={saveProfile} className="glass mt-8 space-y-4 p-6">
        <h2 className="font-semibold text-ivory">Profile</h2>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-70" value={user?.email ?? ""} disabled />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="a-name">Full name</label>
            <input id="a-name" className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="a-mobile">Mobile number</label>
            <input id="a-mobile" className="input" value={profile.mobile} onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
          </div>
        </div>
        <ErrorNote message={msg.err} />
        {msg.ok && <p className="text-sm text-success">{msg.ok}</p>}
        <button className="btn btn-gold">Save profile</button>
      </form>
      <form onSubmit={savePw} className="glass mt-6 space-y-4 p-6">
        <h2 className="font-semibold text-ivory">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="a-cur">Current password</label>
            <input id="a-cur" type="password" className="input" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="a-new">New password</label>
            <input id="a-new" type="password" className="input" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            <p className="hint">At least 10 characters.</p>
          </div>
        </div>
        <ErrorNote message={pwMsg.err} />
        {pwMsg.ok && <p className="text-sm text-success">{pwMsg.ok}</p>}
        <button className="btn btn-gold">Change password</button>
      </form>
    </div>
  );
}
