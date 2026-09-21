// Configuration + demo seed data for Course Access & the LMS (Step 9).
// Seed access/progress records are looked up by a student's stable display
// ID (StudentRecord.studentId) rather than their internal id — see the
// matching note in src/data/masterBrainConfig.ts for why.

import type { Course, CourseAccessGrant, Lesson, LessonProgress, Module, PackageAccessMatrix } from "@/types/lms";
import { DEMO_STUDENTS } from "@/data/demoStudents";

export const CURRENT_DEMO_USER = "Mommy Ann";

function findStudentId(studentDisplayId: string): string {
  const student = DEMO_STUDENTS.find((s) => s.studentId === studentDisplayId);
  if (!student) throw new Error(`Demo student not found: ${studentDisplayId}`);
  return student.id;
}

// ---------------------------------------------------------------------------
// DEMO COURSES — sample structure only, not the Academy's final catalog.
// ---------------------------------------------------------------------------

function course(input: Omit<Course, "id" | "createdAt" | "updatedAt" | "createdBy">): Course {
  return { ...input, id: crypto.randomUUID(), createdBy: CURRENT_DEMO_USER, createdAt: "2026-08-01T09:00:00+08:00", updatedAt: "2026-08-01T09:00:00+08:00" };
}

export const COURSE_IMPORTATION = course({
  courseId: "CRS-0001",
  title: "Importation Foundation",
  shortDescription: "The core course every M.A.I.A. student takes — sourcing basics, logistics, and landed cost.",
  fullDescription:
    "Learn the complete foundation of running a direct-import business: how to find suppliers, calculate real landed cost, and avoid the most common beginner mistakes.",
  category: "Importation",
  instructor: "Mommy Ann",
  thumbnailLabel: "📦",
  status: "Published",
  estimatedDuration: "3 hours",
  difficulty: "Beginner",
  introduction: "Welcome to Importation Foundation — your first step into direct-import business ownership.",
  learningOutcomes: "Source products directly, calculate landed cost accurately, and avoid common importer mistakes.",
  whoThisIsFor: "New and aspiring importers with little to no sourcing experience.",
  requirements: "None — this is the starting course for every student.",
  accessType: "Package",
  certificateEligible: true,
});

export const COURSE_FB_ADS = course({
  courseId: "CRS-0002",
  title: "Facebook Ads Mastery",
  shortDescription: "Run profitable Facebook ad campaigns for your import business.",
  fullDescription:
    "A complete, practical walkthrough of setting up a Business Portfolio, structuring campaigns, writing creative that converts, and optimizing spend.",
  category: "Facebook Ads",
  instructor: "Jane Villareal",
  thumbnailLabel: "📣",
  status: "Published",
  estimatedDuration: "4.5 hours",
  difficulty: "Intermediate",
  introduction: "This course walks you through building your first profitable ad campaign from scratch.",
  learningOutcomes: "Set up a Business Portfolio, launch a campaign, write converting creative, and optimize spend.",
  whoThisIsFor: "Students who already have a product and want to start running paid traffic.",
  requirements: "A Facebook Business account and a product ready to sell.",
  accessType: "Package",
  certificateEligible: true,
});

export const COURSE_AI_CREATIVE = course({
  courseId: "CRS-0003",
  title: "AI Creative Mastery",
  shortDescription: "Use AI tools to produce ad creatives and product photography at scale.",
  fullDescription: "Learn to use AI image and video tools to produce professional ad creatives without a studio.",
  category: "AI Creatives",
  instructor: "Rica Manalo",
  thumbnailLabel: "🎨",
  status: "Published",
  estimatedDuration: "2 hours",
  difficulty: "Intermediate",
  introduction: "Turn product photos into scroll-stopping ad creatives using AI tools.",
  learningOutcomes: "Generate AI product photography and short-form video creatives for ads.",
  whoThisIsFor: "Students already running or about to run Facebook/TikTok ads.",
  requirements: "Facebook Ads Mastery is recommended but not required.",
  accessType: "Package",
  certificateEligible: false,
});

export const DEMO_COURSES: Course[] = [COURSE_IMPORTATION, COURSE_FB_ADS, COURSE_AI_CREATIVE];

// ---------------------------------------------------------------------------
// Modules + Lessons
// ---------------------------------------------------------------------------

function makeModule(courseId: string, title: string, order: number): Module {
  return { id: crypto.randomUUID(), courseId, title, order, status: "Active", createdAt: "2026-08-01T09:00:00+08:00" };
}

function makeLesson(input: {
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  duration: string;
  type?: Lesson["type"];
}): Lesson {
  return {
    id: crypto.randomUUID(),
    lessonId: `LSN-${String(Math.floor(Math.random() * 900000) + 100000)}`,
    moduleId: input.moduleId,
    courseId: input.courseId,
    title: input.title,
    description: input.description,
    type: input.type ?? "Video Lesson",
    videoProvider: input.type === "Text Lesson" ? "" : "Vimeo",
    videoRef: input.type === "Text Lesson" ? "" : "demo-vimeo-id-" + Math.floor(Math.random() * 100000),
    textContent: input.type === "Text Lesson" ? "Full lesson notes would appear here." : "",
    resources: [],
    duration: input.duration,
    order: input.order,
    status: "Published",
  };
}

// -- Importation Foundation --
const impMod1 = makeModule(COURSE_IMPORTATION.id, "Module 1: Sourcing Basics", 1);
const impMod2 = makeModule(COURSE_IMPORTATION.id, "Module 2: Landed Cost & Pricing", 2);
const impMod3 = makeModule(COURSE_IMPORTATION.id, "Module 3: Shipping & Customs", 3);

export const DEMO_MODULES: Module[] = [
  impMod1,
  impMod2,
  impMod3,
  // filled below after FB Ads / AI Creative modules are declared
];

const impLessons: Lesson[] = [
  makeLesson({ moduleId: impMod1.id, courseId: COURSE_IMPORTATION.id, title: "Welcome & How This Course Works", description: "Course overview and how to use the lesson player.", order: 1, duration: "5 min" }),
  makeLesson({ moduleId: impMod1.id, courseId: COURSE_IMPORTATION.id, title: "Finding Reliable Suppliers", description: "Where to look and how to vet a supplier.", order: 2, duration: "18 min" }),
  makeLesson({ moduleId: impMod2.id, courseId: COURSE_IMPORTATION.id, title: "Calculating True Landed Cost", description: "Every cost that belongs in your pricing.", order: 1, duration: "22 min" }),
  makeLesson({ moduleId: impMod2.id, courseId: COURSE_IMPORTATION.id, title: "Pricing Worksheet Walkthrough", description: "Fill out the pricing worksheet with a real example.", order: 2, duration: "15 min", type: "Text Lesson" }),
  makeLesson({ moduleId: impMod3.id, courseId: COURSE_IMPORTATION.id, title: "Shipping Methods Compared", description: "Air vs sea, consolidator vs direct.", order: 1, duration: "20 min" }),
  makeLesson({ moduleId: impMod3.id, courseId: COURSE_IMPORTATION.id, title: "Customs Documents Checklist", description: "The documents you'll need every shipment.", order: 2, duration: "12 min", type: "Downloadable Resource" }),
];

// -- Facebook Ads Mastery --
const fbMod1 = makeModule(COURSE_FB_ADS.id, "Module 1: Facebook Ads Foundation", 1);
const fbMod2 = makeModule(COURSE_FB_ADS.id, "Module 2: Business Portfolio Setup", 2);
const fbMod3 = makeModule(COURSE_FB_ADS.id, "Module 3: Campaign Setup", 3);
const fbMod4 = makeModule(COURSE_FB_ADS.id, "Module 4: Creative Strategy", 4);
const fbMod5 = makeModule(COURSE_FB_ADS.id, "Module 5: Optimization", 5);

const fbLessons: Lesson[] = [
  makeLesson({ moduleId: fbMod1.id, courseId: COURSE_FB_ADS.id, title: "How Facebook Ads Actually Work", description: "The auction, the algorithm, and what actually matters.", order: 1, duration: "16 min" }),
  makeLesson({ moduleId: fbMod1.id, courseId: COURSE_FB_ADS.id, title: "Setting Realistic Expectations", description: "Budget, timelines, and common beginner mistakes.", order: 2, duration: "10 min" }),
  makeLesson({ moduleId: fbMod2.id, courseId: COURSE_FB_ADS.id, title: "Creating Your Business Portfolio", description: "Step-by-step Meta Business Suite setup.", order: 1, duration: "14 min" }),
  makeLesson({ moduleId: fbMod2.id, courseId: COURSE_FB_ADS.id, title: "Pixel & Conversions API Setup", description: "Tracking setup for accurate ad data.", order: 2, duration: "19 min" }),
  makeLesson({ moduleId: fbMod3.id, courseId: COURSE_FB_ADS.id, title: "Campaign Structure That Works", description: "Campaign, ad set, and ad level strategy.", order: 1, duration: "21 min" }),
  makeLesson({ moduleId: fbMod3.id, courseId: COURSE_FB_ADS.id, title: "Audience Targeting Fundamentals", description: "Broad vs. narrow targeting for 2026.", order: 2, duration: "17 min" }),
  makeLesson({ moduleId: fbMod4.id, courseId: COURSE_FB_ADS.id, title: "Hooks That Stop the Scroll", description: "Writing the first 3 seconds of your ad.", order: 1, duration: "15 min" }),
  makeLesson({ moduleId: fbMod4.id, courseId: COURSE_FB_ADS.id, title: "Creative Templates Pack", description: "Download the creative brief template.", order: 2, duration: "5 min", type: "Downloadable Resource" }),
  makeLesson({ moduleId: fbMod5.id, courseId: COURSE_FB_ADS.id, title: "Reading Your Ads Manager Data", description: "The metrics that actually matter.", order: 1, duration: "18 min" }),
  makeLesson({ moduleId: fbMod5.id, courseId: COURSE_FB_ADS.id, title: "When to Scale, Kill, or Adjust", description: "Decision framework for optimizing spend.", order: 2, duration: "16 min" }),
];

// -- AI Creative Mastery --
const aiMod1 = makeModule(COURSE_AI_CREATIVE.id, "Module 1: AI Product Photography", 1);
const aiMod2 = makeModule(COURSE_AI_CREATIVE.id, "Module 2: AI Video Creatives", 2);

const aiLessons: Lesson[] = [
  makeLesson({ moduleId: aiMod1.id, courseId: COURSE_AI_CREATIVE.id, title: "AI Photography Tools Overview", description: "The tools we'll use in this course.", order: 1, duration: "9 min" }),
  makeLesson({ moduleId: aiMod1.id, courseId: COURSE_AI_CREATIVE.id, title: "Generating Your First Product Shot", description: "Live walkthrough, start to finish.", order: 2, duration: "20 min" }),
  makeLesson({ moduleId: aiMod2.id, courseId: COURSE_AI_CREATIVE.id, title: "AI Video Creative Basics", description: "Turning a still image into a short ad video.", order: 1, duration: "17 min" }),
  makeLesson({ moduleId: aiMod2.id, courseId: COURSE_AI_CREATIVE.id, title: "Prompt Pack for Product Ads", description: "Ready-to-use prompt templates.", order: 2, duration: "6 min", type: "Downloadable Resource" }),
];

DEMO_MODULES.push(fbMod1, fbMod2, fbMod3, fbMod4, fbMod5, aiMod1, aiMod2);

export const DEMO_LESSONS: Lesson[] = [...impLessons, ...fbLessons, ...aiLessons];

// ---------------------------------------------------------------------------
// Package access matrix — SAMPLE mapping only, fully admin-editable.
// ---------------------------------------------------------------------------
export const DEFAULT_PACKAGE_ACCESS_MATRIX: PackageAccessMatrix = {
  Premium: [COURSE_IMPORTATION.id],
  VIP: [COURSE_IMPORTATION.id, COURSE_FB_ADS.id],
  "Dual VIP": [COURSE_IMPORTATION.id, COURSE_FB_ADS.id, COURSE_AI_CREATIVE.id],
};

// ---------------------------------------------------------------------------
// Demo access grants + lesson progress
// ---------------------------------------------------------------------------
function grant(input: Omit<CourseAccessGrant, "id" | "status" | "revokedAt" | "revokedBy">): CourseAccessGrant {
  return { ...input, id: crypto.randomUUID(), status: "Active", revokedAt: null, revokedBy: null };
}

export const DEMO_COURSE_ACCESS_GRANTS: CourseAccessGrant[] = [
  // Carlos Dizon (Dual VIP) — bonus access to a course outside his usual package mix, to demo "Manual"/"Bonus" sourcing.
  grant({
    studentId: findStudentId("MAIA-B14-0002"),
    courseId: COURSE_FB_ADS.id,
    source: "Bonus",
    grantedBy: CURRENT_DEMO_USER,
    grantedAt: "2026-09-05T10:00:00+08:00",
    expiresAt: null,
    notes: "Given as a launch bonus for early Batch 14 enrollees.",
  }),
  // Maria Santos (VIP — package normally covers Importation + FB Ads only)
  // — extra demo link showing a Feedback Incentive redemption granting real
  // access to a course outside her package via this same system (see
  // src/data/feedbackConfig.ts).
  grant({
    studentId: findStudentId("MAIA-B14-0001"),
    courseId: COURSE_AI_CREATIVE.id,
    source: "Bonus",
    grantedBy: CURRENT_DEMO_USER,
    grantedAt: "2026-09-06T09:00:00+08:00",
    expiresAt: null,
    notes: "Unlocked from submitting feedback on the Facebook Ads Masterclass.",
  }),
];

function progress(input: {
  studentDisplayId: string;
  lesson: Lesson;
  status: LessonProgress["status"];
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string;
}): LessonProgress {
  return {
    id: crypto.randomUUID(),
    studentId: findStudentId(input.studentDisplayId),
    courseId: input.lesson.courseId,
    moduleId: input.lesson.moduleId,
    lessonId: input.lesson.id,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    lastAccessedAt: input.lastAccessedAt,
  };
}

export const DEMO_LESSON_PROGRESS: LessonProgress[] = [
  // Maria Santos (VIP) — partway through Importation Foundation.
  progress({ studentDisplayId: "MAIA-B14-0001", lesson: impLessons[0], status: "Completed", startedAt: "2026-09-10T09:00:00+08:00", completedAt: "2026-09-10T09:10:00+08:00", lastAccessedAt: "2026-09-10T09:10:00+08:00" }),
  progress({ studentDisplayId: "MAIA-B14-0001", lesson: impLessons[1], status: "In Progress", startedAt: "2026-09-11T14:00:00+08:00", completedAt: null, lastAccessedAt: "2026-09-11T14:12:00+08:00" }),
  // Carlos Dizon (Dual VIP) — completed Importation Foundation fully.
  ...impLessons.map((l, i) =>
    progress({
      studentDisplayId: "MAIA-B14-0002",
      lesson: l,
      status: "Completed",
      startedAt: `2026-08-2${i}T09:00:00+08:00`,
      completedAt: `2026-08-2${i}T09:20:00+08:00`,
      lastAccessedAt: `2026-08-2${i}T09:20:00+08:00`,
    }),
  ),
];
