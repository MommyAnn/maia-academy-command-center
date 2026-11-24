import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../auth.ts";
import { type DB, all, get, run } from "../db.ts";
import {
  type CourseRow,
  HttpError,
  activeEnrollments,
  canWatchRecordings,
  getCourseBySlug,
  idParam,
  parse,
  safeJson,
  serializeCourse,
} from "../util.ts";

type BatchRow = {
  id: number;
  course_id: number | null;
  title: string;
  mode: string;
  starts_at: string;
  ends_at: string;
  schedule_text: string;
  status: string;
  join_url: string;
  location: string;
  notes: string;
};

export function portalRoutes(db: DB) {
  const r = Router();
  r.use(requireUser);

  /** My courses, progress and workshop schedule. */
  r.get("/dashboard", (req, res) => {
    const userId = req.user!.id;
    const now = new Date().toISOString();
    const enrollments = all<{
      id: number;
      course_id: number;
      format: "self_paced" | "guided";
      batch_id: number | null;
      expires_at: string | null;
      created_at: string;
    }>(
      db,
      `SELECT id, course_id, format, batch_id, expires_at, created_at FROM enrollments
        WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`,
      userId,
      now,
    );
    const courseIds = [...new Set(enrollments.map((e) => e.course_id))];
    const courses = courseIds
      .map((id) => get<CourseRow>(db, "SELECT * FROM courses WHERE id = ?", id))
      .filter((c): c is CourseRow => !!c)
      .sort((a, b) => a.sort - b.sort);

    const result = courses.map((c) => {
      const total = get<{ n: number }>(
        db,
        `SELECT COUNT(*) AS n FROM lessons l JOIN modules m ON m.id = l.module_id
          WHERE m.course_id = ? AND l.published = 1`,
        c.id,
      )!.n;
      const done = get<{ n: number }>(
        db,
        `SELECT COUNT(*) AS n FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
           JOIN modules m ON m.id = l.module_id
          WHERE p.user_id = ? AND m.course_id = ? AND l.published = 1 AND p.completed_at IS NOT NULL`,
        userId,
        c.id,
      )!.n;
      const mine = enrollments.filter((e) => e.course_id === c.id);
      return {
        ...pickCourse(c),
        formats: mine.map((e) => ({ format: e.format, expiresAt: e.expires_at, batchId: e.batch_id })),
        canWatch: canWatchRecordings(db, userId, c),
        lessonsTotal: total,
        lessonsDone: done,
      };
    });

    res.json({ courses: result, schedule: scheduleFor(userId) });
  });

  r.get("/schedule", (req, res) => {
    res.json(scheduleFor(req.user!.id));
  });

  /** Full course with lesson videos — only for students entitled to the recordings. */
  r.get("/courses/:slug", (req, res) => {
    const userId = req.user!.id;
    const course = getCourseBySlug(db, req.params.slug);
    if (!course) throw new HttpError(404, "Course not found.");
    const enrollments = activeEnrollments(db, userId, course.id);
    if (enrollments.length === 0) throw new HttpError(403, "You are not enrolled in this course yet.");
    const canWatch = canWatchRecordings(db, userId, course);

    const modules = all<{ id: number; title: string; description: string }>(
      db,
      "SELECT id, title, description FROM modules WHERE course_id = ? ORDER BY sort, id",
      course.id,
    );
    const lessons = all<{
      id: number;
      module_id: number;
      title: string;
      summary: string;
      video_url: string;
      duration_label: string;
      resources: string;
      is_preview: number;
    }>(
      db,
      `SELECT l.* FROM lessons l JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ? AND l.published = 1 ORDER BY l.sort, l.id`,
      course.id,
    );
    const progress = all<{ lesson_id: number; completed_at: string | null }>(
      db,
      "SELECT lesson_id, completed_at FROM lesson_progress WHERE user_id = ?",
      userId,
    );
    const done = new Set(progress.filter((p) => p.completed_at).map((p) => p.lesson_id));

    res.json({
      ...pickCourse(course),
      canWatch,
      formats: enrollments.map((e) => ({ format: e.format, expiresAt: e.expires_at, batchId: e.batch_id })),
      modules: modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        lessons: lessons
          .filter((l) => l.module_id === m.id)
          .map((l) => ({
            id: l.id,
            title: l.title,
            summary: l.summary,
            durationLabel: l.duration_label,
            completed: done.has(l.id),
            // Video links and resources are only sent to students allowed to watch.
            videoUrl: canWatch || l.is_preview ? l.video_url : "",
            resources: canWatch ? safeJson<{ label: string; url: string }[]>(l.resources, []) : [],
          })),
      })),
      schedule: scheduleFor(userId).filter((b) => b.courseId === course.id),
    });
  });

  const progressSchema = z.object({ completed: z.boolean() });
  r.post("/lessons/:id/progress", (req, res) => {
    const lessonId = idParam(req);
    const body = parse(progressSchema, req.body);
    const lesson = get<{ course_id: number }>(
      db,
      `SELECT m.course_id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ? AND l.published = 1`,
      lessonId,
    );
    if (!lesson) throw new HttpError(404, "Lesson not found.");
    const course = get<CourseRow>(db, "SELECT * FROM courses WHERE id = ?", lesson.course_id)!;
    if (!canWatchRecordings(db, req.user!.id, course)) throw new HttpError(403, "You do not have access to this lesson.");
    run(
      db,
      `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, last_viewed_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed_at = excluded.completed_at, last_viewed_at = datetime('now')`,
      req.user!.id,
      lessonId,
      body.completed ? new Date().toISOString() : null,
    );
    res.json({ ok: true });
  });

  function pickCourse(c: CourseRow) {
    const s = serializeCourse(c);
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      tagline: s.tagline,
      icon: s.icon,
      coverImage: s.coverImage,
      accessNote: s.accessNote,
      outcome: s.outcome,
    };
  }

  /**
   * Workshop schedule for a student: open batches for every course they hold a
   * guided enrollment in. The Zoom/join link is only revealed for the batch the
   * admin assigned them to.
   */
  function scheduleFor(userId: number) {
    const guided = all<{ course_id: number; batch_id: number | null; course_title: string }>(
      db,
      `SELECT e.course_id, e.batch_id, c.title AS course_title FROM enrollments e JOIN courses c ON c.id = e.course_id
        WHERE e.user_id = ? AND e.format = 'guided' AND e.status = 'active'
          AND (e.expires_at IS NULL OR e.expires_at > ?)`,
      userId,
      new Date().toISOString(),
    );
    const out: {
      id: number;
      courseId: number;
      courseTitle: string;
      title: string;
      mode: string;
      startsAt: string;
      endsAt: string;
      scheduleText: string;
      status: string;
      location: string;
      notes: string;
      assigned: boolean;
      joinUrl: string;
    }[] = [];
    for (const g of guided) {
      const batches = all<BatchRow>(
        db,
        `SELECT * FROM batches WHERE course_id = ? AND (id = ? OR status IN ('open','full')) ORDER BY starts_at, id`,
        g.course_id,
        g.batch_id ?? -1,
      );
      for (const b of batches) {
        const assigned = b.id === g.batch_id;
        out.push({
          id: b.id,
          courseId: g.course_id,
          courseTitle: g.course_title,
          title: b.title,
          mode: b.mode,
          startsAt: b.starts_at,
          endsAt: b.ends_at,
          scheduleText: b.schedule_text,
          status: b.status,
          location: b.location,
          notes: assigned ? b.notes : "",
          assigned,
          joinUrl: assigned ? b.join_url : "",
        });
      }
    }
    return out;
  }

  return r;
}
