import { ArrowDown, ArrowUp, ChevronLeft, Eye, EyeOff, Pencil, Plus, Trash2, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Course } from "@/lib/api";
import { useSite } from "@/lib/context";
import { peso } from "@/lib/format";
import { COURSE_ICONS, ErrorNote, Spinner } from "@/components/ui";
import { AdminPageHeader, FormGrid, Modal, useToast, type FieldDef } from "./kit";

type AdminCourse = Course & { modules: number; lessons: number; enrolled: number };
type Lesson = {
  id: number;
  title: string;
  summary: string;
  videoUrl: string;
  durationLabel: string;
  resources: { label: string; url: string }[];
  isPreview: boolean;
  published: boolean;
};
type FullCourse = Course & { modules: { id: number; title: string; description: string; lessons: Lesson[] }[] };

const STATUS_LABEL = { coming_soon: "Opening soon", open: "Open", closed: "Closed" };

export function AdminCourses() {
  const [rows, setRows] = useState<AdminCourse[] | null>(null);
  const [creating, setCreating] = useState<{ title: string; slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    api.get<AdminCourse[]>("/api/admin/courses").then(setRows).catch(() => {});
  }, []);
  if (!rows) return <Spinner />;
  return (
    <>
      <AdminPageHeader
        title="Courses & Lessons"
        sub="Edit course details, prices, GoHighLevel checkout links, curriculum, lesson videos and enrollment status."
        actions={
          <button className="btn btn-gold" onClick={() => setCreating({ title: "", slug: "" })}>
            <Plus className="h-4 w-4" /> New course
          </button>
        }
      />
      <div className="grid gap-4">
        {rows.map((c) => (
          <Link key={c.id} to={`/admin/courses/${c.id}`} className="glass flex flex-col gap-4 p-5 transition hover:border-gold/60 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg text-ivory">{c.title}</span>
                {!c.published && <span className="badge badge-muted">Hidden</span>}
              </div>
              <div className="mt-1 text-xs text-muted">
                /courses/{c.slug} · {c.modules} module(s) · {c.lessons} lesson(s) · {c.enrolled} active enrollment(s)
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <span className="text-muted">Self-paced</span>
              <span className="text-ivory/90">
                {peso(c.priceSelfPaced)} · {STATUS_LABEL[c.selfPacedStatus]}
                {!c.checkoutSelfPaced && <span className="text-gold-bright"> · no checkout link</span>}
              </span>
              <span className="text-muted">Guided</span>
              <span className="text-ivory/90">
                {peso(c.priceGuided)} · {STATUS_LABEL[c.guidedStatus]}
                {!c.checkoutGuided && <span className="text-gold-bright"> · no checkout link</span>}
              </span>
            </div>
            <Pencil className="hidden h-4 w-4 text-gold md:block" />
          </Link>
        ))}
      </div>
      {creating && (
        <Modal title="New course" onClose={() => setCreating(null)}>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="nc-title">Course title</label>
              <input
                id="nc-title"
                className="input"
                value={creating.title}
                onChange={(e) =>
                  setCreating({
                    title: e.target.value,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                  })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="nc-slug">URL slug</label>
              <input id="nc-slug" className="input" value={creating.slug} onChange={(e) => setCreating({ ...creating, slug: e.target.value })} />
              <p className="hint">New courses start hidden until you publish them.</p>
            </div>
            <ErrorNote message={error} />
            <button
              className="btn btn-gold"
              onClick={async () => {
                try {
                  const c = await api.post<FullCourse>("/api/admin/courses", creating);
                  navigate(`/admin/courses/${c.id}`);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Create course
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

const statusOptions = [
  { value: "coming_soon", label: "Opening soon (button → inquiry form)" },
  { value: "open", label: "Open (button → checkout link)" },
  { value: "closed", label: "Closed" },
];

const DETAIL_FIELDS: FieldDef[] = [
  { key: "title", label: "Course title", type: "text" },
  { key: "slug", label: "URL slug", type: "text", hint: "Used in /courses/<slug>." },
  { key: "tagline", label: "Short tagline", type: "text", wide: true },
  { key: "description", label: "Description", type: "textarea" },
  { key: "topicsText", label: "What this course covers (one per line)", type: "textarea" },
  { key: "outcome", label: "Learning objective / practical output", type: "textarea" },
  { key: "toolsText", label: "Tools that may be discussed (one per line)", type: "textarea", hint: "Third-party subscriptions are never included — the site says so automatically." },
  {
    key: "icon",
    label: "Icon",
    type: "select",
    options: Object.keys(COURSE_ICONS).map((k) => ({ value: k, label: k })),
  },
  { key: "sort", label: "Display order", type: "number" },
  { key: "coverImage", label: "Cover image (optional — a branded placeholder is used otherwise)", type: "image" },
  { key: "published", label: "Published on the website", type: "checkbox", wide: true },
];

const PRICING_FIELDS: FieldDef[] = [
  { key: "priceSelfPaced", label: "Self-paced price (one-time)", type: "price" },
  { key: "selfPacedStatus", label: "Self-paced enrollment", type: "select", options: statusOptions },
  { key: "checkoutSelfPaced", label: "Self-paced — GoHighLevel checkout link", type: "url", wide: true },
  { key: "priceGuided", label: "Guided workshop price (one-time)", type: "price" },
  { key: "guidedStatus", label: "Guided enrollment", type: "select", options: statusOptions },
  { key: "checkoutGuided", label: "Guided — GoHighLevel checkout link", type: "url", wide: true },
  {
    key: "guidedIncludesRecordings",
    label: "Guided workshop students can also watch the recorded lessons",
    type: "checkbox",
    wide: true,
    hint: "Decide this per course. When off, guided students see only their workshop schedule in the portal.",
  },
  { key: "accessNote", label: "Access details (shown on the course page)", type: "textarea", hint: "e.g. recording access period — leave as “to be announced” until confirmed." },
  { key: "scheduleNote", label: "Schedule note", type: "textarea" },
];

export function AdminCourseEditor() {
  const { id } = useParams();
  const [course, setCourse] = useState<FullCourse | null>(null);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<"details" | "pricing" | "curriculum">("details");
  const [lesson, setLesson] = useState<(Partial<Lesson> & { moduleId?: number; resourcesText?: string }) | null>(null);
  const [lessonErr, setLessonErr] = useState<string | null>(null);
  const toast = useToast();
  const { reload } = useSite();

  const apply = useCallback((c: FullCourse) => {
    setCourse(c);
    setForm({ ...c, topicsText: c.topics.join("\n"), toolsText: c.tools.join("\n") });
  }, []);
  useEffect(() => {
    api.get<FullCourse>(`/api/admin/courses/${id}`).then(apply).catch(toast.err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!course || !form) return <Spinner />;

  const saveFields = async (fields: FieldDef[]) => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.key === "topicsText") payload.topics = String(form.topicsText ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
      else if (f.key === "toolsText") payload.tools = String(form.toolsText ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
      else payload[f.key] = f.type === "checkbox" ? !!form[f.key] : form[f.key];
    }
    try {
      apply(await api.put<FullCourse>(`/api/admin/courses/${course.id}`, payload));
      toast.ok("Course saved.");
      reload();
    } catch (e) {
      toast.err(e);
    }
  };

  const call = async (p: Promise<FullCourse>, msg?: string) => {
    try {
      apply(await p);
      if (msg) toast.ok(msg);
      reload();
    } catch (e) {
      toast.err(e);
    }
  };

  const saveLesson = async () => {
    if (!lesson) return;
    setLessonErr(null);
    const resources = (lesson.resourcesText ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, ...rest] = l.split("|");
        return { label: label.trim(), url: rest.join("|").trim() };
      });
    const payload = {
      title: lesson.title ?? "",
      summary: lesson.summary ?? "",
      videoUrl: lesson.videoUrl ?? "",
      durationLabel: lesson.durationLabel ?? "",
      isPreview: !!lesson.isPreview,
      published: lesson.published ?? true,
      resources,
    };
    try {
      const c = lesson.id
        ? await api.put<FullCourse>(`/api/admin/lessons/${lesson.id}`, payload)
        : await api.post<FullCourse>(`/api/admin/modules/${lesson.moduleId}/lessons`, payload);
      apply(c);
      setLesson(null);
      toast.ok("Lesson saved.");
    } catch (e) {
      setLessonErr((e as Error).message);
    }
  };

  return (
    <>
      <Link to="/admin/courses" className="mb-4 inline-flex items-center gap-1 text-sm text-gold">
        <ChevronLeft className="h-4 w-4" /> All courses
      </Link>
      <AdminPageHeader
        title={course.title}
        sub={`/courses/${course.slug}`}
        actions={
          <Link to={`/courses/${course.slug}`} target="_blank" className="btn btn-outline">
            <Eye className="h-4 w-4" /> View page
          </Link>
        }
      />
      <div className="mb-6 flex gap-2 border-b border-gold/15">
        {(["details", "pricing", "curriculum"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold capitalize ${
              tab === t ? "border-gold-bright text-gold-bright" : "border-transparent text-muted hover:text-ivory"
            }`}
          >
            {t === "pricing" ? "Pricing & checkout" : t}
          </button>
        ))}
      </div>

      {tab !== "curriculum" ? (
        <div className="glass max-w-4xl p-6">
          <FormGrid fields={tab === "details" ? DETAIL_FIELDS : PRICING_FIELDS} data={form} setData={setForm} />
          <button className="btn btn-gold mt-6" onClick={() => saveFields(tab === "details" ? DETAIL_FIELDS : PRICING_FIELDS)}>
            Save {tab === "details" ? "details" : "pricing & checkout"}
          </button>
        </div>
      ) : (
        <div className="max-w-4xl space-y-4">
          <p className="placeholder-note">
            Paste lesson video links from your video host (Vimeo, YouTube unlisted, Bunny Stream, Loom, Google Drive or a direct
            MP4). Video links are sent only to enrolled students. For stronger protection, use a host that supports
            domain-restricted embedding.
          </p>
          {course.modules.map((m, mi) => (
            <section key={m.id} className="glass p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">Module {mi + 1}</span>
                <input
                  className="input flex-1 py-1.5 font-semibold"
                  defaultValue={m.title}
                  onBlur={(e) => e.target.value !== m.title && call(api.put(`/api/admin/modules/${m.id}`, { title: e.target.value }), "Module renamed.")}
                  aria-label="Module title"
                />
                <button className="btn btn-ghost p-2" onClick={() => call(api.post(`/api/admin/modules/${m.id}/move`, { direction: "up" }))} aria-label="Move module up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button className="btn btn-ghost p-2" onClick={() => call(api.post(`/api/admin/modules/${m.id}/move`, { direction: "down" }))} aria-label="Move module down">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  className="btn btn-ghost p-2 text-danger"
                  onClick={() => confirm("Delete this module and all its lessons?") && call(api.del(`/api/admin/modules/${m.id}`), "Module deleted.")}
                  aria-label="Delete module"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-4 divide-y divide-gold/10 rounded-xl border border-gold/15">
                {m.lessons.length === 0 && <li className="px-4 py-3 text-sm text-muted">No lessons yet.</li>}
                {m.lessons.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <Video className={`h-4 w-4 ${l.videoUrl ? "text-gold-bright" : "text-muted"}`} />
                    <span className="flex-1 text-ivory/90">
                      {l.title}
                      <span className="ml-2 text-xs text-muted">
                        {l.durationLabel}
                        {!l.videoUrl && " · no video yet"}
                        {l.isPreview && " · free preview"}
                      </span>
                    </span>
                    {!l.published && (
                      <span className="badge badge-muted">
                        <EyeOff className="h-3 w-3" /> Hidden
                      </span>
                    )}
                    <button className="btn btn-ghost p-2" onClick={() => call(api.post(`/api/admin/lessons/${l.id}/move`, { direction: "up" }))} aria-label="Move lesson up">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button className="btn btn-ghost p-2" onClick={() => call(api.post(`/api/admin/lessons/${l.id}/move`, { direction: "down" }))} aria-label="Move lesson down">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      className="btn btn-ghost p-2"
                      onClick={() => {
                        setLessonErr(null);
                        setLesson({ ...l, resourcesText: l.resources.map((r) => `${r.label} | ${r.url}`).join("\n") });
                      }}
                      aria-label="Edit lesson"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="btn btn-ghost p-2 text-danger"
                      onClick={() => confirm("Delete this lesson?") && call(api.del(`/api/admin/lessons/${l.id}`), "Lesson deleted.")}
                      aria-label="Delete lesson"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-outline mt-3 px-3 py-1.5 text-xs"
                onClick={() => {
                  setLessonErr(null);
                  setLesson({ moduleId: m.id, title: "", published: true });
                }}
              >
                <Plus className="h-3 w-3" /> Add lesson
              </button>
            </section>
          ))}
          <button
            className="btn btn-gold"
            onClick={() => call(api.post(`/api/admin/courses/${course.id}/modules`, { title: `Module ${course.modules.length + 1}` }), "Module added.")}
          >
            <Plus className="h-4 w-4" /> Add module
          </button>
        </div>
      )}

      {lesson && (
        <Modal title={lesson.id ? "Edit lesson" : "New lesson"} onClose={() => setLesson(null)} wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ls-title">Lesson title</label>
              <input id="ls-title" className="input" value={lesson.title ?? ""} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ls-video">Video link</label>
              <input id="ls-video" className="input" placeholder="https://vimeo.com/… or https://youtu.be/…" value={lesson.videoUrl ?? ""} onChange={(e) => setLesson({ ...lesson, videoUrl: e.target.value })} />
              <p className="hint">Leave empty to show a “Recording coming soon” placeholder.</p>
            </div>
            <div>
              <label className="label" htmlFor="ls-dur">Duration label</label>
              <input id="ls-dur" className="input" placeholder="e.g. 12 min" value={lesson.durationLabel ?? ""} onChange={(e) => setLesson({ ...lesson, durationLabel: e.target.value })} />
            </div>
            <div className="flex flex-col justify-end gap-2 text-sm text-ivory/90">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[#d6a524]" checked={lesson.published ?? true} onChange={(e) => setLesson({ ...lesson, published: e.target.checked })} />
                Published
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[#d6a524]" checked={!!lesson.isPreview} onChange={(e) => setLesson({ ...lesson, isPreview: e.target.checked })} />
                Free preview (video visible on the public course page)
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ls-sum">Lesson description</label>
              <textarea id="ls-sum" rows={4} className="input" value={lesson.summary ?? ""} onChange={(e) => setLesson({ ...lesson, summary: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ls-res">Resources (one per line: Label | https://link)</label>
              <textarea id="ls-res" rows={3} className="input font-mono text-xs" placeholder="Worksheet | https://drive.google.com/…" value={lesson.resourcesText ?? ""} onChange={(e) => setLesson({ ...lesson, resourcesText: e.target.value })} />
            </div>
          </div>
          <div className="mt-4">
            <ErrorNote message={lessonErr} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setLesson(null)}>Cancel</button>
            <button className="btn btn-gold" onClick={saveLesson}>Save lesson</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
