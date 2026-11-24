import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { rename, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { hashPassword, requireAdmin } from "../auth.ts";
import { type DB, all, audit, get, run, tx } from "../db.ts";
import { DEFAULT_SETTINGS } from "../seed.ts";
import { type CourseRow, HttpError, idParam, parse, serializeCourse, text, urlField } from "../util.ts";
import { passwordField } from "./auth.ts";

const status3 = z.enum(["coming_soon", "open", "closed"]);
const camelToSnake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const snakeToCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toCamel = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [snakeToCamel(k), v]));

/** partial() still applies field defaults — keep only the keys the client actually sent. */
function onlySent<T extends Record<string, unknown>>(parsed: T, raw: unknown): Partial<T> {
  const sent = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => k in sent)) as Partial<T>;
}

/** Builds an UPDATE for the provided (already validated) fields only. */
function updateRow(db: DB, table: string, id: number, data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${camelToSnake(k)} = ?`).join(", ");
  const values = entries.map(([, v]) => (typeof v === "boolean" ? (v ? 1 : 0) : v));
  const res = run(db, `UPDATE ${table} SET ${sets} WHERE id = ?`, ...values, id);
  if (res.changes === 0) throw new HttpError(404, "Not found.");
}

function insertRow(db: DB, table: string, data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => camelToSnake(k)).join(", ");
  const marks = entries.map(() => "?").join(", ");
  const values = entries.map(([, v]) => (typeof v === "boolean" ? (v ? 1 : 0) : v));
  return Number(run(db, `INSERT INTO ${table} (${cols}) VALUES (${marks})`, ...values).lastInsertRowid);
}

export function adminRoutes(db: DB, opts: { uploadDir: string }) {
  const r = Router();
  r.use(requireAdmin);
  const actor = (req: { user?: { id: number } }) => req.user!.id;

  // ───────────────────────── Overview ─────────────────────────
  r.get("/overview", (_req, res) => {
    const n = (sql: string) => get<{ n: number }>(db, sql)!.n;
    res.json({
      students: n("SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),
      activeEnrollments: n("SELECT COUNT(*) AS n FROM enrollments WHERE status = 'active'"),
      newInquiries: n("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'"),
      openBatches: n("SELECT COUNT(*) AS n FROM batches WHERE status = 'open'"),
      publishedCourses: n("SELECT COUNT(*) AS n FROM courses WHERE published = 1"),
      lessonsWithoutVideo: n(
        "SELECT COUNT(*) AS n FROM lessons WHERE published = 1 AND video_url = ''",
      ),
      publishedProducts: n("SELECT COUNT(*) AS n FROM products WHERE status = 'published'"),
      publishedTestimonials: n("SELECT COUNT(*) AS n FROM testimonials WHERE status = 'published' AND consent = 1"),
      missingCheckoutLinks: n(
        "SELECT (SELECT COUNT(*) FROM courses WHERE published = 1 AND checkout_self_paced = '') + (SELECT COUNT(*) FROM courses WHERE published = 1 AND checkout_guided = '') AS n",
      ),
      programCheckoutSet: !!get<{ value: string }>(db, "SELECT value FROM settings WHERE key = 'program.checkoutUrl'")
        ?.value,
      recentAudit: all(
        db,
        `SELECT a.action, a.detail, a.created_at AS createdAt, u.name AS actor
           FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 12`,
      ),
    });
  });

  // ───────────────────────── Courses ─────────────────────────
  const courseSchema = z.object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "use lowercase letters, numbers and dashes"),
    title: text(120).min(2),
    tagline: text(300),
    description: text(4000),
    topics: z.array(text(200)).max(30),
    outcome: text(1000),
    tools: z.array(text(100)).max(30),
    coverImage: urlField,
    icon: text(40),
    priceSelfPaced: z.number().int().min(0).max(10_000_000),
    priceGuided: z.number().int().min(0).max(10_000_000),
    checkoutSelfPaced: urlField,
    checkoutGuided: urlField,
    selfPacedStatus: status3,
    guidedStatus: status3,
    guidedIncludesRecordings: z.boolean(),
    accessNote: text(1000),
    scheduleNote: text(1000),
    published: z.boolean(),
    sort: z.number().int(),
  });

  const loadCourse = (id: number) => {
    const c = get<CourseRow>(db, "SELECT * FROM courses WHERE id = ?", id);
    if (!c) throw new HttpError(404, "Course not found.");
    const modules = all<{ id: number; title: string; description: string; sort: number }>(
      db,
      "SELECT id, title, description, sort FROM modules WHERE course_id = ? ORDER BY sort, id",
      id,
    );
    const lessons = all<Record<string, unknown>>(
      db,
      `SELECT l.* FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ? ORDER BY l.sort, l.id`,
      id,
    );
    return {
      ...serializeCourse(c),
      modules: modules.map((m) => ({
        ...m,
        lessons: lessons
          .filter((l) => l.module_id === m.id)
          .map((l) => ({
            id: l.id,
            title: l.title,
            summary: l.summary,
            videoUrl: l.video_url,
            durationLabel: l.duration_label,
            resources: JSON.parse(String(l.resources || "[]")),
            isPreview: !!l.is_preview,
            published: !!l.published,
            sort: l.sort,
          })),
      })),
    };
  };

  r.get("/courses", (_req, res) => {
    const rows = all<CourseRow & { modules: number; lessons: number; enrolled: number }>(
      db,
      `SELECT c.*,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules,
              (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS lessons,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS enrolled
         FROM courses c ORDER BY c.sort, c.id`,
    );
    res.json(rows.map((c) => ({ ...serializeCourse(c), modules: c.modules, lessons: c.lessons, enrolled: c.enrolled })));
  });

  r.get("/courses/:id", (req, res) => res.json(loadCourse(idParam(req))));

  r.post("/courses", (req, res) => {
    const body = parse(courseSchema.pick({ slug: true, title: true }), req.body);
    if (get(db, "SELECT id FROM courses WHERE slug = ?", body.slug)) throw new HttpError(409, "That URL slug is taken.");
    const sort = get<{ n: number }>(db, "SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM courses")!.n;
    const id = insertRow(db, "courses", { ...body, sort, published: false });
    audit(db, actor(req), "course.create", body.title);
    res.status(201).json(loadCourse(id));
  });

  r.put("/courses/:id", (req, res) => {
    const id = idParam(req);
    const body = parse(courseSchema.partial(), req.body);
    if (body.slug && get(db, "SELECT id FROM courses WHERE slug = ? AND id != ?", body.slug, id))
      throw new HttpError(409, "That URL slug is taken.");
    const data: Record<string, unknown> = { ...body };
    if (body.topics) data.topics = JSON.stringify(body.topics);
    if (body.tools) data.tools = JSON.stringify(body.tools);
    updateRow(db, "courses", id, data);
    run(db, "UPDATE courses SET updated_at = datetime('now') WHERE id = ?", id);
    audit(db, actor(req), "course.update", `#${id} ${Object.keys(body).join(", ")}`);
    res.json(loadCourse(id));
  });

  r.delete("/courses/:id", (req, res) => {
    const id = idParam(req);
    const enrolled = get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?", id)!.n;
    if (enrolled > 0) throw new HttpError(409, "This course has enrollments. Unpublish it instead of deleting.");
    run(db, "DELETE FROM courses WHERE id = ?", id);
    audit(db, actor(req), "course.delete", `#${id}`);
    res.json({ ok: true });
  });

  // Modules
  const moduleSchema = z.object({ title: text(200).min(1), description: text(2000).optional().default("") });
  r.post("/courses/:id/modules", (req, res) => {
    const courseId = idParam(req);
    const body = parse(moduleSchema, req.body);
    const sort = get<{ n: number }>(db, "SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM modules WHERE course_id = ?", courseId)!
      .n;
    insertRow(db, "modules", { courseId, ...body, sort });
    res.status(201).json(loadCourse(courseId));
  });
  r.put("/modules/:id", (req, res) => {
    const id = idParam(req);
    updateRow(db, "modules", id, onlySent(parse(moduleSchema.partial(), req.body), req.body));
    res.json(loadCourse(courseOfModule(id)));
  });
  r.delete("/modules/:id", (req, res) => {
    const id = idParam(req);
    const courseId = courseOfModule(id);
    run(db, "DELETE FROM modules WHERE id = ?", id);
    audit(db, actor(req), "module.delete", `#${id}`);
    res.json(loadCourse(courseId));
  });
  r.post("/modules/:id/move", (req, res) => {
    const id = idParam(req);
    const courseId = courseOfModule(id);
    reorder("modules", "course_id", courseId, id, parse(moveSchema, req.body).direction);
    res.json(loadCourse(courseId));
  });

  // Lessons
  const lessonSchema = z.object({
    title: text(200).min(1),
    summary: text(4000).optional().default(""),
    videoUrl: urlField.optional().default(""),
    durationLabel: text(40).optional().default(""),
    resources: z
      .array(z.object({ label: text(120).min(1), url: urlField.refine((v) => v !== "", "link required") }))
      .max(20)
      .optional()
      .default([]),
    isPreview: z.boolean().optional().default(false),
    published: z.boolean().optional().default(true),
  });
  r.post("/modules/:id/lessons", (req, res) => {
    const moduleId = idParam(req);
    const courseId = courseOfModule(moduleId);
    const body = parse(lessonSchema, req.body);
    const sort = get<{ n: number }>(db, "SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM lessons WHERE module_id = ?", moduleId)!
      .n;
    insertRow(db, "lessons", { moduleId, ...body, resources: JSON.stringify(body.resources), sort });
    res.status(201).json(loadCourse(courseId));
  });
  r.put("/lessons/:id", (req, res) => {
    const id = idParam(req);
    const body = onlySent(parse(lessonSchema.partial(), req.body), req.body);
    const data: Record<string, unknown> = { ...body };
    if (body.resources) data.resources = JSON.stringify(body.resources);
    updateRow(db, "lessons", id, data);
    audit(db, actor(req), "lesson.update", `#${id} ${Object.keys(body).join(", ")}`);
    res.json(loadCourse(courseOfLesson(id)));
  });
  r.delete("/lessons/:id", (req, res) => {
    const id = idParam(req);
    const courseId = courseOfLesson(id);
    run(db, "DELETE FROM lessons WHERE id = ?", id);
    audit(db, actor(req), "lesson.delete", `#${id}`);
    res.json(loadCourse(courseId));
  });
  r.post("/lessons/:id/move", (req, res) => {
    const id = idParam(req);
    const moduleId = get<{ module_id: number }>(db, "SELECT module_id FROM lessons WHERE id = ?", id)?.module_id;
    if (!moduleId) throw new HttpError(404, "Lesson not found.");
    reorder("lessons", "module_id", moduleId, id, parse(moveSchema, req.body).direction);
    res.json(loadCourse(courseOfLesson(id)));
  });

  const moveSchema = z.object({ direction: z.enum(["up", "down"]) });
  function reorder(table: "modules" | "lessons", parentCol: string, parentId: number, id: number, dir: "up" | "down") {
    const rows = all<{ id: number }>(db, `SELECT id FROM ${table} WHERE ${parentCol} = ? ORDER BY sort, id`, parentId);
    const i = rows.findIndex((x) => x.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    tx(db, () => rows.forEach((row, idx) => run(db, `UPDATE ${table} SET sort = ? WHERE id = ?`, idx + 1, row.id)));
  }
  function courseOfModule(id: number) {
    const row = get<{ course_id: number }>(db, "SELECT course_id FROM modules WHERE id = ?", id);
    if (!row) throw new HttpError(404, "Module not found.");
    return row.course_id;
  }
  function courseOfLesson(id: number) {
    const row = get<{ course_id: number }>(
      db,
      "SELECT m.course_id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ?",
      id,
    );
    if (!row) throw new HttpError(404, "Lesson not found.");
    return row.course_id;
  }

  // ───────────────────────── Students & enrollments ─────────────────────────
  r.get("/students", (req, res) => {
    const q = typeof req.query.q === "string" ? `%${req.query.q.trim()}%` : "%";
    res.json(
      all(
        db,
        `SELECT u.id, u.email, u.name, u.mobile, u.role, u.status, u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
                (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status = 'active') AS activeEnrollments
           FROM users u WHERE (u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)
          ORDER BY u.id DESC LIMIT 500`,
        q,
        q,
        q,
      ),
    );
  });

  const loadStudent = (id: number) => {
    const user = get(
      db,
      `SELECT id, email, name, mobile, role, status, created_at AS createdAt, last_login_at AS lastLoginAt FROM users WHERE id = ?`,
      id,
    );
    if (!user) throw new HttpError(404, "Student not found.");
    const enrollments = all(
      db,
      `SELECT e.id, e.course_id AS courseId, c.title AS courseTitle, e.format, e.source, e.status, e.batch_id AS batchId,
              b.title AS batchTitle, e.expires_at AS expiresAt, e.note, e.created_at AS createdAt,
              (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = e.course_id AND l.published = 1) AS lessonsTotal,
              (SELECT COUNT(*) FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id JOIN modules m ON m.id = l.module_id
                WHERE p.user_id = e.user_id AND m.course_id = e.course_id AND p.completed_at IS NOT NULL AND l.published = 1) AS lessonsDone
         FROM enrollments e JOIN courses c ON c.id = e.course_id LEFT JOIN batches b ON b.id = e.batch_id
        WHERE e.user_id = ? ORDER BY c.sort, e.format`,
      id,
    );
    return { ...user, enrollments };
  };

  r.get("/students/:id", (req, res) => res.json(loadStudent(idParam(req))));

  const newStudentSchema = z.object({
    name: text(120).min(2),
    email: z.email().max(200),
    mobile: text(40).optional().default(""),
    password: passwordField,
    role: z.enum(["student", "admin"]).optional().default("student"),
  });
  r.post("/students", async (req, res) => {
    const body = parse(newStudentSchema, req.body);
    if (get(db, "SELECT id FROM users WHERE email = ?", body.email))
      throw new HttpError(409, "An account with this email already exists.");
    const id = insertRow(db, "users", {
      email: body.email.toLowerCase(),
      name: body.name,
      mobile: body.mobile,
      role: body.role,
      passwordHash: await hashPassword(body.password),
    });
    audit(db, actor(req), "user.create", `${body.email} (${body.role})`);
    res.status(201).json(loadStudent(id));
  });

  const editStudentSchema = z.object({
    name: text(120).min(2),
    mobile: text(40),
    status: z.enum(["active", "disabled"]),
    role: z.enum(["student", "admin"]),
  });
  r.put("/students/:id", (req, res) => {
    const id = idParam(req);
    const body = parse(editStudentSchema.partial(), req.body);
    if (id === actor(req) && (body.status === "disabled" || body.role === "student"))
      throw new HttpError(400, "You cannot disable or demote your own admin account.");
    updateRow(db, "users", id, body);
    if (body.status === "disabled") run(db, "DELETE FROM sessions WHERE user_id = ?", id);
    audit(db, actor(req), "user.update", `#${id} ${JSON.stringify(body)}`);
    res.json(loadStudent(id));
  });

  r.post("/students/:id/password", async (req, res) => {
    const id = idParam(req);
    const body = parse(z.object({ password: passwordField }), req.body);
    updateRow(db, "users", id, { passwordHash: await hashPassword(body.password) });
    run(db, "DELETE FROM sessions WHERE user_id = ?", id);
    audit(db, actor(req), "user.password_reset", `#${id}`);
    res.json({ ok: true });
  });

  const dateField = z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "invalid date")
    .transform((v) => (v ? new Date(v).toISOString() : null));

  const enrollSchema = z.object({
    userId: z.number().int().positive(),
    courseId: z.number().int().positive(),
    format: z.enum(["self_paced", "guided"]),
    batchId: z.number().int().positive().nullable().optional().default(null),
    expiresAt: dateField,
    note: text(1000).optional().default(""),
  });
  r.post("/enrollments", (req, res) => {
    const body = parse(enrollSchema, req.body);
    if (!get(db, "SELECT id FROM users WHERE id = ?", body.userId)) throw new HttpError(404, "Student not found.");
    if (!get(db, "SELECT id FROM courses WHERE id = ?", body.courseId)) throw new HttpError(404, "Course not found.");
    run(
      db,
      `INSERT INTO enrollments (user_id, course_id, format, source, status, batch_id, expires_at, note, created_by)
       VALUES (?, ?, ?, 'manual', 'active', ?, ?, ?, ?)
       ON CONFLICT (user_id, course_id, format) DO UPDATE SET status = 'active', batch_id = excluded.batch_id,
         expires_at = excluded.expires_at, note = excluded.note`,
      body.userId,
      body.courseId,
      body.format,
      body.batchId,
      body.expiresAt,
      body.note,
      actor(req),
    );
    audit(db, actor(req), "enrollment.grant", `user #${body.userId} course #${body.courseId} ${body.format}`);
    res.status(201).json(loadStudent(body.userId));
  });

  /** Complete program = guided enrollment in every published course. */
  r.post("/enrollments/program", (req, res) => {
    const body = parse(
      z.object({
        userId: z.number().int().positive(),
        expiresAt: dateField,
        note: text(1000).optional().default("Complete 5-Workshop Business Solutions Program"),
      }),
      req.body,
    );
    if (!get(db, "SELECT id FROM users WHERE id = ?", body.userId)) throw new HttpError(404, "Student not found.");
    const courses = all<{ id: number }>(db, "SELECT id FROM courses WHERE published = 1");
    tx(db, () => {
      for (const c of courses)
        run(
          db,
          `INSERT INTO enrollments (user_id, course_id, format, source, status, expires_at, note, created_by)
           VALUES (?, ?, 'guided', 'program', 'active', ?, ?, ?)
           ON CONFLICT (user_id, course_id, format) DO UPDATE SET status = 'active', source = 'program',
             expires_at = excluded.expires_at, note = excluded.note`,
          body.userId,
          c.id,
          body.expiresAt,
          body.note,
          actor(req),
        );
    });
    audit(db, actor(req), "enrollment.program", `user #${body.userId}`);
    res.status(201).json(loadStudent(body.userId));
  });

  r.put("/enrollments/:id", (req, res) => {
    const id = idParam(req);
    const body = parse(
      z.object({
        status: z.enum(["active", "revoked"]),
        batchId: z.number().int().positive().nullable(),
        expiresAt: dateField,
        note: text(1000),
      }).partial(),
      req.body,
    );
    const row = get<{ user_id: number }>(db, "SELECT user_id FROM enrollments WHERE id = ?", id);
    if (!row) throw new HttpError(404, "Enrollment not found.");
    updateRow(db, "enrollments", id, body);
    audit(db, actor(req), "enrollment.update", `#${id} ${JSON.stringify(body)}`);
    res.json(loadStudent(row.user_id));
  });

  // ───────────────────────── Simple content tables ─────────────────────────
  const batchSchema = z.object({
    courseId: z.number().int().positive().nullable(),
    title: text(200).min(2),
    mode: z.enum(["zoom", "face_to_face"]),
    startsAt: text(40),
    endsAt: text(40),
    scheduleText: text(500),
    capacity: z.number().int().min(1).max(100_000).nullable(),
    status: z.enum(["draft", "open", "full", "completed", "cancelled"]),
    joinUrl: urlField,
    location: text(300),
    notes: text(2000),
  });
  const productSchema = z.object({
    title: text(200).min(2),
    category: text(80),
    description: text(4000),
    price: z.number().int().min(0).max(10_000_000).nullable(),
    checkoutUrl: urlField,
    imageUrl: urlField,
    status: z.enum(["draft", "published"]),
    sort: z.number().int(),
  });
  const testimonialSchema = z.object({
    name: text(120).min(1),
    role: text(200),
    quote: text(4000),
    videoUrl: urlField,
    photoUrl: urlField,
    courseId: z.number().int().positive().nullable(),
    consent: z.boolean(),
    status: z.enum(["draft", "published"]),
    sort: z.number().int(),
  });

  function crud(table: string, schema: z.ZodObject, order: string, guard?: (data: Record<string, unknown>) => void) {
    r.get(`/${table}`, (_req, res) => {
      res.json(all<Record<string, unknown>>(db, `SELECT * FROM ${table} ORDER BY ${order}`).map(toCamel));
    });
    r.post(`/${table}`, (req, res) => {
      const body = parse(schema, req.body) as Record<string, unknown>;
      guard?.(body);
      const id = insertRow(db, table, body);
      audit(db, actor(req), `${table}.create`, String(body.title ?? body.name ?? id));
      res.status(201).json(toCamel(get<Record<string, unknown>>(db, `SELECT * FROM ${table} WHERE id = ?`, id)!));
    });
    r.put(`/${table}/:id`, (req, res) => {
      const id = idParam(req);
      const body = parse(schema.partial(), req.body) as Record<string, unknown>;
      const merged = { ...toCamel(get<Record<string, unknown>>(db, `SELECT * FROM ${table} WHERE id = ?`, id) ?? {}), ...body };
      guard?.(merged);
      updateRow(db, table, id, body);
      audit(db, actor(req), `${table}.update`, `#${id}`);
      res.json(toCamel(get<Record<string, unknown>>(db, `SELECT * FROM ${table} WHERE id = ?`, id)!));
    });
    r.delete(`/${table}/:id`, (req, res) => {
      const id = idParam(req);
      run(db, `DELETE FROM ${table} WHERE id = ?`, id);
      audit(db, actor(req), `${table}.delete`, `#${id}`);
      res.json({ ok: true });
    });
  }

  crud("batches", batchSchema, "starts_at DESC, id DESC");
  crud("products", productSchema, "sort, id DESC");
  crud("testimonials", testimonialSchema, "sort, id DESC", (t) => {
    // Publishing student feedback requires recorded consent.
    if (t.status === "published" && !(t.consent === true || t.consent === 1))
      throw new HttpError(400, "Record the student's consent before publishing this testimonial.");
  });

  // ───────────────────────── Inquiries ─────────────────────────
  r.get("/inquiries", (_req, res) => {
    res.json(all<Record<string, unknown>>(db, "SELECT * FROM inquiries ORDER BY id DESC LIMIT 1000").map(toCamel));
  });
  r.put("/inquiries/:id", (req, res) => {
    const id = idParam(req);
    updateRow(
      db,
      "inquiries",
      id,
      parse(z.object({ status: z.enum(["new", "in_progress", "closed"]), adminNote: text(4000) }).partial(), req.body),
    );
    res.json(toCamel(get<Record<string, unknown>>(db, "SELECT * FROM inquiries WHERE id = ?", id)!));
  });
  r.delete("/inquiries/:id", (req, res) => {
    run(db, "DELETE FROM inquiries WHERE id = ?", idParam(req));
    audit(db, actor(req), "inquiries.delete", `#${req.params.id}`);
    res.json({ ok: true });
  });

  // ───────────────────────── Settings ─────────────────────────
  const URL_KEYS = new Set([
    "contact.messengerUrl",
    "social.facebook",
    "social.instagram",
    "social.tiktok",
    "social.youtube",
    "program.checkoutUrl",
    "brand.logoUrl",
  ]);
  r.get("/settings", (_req, res) => {
    const rows = all<{ key: string; value: string }>(db, "SELECT key, value FROM settings ORDER BY key");
    res.json(Object.fromEntries(rows.map((x) => [x.key, x.value])));
  });
  r.put("/settings", (req, res) => {
    const body = parse(z.record(z.string(), z.string().max(20_000)), req.body);
    for (const [key, value] of Object.entries(body)) {
      if (!(key in DEFAULT_SETTINGS)) throw new HttpError(400, `Unknown setting: ${key}`);
      if (URL_KEYS.has(key)) parse(urlField, value);
      if (key === "contact.email" && value) parse(z.email("contact email is invalid"), value.trim());
      if (key === "tracking.metaPixelId" && value && !/^\d{5,20}$/.test(value.trim()))
        throw new HttpError(400, "Meta Pixel ID should contain digits only.");
      if (key === "program.price" && !/^\d+$/.test(value.trim())) throw new HttpError(400, "Program price must be a number.");
      if (key === "program.status") parse(status3, value);
    }
    tx(db, () => {
      for (const [key, value] of Object.entries(body))
        run(db, "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value.trim());
    });
    audit(db, actor(req), "settings.update", Object.keys(body).join(", "));
    res.json({ ok: true });
  });

  // ───────────────────────── Image uploads ─────────────────────────
  mkdirSync(opts.uploadDir, { recursive: true });
  const upload = multer({
    dest: path.join(opts.uploadDir, ".incoming"),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  const SIGNATURES: [string, number[]][] = [
    ["png", [0x89, 0x50, 0x4e, 0x47]],
    ["jpg", [0xff, 0xd8, 0xff]],
    ["webp", [0x52, 0x49, 0x46, 0x46]],
  ];
  r.post("/uploads", upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, "No file received.");
    const head = (await readFile(file.path)).subarray(0, 12);
    const match = SIGNATURES.find(
      ([ext, sig]) => sig.every((b, i) => head[i] === b) && (ext !== "webp" || head.subarray(8, 12).toString() === "WEBP"),
    );
    if (!match) {
      await unlink(file.path).catch(() => {});
      throw new HttpError(400, "Only PNG, JPG or WEBP images are allowed.");
    }
    const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${match[0]}`;
    await rename(file.path, path.join(opts.uploadDir, name));
    audit(db, actor(req), "upload", name);
    res.status(201).json({ url: `/uploads/${name}` });
  });

  r.get("/audit", (_req, res) => {
    res.json(
      all(
        db,
        `SELECT a.id, a.action, a.detail, a.created_at AS createdAt, u.name AS actor
           FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200`,
      ),
    );
  });

  return r;
}
