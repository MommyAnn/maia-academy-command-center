import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { type DB, all, get } from "./db.ts";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    throw new HttpError(400, field ? `${field}: ${issue.message}` : (issue?.message ?? "Invalid input."));
  }
  return result.data;
}

export const idParam = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id.");
  return id;
};

/** Accepts "" or an http(s) URL / site-relative path. Blocks javascript: and data: links. */
export const urlField = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || /^\/(?!\/)/.test(v), "must be a full https:// link or empty");

export const text = (max = 500) => z.string().trim().max(max);

/** Simple fixed-window, in-memory rate limiter (single server). */
export function rateLimit(name: string, limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${name}:${req.ip}`;
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return next();
    }
    if (entry.count >= limit) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
      return void res.status(429).json({ error: "Too many attempts. Please try again later." });
    }
    entry.count++;
    next();
  };
}

export function getSettings(db: DB): Record<string, string> {
  const rows = all<{ key: string; value: string }>(db, "SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export type CourseRow = {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  topics: string;
  outcome: string;
  tools: string;
  cover_image: string;
  icon: string;
  price_self_paced: number;
  price_guided: number;
  checkout_self_paced: string;
  checkout_guided: string;
  self_paced_status: string;
  guided_status: string;
  guided_includes_recordings: number;
  access_note: string;
  schedule_note: string;
  published: number;
  sort: number;
};

export function serializeCourse(c: CourseRow) {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    tagline: c.tagline,
    description: c.description,
    topics: safeJson<string[]>(c.topics, []),
    outcome: c.outcome,
    tools: safeJson<string[]>(c.tools, []),
    coverImage: c.cover_image,
    icon: c.icon,
    priceSelfPaced: c.price_self_paced,
    priceGuided: c.price_guided,
    checkoutSelfPaced: c.checkout_self_paced,
    checkoutGuided: c.checkout_guided,
    selfPacedStatus: c.self_paced_status,
    guidedStatus: c.guided_status,
    guidedIncludesRecordings: !!c.guided_includes_recordings,
    accessNote: c.access_note,
    scheduleNote: c.schedule_note,
    published: !!c.published,
    sort: c.sort,
  };
}

export function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Server-side entitlement check: the single source of truth for paid lesson
 * access. Returns the active enrollments a user holds for a course.
 */
export function activeEnrollments(db: DB, userId: number, courseId: number) {
  return all<{ id: number; format: "self_paced" | "guided"; batch_id: number | null; expires_at: string | null }>(
    db,
    `SELECT id, format, batch_id, expires_at FROM enrollments
      WHERE user_id = ? AND course_id = ? AND status = 'active'
        AND (expires_at IS NULL OR expires_at > ?)`,
    userId,
    courseId,
    new Date().toISOString(),
  );
}

export function canWatchRecordings(db: DB, userId: number, course: CourseRow): boolean {
  return activeEnrollments(db, userId, course.id).some(
    (e) => e.format === "self_paced" || (e.format === "guided" && !!course.guided_includes_recordings),
  );
}

export function getCourseBySlug(db: DB, slug: string) {
  return get<CourseRow>(db, "SELECT * FROM courses WHERE slug = ?", slug);
}
