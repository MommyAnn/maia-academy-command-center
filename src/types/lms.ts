// M.A.I.A. Course Access & LMS domain types — Step 9.
//
// Supersedes the Step 7 course-access stub (see the removal notes in
// src/types/portal.ts / src/utils/portal.ts / src/data/portalConfig.ts).
// Backed by demo/local state — see src/data/lmsStore.tsx. Same caveats as
// every other store in this build: no real video hosting, no real file
// storage, no real backend-enforced access control.

import type { Batch, PackageType } from "@/types/student";

// ---------------------------------------------------------------------------
// Categories — configurable, not hard-coded into the UI (spec section 3).
// ---------------------------------------------------------------------------
export const COURSE_CATEGORIES = [
  "Importation",
  "Direct Manufacturer Sourcing",
  "Business Strategy",
  "Strategic Marketing",
  "Facebook Ads",
  "AI Creatives",
  "AI & Prompt Mastery",
  "Automation",
  "Chatbot",
  "Live Selling",
  "Business Systems",
  "Ecommerce",
  "Bonus Training",
  "Other",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export type CourseStatus = "Draft" | "Published" | "Archived";
export const COURSE_STATUSES: CourseStatus[] = ["Draft", "Published", "Archived"];

export type CourseDifficulty = "Beginner" | "Intermediate" | "Advanced" | "";

/**
 * How a course's access is primarily controlled. "Package" means the
 * Package → Courses matrix applies; "Manual" means only explicit grants
 * (CourseAccessGrant) apply, no package inherits it automatically; "Open"
 * means every enrolled/confirmed student can see it. All three still allow
 * individual grants/overrides on top — see resolveCourseAccess in
 * src/utils/lms.ts.
 */
export type CourseAccessType = "Package" | "Manual" | "Open";
export const COURSE_ACCESS_TYPES: CourseAccessType[] = ["Package", "Manual", "Open"];

export interface Course {
  id: string;
  courseId: string; // e.g. CRS-0001
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: CourseCategory;
  instructor: string;
  thumbnailLabel: string; // no real image upload pipeline yet — a short label/emoji stand-in
  status: CourseStatus;
  estimatedDuration: string;
  difficulty: CourseDifficulty;
  introduction: string;
  learningOutcomes: string;
  whoThisIsFor: string;
  requirements: string;
  accessType: CourseAccessType;
  certificateEligible: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  order: number;
  status: "Active" | "Archived";
  createdAt: string;
}

export type LessonType =
  | "Video Lesson"
  | "Text Lesson"
  | "Downloadable Resource"
  | "External Resource"
  | "Assignment"
  | "Quiz Placeholder"
  | "Live Session / Replay";

export const LESSON_TYPES: LessonType[] = [
  "Video Lesson",
  "Text Lesson",
  "Downloadable Resource",
  "External Resource",
  "Assignment",
  "Quiz Placeholder",
  "Live Session / Replay",
];

export type VideoProvider = "Vimeo" | "Secure Hosting Provider" | "Other" | "";
export const VIDEO_PROVIDERS: VideoProvider[] = ["Vimeo", "Secure Hosting Provider", "Other"];

export type LessonStatus = "Draft" | "Published";

export type ResourceType = "PDF" | "Worksheet" | "Template" | "Checklist" | "Prompt" | "Guide" | "External Link" | "Other";
export const RESOURCE_TYPES: ResourceType[] = ["PDF", "Worksheet", "Template", "Checklist", "Prompt", "Guide", "External Link", "Other"];

/**
 * Metadata-only, same rule as every uploaded-file field in this app: no
 * real file bytes are stored, and an "External Link" resource's url is the
 * only case where a real destination exists.
 */
export interface LessonResource {
  id: string;
  type: ResourceType;
  label: string;
  url: string; // only meaningful for "External Link" — otherwise a placeholder filename
  fileSizeLabel: string;
}

export interface Lesson {
  id: string;
  lessonId: string; // e.g. LSN-000001
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  type: LessonType;
  videoProvider: VideoProvider;
  /**
   * A provider-specific video reference (embed id, not a raw playback URL).
   * IMPORTANT: hiding a download button does not make a video "protected" —
   * see the note in LessonPlayer.tsx. This field is prepared so a real
   * video provider integration can be swapped in later without changing
   * any other part of the LMS.
   */
  videoRef: string;
  textContent: string;
  resources: LessonResource[];
  duration: string;
  order: number;
  status: LessonStatus;
}

/** Package → included course ids. Sample mapping only — fully admin-configurable, never hard-coded into logic (spec section 17). */
export type PackageAccessMatrix = Record<PackageType, string[]>;

export type CourseAccessSource = "Package" | "Manual" | "Bonus" | "Promotion" | "Admin Override" | "Future Purchase";
export const COURSE_ACCESS_SOURCES: CourseAccessSource[] = [
  "Package",
  "Manual",
  "Bonus",
  "Promotion",
  "Admin Override",
  "Future Purchase",
];

export type CourseAccessGrantStatus = "Active" | "Expired" | "Revoked";

/**
 * An individual access grant — layered ON TOP OF the package matrix, never
 * replacing it. A student's real access is the union of matching package
 * matrix entries + their own active grants — see resolveCourseAccess().
 */
export interface CourseAccessGrant {
  id: string;
  studentId: string;
  courseId: string;
  source: CourseAccessSource;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  status: CourseAccessGrantStatus;
  revokedAt: string | null;
  revokedBy: string | null;
  notes: string;
}

export type LessonProgressStatus = "Not Started" | "In Progress" | "Completed";

export interface LessonProgress {
  id: string;
  studentId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  status: LessonProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string;
}

/** Student-facing, computed-only status — never stored directly (spec section 20). See resolveCourseAccess() for how it's derived. */
export type CourseAccessStatus = "Locked" | "Available" | "In Progress" | "Completed" | "Expired" | "Revoked";

export interface CourseAccessResolution {
  status: CourseAccessStatus;
  reason: string; // student-friendly explanation when Locked/Expired/Revoked
  grant: CourseAccessGrant | null; // the grant this access came from, if any (null for package/open access)
}

/**
 * Global, admin-configurable toggle for spec section 19: "grant package
 * courses automatically once Fully Paid + Confirmed" — off by default since
 * some Academy programs allow access before full payment.
 */
export interface CourseAccessAutomationSettings {
  grantOnFullyPaidAndConfirmed: boolean;
}

export const DEFAULT_ACCESS_AUTOMATION_SETTINGS: CourseAccessAutomationSettings = {
  grantOnFullyPaidAndConfirmed: false,
};

/** Lightweight row shape the admin Progress table renders. */
export interface CourseProgressRow {
  studentId: string;
  studentDisplayId: string;
  studentName: string;
  batch: Batch;
  package: PackageType;
  course: Course;
  lessonsCompleted: number;
  totalLessons: number;
  percent: number;
  status: "Not Started" | "In Progress" | "Completed";
  lastAccessedAt: string | null;
  completedAt: string | null;
}
