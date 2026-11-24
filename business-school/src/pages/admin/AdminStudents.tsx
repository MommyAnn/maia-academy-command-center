import { ChevronLeft, GraduationCap, Plus, Search, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { FORMAT_LABEL, formatDate, formatDateTime } from "@/lib/format";
import { ErrorNote, Spinner } from "@/components/ui";
import { AdminPageHeader, Modal, useToast } from "./kit";

type StudentRow = {
  id: number;
  email: string;
  name: string;
  mobile: string;
  role: "student" | "admin";
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt: string | null;
  activeEnrollments: number;
};
type Enrollment = {
  id: number;
  courseId: number;
  courseTitle: string;
  format: "self_paced" | "guided";
  source: string;
  status: "active" | "revoked";
  batchId: number | null;
  batchTitle: string | null;
  expiresAt: string | null;
  note: string;
  createdAt: string;
  lessonsTotal: number;
  lessonsDone: number;
};
type Student = Omit<StudentRow, "activeEnrollments"> & { enrollments: Enrollment[] };
type Batch = { id: number; courseId: number | null; title: string; status: string };

const sqlDate = (v: string | null) => (v ? formatDateTime(v.includes("T") ? v : v.replace(" ", "T") + "Z") : "—");

export function AdminStudents() {
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<null | { name: string; email: string; mobile: string; password: string; role: string }>(null);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback((query: string) => {
    api.get<StudentRow[]>(`/api/admin/students?q=${encodeURIComponent(query)}`).then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <>
      <AdminPageHeader
        title="Students & Enrollments"
        sub="Students can register themselves; course access is granted here after payment is confirmed. (Automatic access from GoHighLevel payments is not connected yet.)"
        actions={
          <button className="btn btn-gold" onClick={() => { setErr(null); setCreating({ name: "", email: "", mobile: "", password: "", role: "student" }); }}>
            <UserPlus className="h-4 w-4" /> Add student
          </button>
        }
      />
      <div className="relative mb-5 max-w-md">
        <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-10" placeholder="Search name, email or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="placeholder-note">No students found.</p>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gold/20 text-xs tracking-[0.12em] text-gold uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Enrollments</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer text-ivory/85 hover:bg-ivory/5" onClick={() => navigate(`/admin/students/${r.id}`)}>
                  <td className="px-4 py-3 font-semibold text-ivory">
                    <Link to={`/admin/students/${r.id}`}>{r.name}</Link>
                    {r.role === "admin" && <span className="badge badge-gold ml-2">Admin</span>}
                  </td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.mobile || "—"}</td>
                  <td className="px-4 py-3">{r.activeEnrollments}</td>
                  <td className="px-4 py-3">{formatDate(r.createdAt.replace(" ", "T") + "Z")}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${r.status === "active" ? "badge-success" : "badge-danger"}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <Modal title="Add student account" onClose={() => setCreating(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["name", "email", "mobile"] as const).map((k) => (
              <div key={k} className={k === "name" ? "sm:col-span-2" : ""}>
                <label className="label capitalize" htmlFor={`ns-${k}`}>{k === "name" ? "Full name" : k}</label>
                <input id={`ns-${k}`} className="input" value={creating[k]} onChange={(e) => setCreating({ ...creating, [k]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="label" htmlFor="ns-pass">Temporary password</label>
              <input id="ns-pass" className="input" value={creating.password} onChange={(e) => setCreating({ ...creating, password: e.target.value })} />
              <p className="hint">At least 10 characters. Share it privately; the student can change it in Account.</p>
            </div>
            <div>
              <label className="label" htmlFor="ns-role">Role</label>
              <select id="ns-role" className="input" value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value })}>
                <option value="student">Student</option>
                <option value="admin">Admin (full dashboard access)</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <ErrorNote message={err} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setCreating(null)}>Cancel</button>
            <button
              className="btn btn-gold"
              onClick={async () => {
                try {
                  const s = await api.post<Student>("/api/admin/students", creating);
                  navigate(`/admin/students/${s.id}`);
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              Create account
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AdminStudentDetail() {
  const { id } = useParams();
  const [s, setS] = useState<Student | null>(null);
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [grant, setGrant] = useState({ courseId: "", format: "self_paced", batchId: "", expiresAt: "", note: "" });
  const [newPw, setNewPw] = useState("");
  const toast = useToast();

  useEffect(() => {
    api.get<Student>(`/api/admin/students/${id}`).then(setS).catch(toast.err);
    api.get<{ id: number; title: string }[]>("/api/admin/courses").then(setCourses).catch(() => {});
    api.get<Batch[]>("/api/admin/batches").then(setBatches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!s) return <Spinner />;

  const run = async (p: Promise<Student>, msg: string) => {
    try {
      setS(await p);
      toast.ok(msg);
    } catch (e) {
      toast.err(e);
    }
  };

  return (
    <>
      <Link to="/admin/students" className="mb-4 inline-flex items-center gap-1 text-sm text-gold">
        <ChevronLeft className="h-4 w-4" /> All students
      </Link>
      <AdminPageHeader
        title={s.name}
        sub={
          <>
            {s.email}
            {s.mobile && ` · ${s.mobile}`} · joined {sqlDate(s.createdAt)} · last sign-in {sqlDate(s.lastLoginAt)}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="glass p-6">
          <h2 className="font-display text-lg text-ivory">Enrollments</h2>
          {s.enrollments.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No enrollments yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {s.enrollments.map((e) => (
                <div key={e.id} className={`rounded-xl border p-4 ${e.status === "active" ? "border-gold/25" : "border-ivory/10 opacity-60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-ivory">{e.courseTitle}</span>
                      <span className={`badge ml-2 ${e.format === "guided" ? "badge-gold" : "badge-muted"}`}>{FORMAT_LABEL[e.format]}</span>
                      {e.source === "program" && <span className="badge badge-muted ml-1">Complete program</span>}
                    </div>
                    <span className={`badge ${e.status === "active" ? "badge-success" : "badge-danger"}`}>{e.status}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    Progress {e.lessonsDone}/{e.lessonsTotal} lessons · granted {sqlDate(e.createdAt)}
                    {e.note && ` · ${e.note}`}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {e.format === "guided" && (
                      <select
                        className="input py-1.5 text-xs"
                        value={e.batchId ?? ""}
                        onChange={(ev) => run(api.put(`/api/admin/enrollments/${e.id}`, { batchId: ev.target.value ? Number(ev.target.value) : null }), "Batch assigned.")}
                        aria-label="Assigned batch"
                      >
                        <option value="">No batch assigned</option>
                        {batches.filter((b) => b.courseId === e.courseId).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} ({b.status})
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="date"
                      className="input py-1.5 text-xs"
                      defaultValue={e.expiresAt ? e.expiresAt.slice(0, 10) : ""}
                      onBlur={(ev) => {
                        const v = ev.target.value;
                        if (v !== (e.expiresAt ?? "").slice(0, 10))
                          run(api.put(`/api/admin/enrollments/${e.id}`, { expiresAt: v ? `${v}T23:59:59` : "" }), "Access period updated.");
                      }}
                      aria-label="Access expires on"
                      title="Access expires on (empty = no expiry)"
                    />
                    <button
                      className={`btn px-3 py-1.5 text-xs ${e.status === "active" ? "btn-danger" : "btn-outline"}`}
                      onClick={() =>
                        run(
                          api.put(`/api/admin/enrollments/${e.id}`, { status: e.status === "active" ? "revoked" : "active" }),
                          e.status === "active" ? "Access revoked." : "Access restored.",
                        )
                      }
                    >
                      {e.status === "active" ? "Revoke access" : "Restore access"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="hairline my-6" />
          <h3 className="font-semibold text-ivory">Grant course access</h3>
          <p className="mt-1 text-xs text-muted">Use after confirming payment. Leave the expiry empty for no end date.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select className="input" value={grant.courseId} onChange={(e) => setGrant({ ...grant, courseId: e.target.value, batchId: "" })} aria-label="Course">
              <option value="">Choose course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select className="input" value={grant.format} onChange={(e) => setGrant({ ...grant, format: e.target.value })} aria-label="Format">
              <option value="self_paced">Self-paced (recorded)</option>
              <option value="guided">Guided workshop</option>
            </select>
            {grant.format === "guided" && (
              <select className="input" value={grant.batchId} onChange={(e) => setGrant({ ...grant, batchId: e.target.value })} aria-label="Batch">
                <option value="">Assign batch later</option>
                {batches.filter((b) => String(b.courseId) === grant.courseId).map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            )}
            <input type="date" className="input" value={grant.expiresAt} onChange={(e) => setGrant({ ...grant, expiresAt: e.target.value })} aria-label="Access expires on" />
            <input className="input sm:col-span-2" placeholder="Note (e.g. payment reference)" value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-gold"
              disabled={!grant.courseId}
              onClick={() =>
                run(
                  api.post("/api/admin/enrollments", {
                    userId: s.id,
                    courseId: Number(grant.courseId),
                    format: grant.format,
                    batchId: grant.batchId ? Number(grant.batchId) : null,
                    expiresAt: grant.expiresAt ? `${grant.expiresAt}T23:59:59` : "",
                    note: grant.note,
                  }),
                  "Access granted.",
                )
              }
            >
              <Plus className="h-4 w-4" /> Grant access
            </button>
            <button
              className="btn btn-outline"
              onClick={() =>
                confirm("Grant the Complete 5-Workshop Program (guided access to every published course)?") &&
                run(
                  api.post("/api/admin/enrollments/program", {
                    userId: s.id,
                    expiresAt: grant.expiresAt ? `${grant.expiresAt}T23:59:59` : "",
                    note: grant.note || "Complete 5-Workshop Business Solutions Program",
                  }),
                  "Complete program granted.",
                )
              }
            >
              <GraduationCap className="h-4 w-4" /> Grant complete program
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="glass p-6">
            <h2 className="font-display text-lg text-ivory">Account</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <select
                  className="input w-auto py-1.5"
                  value={s.status}
                  onChange={(e) => run(api.put(`/api/admin/students/${s.id}`, { status: e.target.value }), "Account updated.")}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Role</span>
                <select
                  className="input w-auto py-1.5"
                  value={s.role}
                  onChange={(e) =>
                    (e.target.value !== "admin" || confirm("Give this person full admin access?")) &&
                    run(api.put(`/api/admin/students/${s.id}`, { role: e.target.value }), "Role updated.")
                  }
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>
          <div className="glass p-6">
            <h2 className="font-display text-lg text-ivory">Reset password</h2>
            <p className="mt-1 text-xs text-muted">Signs the student out everywhere. Share the new password privately.</p>
            <input className="input mt-4" placeholder="New password (10+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <button
              className="btn btn-outline mt-3"
              disabled={newPw.length < 10}
              onClick={async () => {
                try {
                  await api.post(`/api/admin/students/${s.id}/password`, { password: newPw });
                  setNewPw("");
                  toast.ok("Password reset.");
                } catch (e) {
                  toast.err(e);
                }
              }}
            >
              Set new password
            </button>
          </div>
        </section>
      </div>
      {toast.node}
    </>
  );
}
