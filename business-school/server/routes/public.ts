import { Router } from "express";
import { z } from "zod";
import { type DB, all, get, run } from "../db.ts";
import { type CourseRow, HttpError, getCourseBySlug, getSettings, parse, rateLimit, serializeCourse, text } from "../util.ts";

const PUBLIC_SETTING_PREFIXES = ["contact.", "social.", "tracking.", "program.", "brand.", "home."];

export function publicRoutes(db: DB) {
  const r = Router();

  r.get("/site", (_req, res) => {
    const s = getSettings(db);
    const settings = Object.fromEntries(
      Object.entries(s).filter(([k]) => PUBLIC_SETTING_PREFIXES.some((p) => k.startsWith(p))),
    );
    const courses = all<CourseRow>(db, "SELECT * FROM courses WHERE published = 1 ORDER BY sort, id");
    const guidedTotal = courses.reduce((sum, c) => sum + c.price_guided, 0);
    const programPrice = Number(s["program.price"] || 0);
    res.json({
      settings,
      program: {
        title: s["program.title"],
        price: programPrice,
        checkoutUrl: s["program.checkoutUrl"],
        status: s["program.status"],
        journey: s["program.journey"],
        courseCount: courses.length,
        guidedTotal,
        savings: Math.max(0, guidedTotal - programPrice),
        courses: courses.map((c) => ({ slug: c.slug, title: c.title })),
      },
    });
  });

  r.get("/courses", (_req, res) => {
    const courses = all<CourseRow>(db, "SELECT * FROM courses WHERE published = 1 ORDER BY sort, id");
    const counts = all<{ course_id: number; lessons: number; modules: number }>(
      db,
      `SELECT m.course_id, COUNT(DISTINCT m.id) AS modules, COUNT(l.id) AS lessons
         FROM modules m LEFT JOIN lessons l ON l.module_id = m.id AND l.published = 1
        GROUP BY m.course_id`,
    );
    const openBatches = all<{ course_id: number; n: number }>(
      db,
      "SELECT course_id, COUNT(*) AS n FROM batches WHERE status IN ('open','full') GROUP BY course_id",
    );
    res.json(
      courses.map((c) => ({
        ...serializeCourse(c),
        lessonCount: counts.find((x) => x.course_id === c.id)?.lessons ?? 0,
        upcomingBatches: openBatches.find((x) => x.course_id === c.id)?.n ?? 0,
      })),
    );
  });

  r.get("/courses/:slug", (req, res) => {
    const course = getCourseBySlug(db, req.params.slug);
    if (!course || !course.published) throw new HttpError(404, "Course not found.");
    const modules = all<{ id: number; title: string; description: string }>(
      db,
      "SELECT id, title, description FROM modules WHERE course_id = ? ORDER BY sort, id",
      course.id,
    );
    const lessons = all<{
      id: number;
      module_id: number;
      title: string;
      duration_label: string;
      is_preview: number;
      video_url: string;
    }>(
      db,
      `SELECT l.id, l.module_id, l.title, l.duration_label, l.is_preview, l.video_url
         FROM lessons l JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ? AND l.published = 1 ORDER BY l.sort, l.id`,
      course.id,
    );
    // Public schedule: never exposes join links.
    const batches = all(
      db,
      `SELECT id, title, mode, starts_at AS startsAt, ends_at AS endsAt, schedule_text AS scheduleText,
              capacity, status, location
         FROM batches WHERE course_id = ? AND status IN ('open','full') ORDER BY starts_at, id`,
      course.id,
    );
    res.json({
      ...serializeCourse(course),
      outline: modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        lessons: lessons
          .filter((l) => l.module_id === m.id)
          .map((l) => ({
            id: l.id,
            title: l.title,
            durationLabel: l.duration_label,
            isPreview: !!l.is_preview,
            // Only free-preview lessons reveal their video publicly.
            previewVideoUrl: l.is_preview ? l.video_url : "",
          })),
      })),
      batches,
    });
  });

  r.get("/products", (_req, res) => {
    res.json(
      all(
        db,
        `SELECT id, title, category, description, price, checkout_url AS checkoutUrl, image_url AS imageUrl
           FROM products WHERE status = 'published' ORDER BY sort, id DESC`,
      ),
    );
  });

  r.get("/testimonials", (_req, res) => {
    res.json(
      all(
        db,
        `SELECT t.id, t.name, t.role, t.quote, t.video_url AS videoUrl, t.photo_url AS photoUrl,
                c.title AS courseTitle
           FROM testimonials t LEFT JOIN courses c ON c.id = t.course_id
          WHERE t.status = 'published' AND t.consent = 1 ORDER BY t.sort, t.id DESC`,
      ),
    );
  });

  r.get("/policies/:key", (req, res) => {
    const key = req.params.key;
    if (!["terms", "refund", "privacy"].includes(key)) throw new HttpError(404, "Not found.");
    const row = get<{ value: string }>(db, "SELECT value FROM settings WHERE key = ?", `policy.${key}`);
    res.json({ key, body: row?.value ?? "" });
  });

  const inquirySchema = z.object({
    name: text(120).min(2, "Please enter your name"),
    email: z.email("Please enter a valid email").max(200),
    mobile: text(40).optional().default(""),
    topic: text(120).optional().default(""),
    message: text(4000).min(5, "Please write a short message"),
    consent: z.literal(true, { error: "Please agree to be contacted" }),
  });

  r.post("/inquiries", rateLimit("inquiry", 5, 60 * 60_000), (req, res) => {
    // Honeypot field: real visitors never see it, so a filled value is a bot. Pretend success.
    if (typeof req.body?.website === "string" && req.body.website !== "") return void res.status(201).json({ ok: true });
    const body = parse(inquirySchema, req.body);
    run(
      db,
      "INSERT INTO inquiries (name, email, mobile, topic, message) VALUES (?, ?, ?, ?, ?)",
      body.name,
      body.email,
      body.mobile,
      body.topic,
      body.message,
    );
    res.status(201).json({ ok: true });
  });

  return r;
}
