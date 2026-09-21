import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  Course,
  CourseAccessAutomationSettings,
  CourseAccessGrant,
  CourseAccessSource,
  CourseStatus,
  Lesson,
  LessonProgress,
  LessonStatus,
  Module,
  PackageAccessMatrix,
} from "@/types/lms";
import { DEFAULT_ACCESS_AUTOMATION_SETTINGS } from "@/types/lms";
import {
  DEFAULT_PACKAGE_ACCESS_MATRIX,
  DEMO_COURSE_ACCESS_GRANTS,
  DEMO_COURSES,
  DEMO_LESSON_PROGRESS,
  DEMO_LESSONS,
  DEMO_MODULES,
  CURRENT_DEMO_USER,
} from "@/data/lmsConfig";
import { computeCourseProgress, generateCourseId, generateLessonId } from "@/utils/lms";
import { useStudentStore } from "@/data/studentStore";
import { dispatchGhlEvent } from "@/integrations/ghlEvents";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: courses, modules,
// lessons, access grants and lesson progress live in React state mirrored
// to this browser's localStorage only. Not a real database, not shared
// across devices/users, no real video hosting or file storage behind any
// of this — see the notes in src/types/lms.ts.
//
// CourseProgress is never stored as its own record — every page computes it
// live from `lessonProgress` via computeCourseProgress()/resolveCourseAccess()
// in src/utils/lms.ts, mirroring how Finance always computes a student's
// balance live from the payment ledger rather than a stored total.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_lms_v1";

interface LmsState {
  courses: Course[];
  modules: Module[];
  lessons: Lesson[];
  packageAccessMatrix: PackageAccessMatrix;
  accessGrants: CourseAccessGrant[];
  lessonProgress: LessonProgress[];
  automationSettings: CourseAccessAutomationSettings;
}

function loadInitialState(): LmsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LmsState;
      if (parsed && Array.isArray(parsed.courses)) {
        return {
          courses: parsed.courses,
          modules: parsed.modules ?? [],
          lessons: parsed.lessons ?? [],
          packageAccessMatrix: parsed.packageAccessMatrix ?? DEFAULT_PACKAGE_ACCESS_MATRIX,
          accessGrants: parsed.accessGrants ?? [],
          lessonProgress: parsed.lessonProgress ?? [],
          automationSettings: parsed.automationSettings ?? DEFAULT_ACCESS_AUTOMATION_SETTINGS,
        };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  // Persist immediately: DEMO_COURSE_ACCESS_GRANTS / DEMO_LESSON_PROGRESS
  // resolve studentId against DEMO_STUDENTS at this exact module load, and
  // studentStore.tsx persists that same student array on its own first
  // read too — both must freeze on load #1, or a reload would regenerate
  // fresh random ids on each side that no longer match each other.
  const seeded: LmsState = {
    courses: DEMO_COURSES,
    modules: DEMO_MODULES,
    lessons: DEMO_LESSONS,
    packageAccessMatrix: DEFAULT_PACKAGE_ACCESS_MATRIX,
    accessGrants: DEMO_COURSE_ACCESS_GRANTS,
    lessonProgress: DEMO_LESSON_PROGRESS,
    automationSettings: DEFAULT_ACCESS_AUTOMATION_SETTINGS,
  };
  persist(seeded);
  return seeded;
}

function persist(state: LmsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowIso() {
  return new Date().toISOString();
}

export interface CreateCourseInput {
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: Course["category"];
  instructor: string;
  thumbnailLabel: string;
  estimatedDuration: string;
  difficulty: Course["difficulty"];
  introduction: string;
  learningOutcomes: string;
  whoThisIsFor: string;
  requirements: string;
  accessType: Course["accessType"];
  certificateEligible: boolean;
}

export interface CreateLessonInput {
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  type: Lesson["type"];
  videoProvider: Lesson["videoProvider"];
  videoRef: string;
  textContent: string;
  duration: string;
}

interface LmsStoreValue {
  courses: Course[];
  modules: Module[];
  lessons: Lesson[];
  packageAccessMatrix: PackageAccessMatrix;
  accessGrants: CourseAccessGrant[];
  lessonProgress: LessonProgress[];
  automationSettings: CourseAccessAutomationSettings;

  createCourse: (input: CreateCourseInput) => Course;
  updateCourse: (courseId: string, patch: Partial<Course>) => void;
  setCourseStatus: (courseId: string, status: CourseStatus) => void;
  duplicateCourse: (courseId: string) => Course;

  createModule: (courseId: string, title: string) => Module;
  updateModule: (moduleId: string, patch: Partial<Module>) => void;
  reorderModules: (courseId: string, orderedModuleIds: string[]) => void;
  archiveModule: (moduleId: string) => void;

  createLesson: (input: CreateLessonInput) => Lesson;
  updateLesson: (lessonId: string, patch: Partial<Lesson>) => void;
  reorderLessons: (moduleId: string, orderedLessonIds: string[]) => void;
  setLessonStatus: (lessonId: string, status: LessonStatus) => void;

  setPackageAccessMatrix: (matrix: PackageAccessMatrix) => void;
  grantCourseAccess: (
    studentId: string,
    courseId: string,
    source: CourseAccessSource,
    options?: { expiresAt?: string | null; notes?: string },
  ) => CourseAccessGrant;
  revokeCourseAccess: (grantId: string) => void;
  extendCourseAccess: (grantId: string, newExpiresAt: string) => void;

  startLesson: (studentId: string, courseId: string, moduleId: string, lessonId: string) => void;
  completeLesson: (studentId: string, courseId: string, moduleId: string, lessonId: string) => void;

  setAccessAutomation: (settings: CourseAccessAutomationSettings) => void;
}

const LmsStoreContext = createContext<LmsStoreValue | undefined>(undefined);

export function LmsStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LmsState>(() => loadInitialState());
  const { students, appendActivity } = useStudentStore();

  const updateState = useCallback((updater: (prev: LmsState) => LmsState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------
  // Courses
  // -------------------------------------------------------------------
  const createCourse = useCallback(
    (input: CreateCourseInput): Course => {
      const iso = nowIso();
      let created!: Course;
      updateState((prev) => {
        created = {
          ...input,
          id: crypto.randomUUID(),
          courseId: generateCourseId(prev.courses),
          status: "Draft",
          createdBy: CURRENT_DEMO_USER,
          createdAt: iso,
          updatedAt: iso,
        };
        return { ...prev, courses: [created, ...prev.courses] };
      });
      return created;
    },
    [updateState],
  );

  const updateCourse = useCallback(
    (courseId: string, patch: Partial<Course>) => {
      updateState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) => (c.id === courseId ? { ...c, ...patch, updatedAt: nowIso() } : c)),
      }));
    },
    [updateState],
  );

  const setCourseStatus = useCallback(
    (courseId: string, status: CourseStatus) => {
      updateState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) => (c.id === courseId ? { ...c, status, updatedAt: nowIso() } : c)),
      }));
    },
    [updateState],
  );

  const duplicateCourse = useCallback(
    (courseId: string): Course => {
      const iso = nowIso();
      let created!: Course;
      updateState((prev) => {
        const source = prev.courses.find((c) => c.id === courseId);
        if (!source) throw new Error("Course not found");
        created = {
          ...source,
          id: crypto.randomUUID(),
          courseId: generateCourseId(prev.courses),
          title: `${source.title} (Copy)`,
          status: "Draft",
          createdAt: iso,
          updatedAt: iso,
        };
        const sourceModules = prev.modules.filter((m) => m.courseId === courseId);
        const moduleIdMap = new Map<string, string>();
        const newModules: Module[] = sourceModules.map((m) => {
          const newId = crypto.randomUUID();
          moduleIdMap.set(m.id, newId);
          return { ...m, id: newId, courseId: created.id };
        });
        const sourceLessons = prev.lessons.filter((l) => l.courseId === courseId);
        const newLessons: Lesson[] = sourceLessons.map((l) => ({
          ...l,
          id: crypto.randomUUID(),
          lessonId: generateLessonId([...prev.lessons]),
          courseId: created.id,
          moduleId: moduleIdMap.get(l.moduleId) ?? l.moduleId,
        }));
        return {
          ...prev,
          courses: [created, ...prev.courses],
          modules: [...prev.modules, ...newModules],
          lessons: [...prev.lessons, ...newLessons],
        };
      });
      return created;
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Modules
  // -------------------------------------------------------------------
  const createModule = useCallback(
    (courseId: string, title: string): Module => {
      let created!: Module;
      updateState((prev) => {
        const existing = prev.modules.filter((m) => m.courseId === courseId);
        created = {
          id: crypto.randomUUID(),
          courseId,
          title,
          order: existing.length + 1,
          status: "Active",
          createdAt: nowIso(),
        };
        return { ...prev, modules: [...prev.modules, created] };
      });
      return created;
    },
    [updateState],
  );

  const updateModule = useCallback(
    (moduleId: string, patch: Partial<Module>) => {
      updateState((prev) => ({ ...prev, modules: prev.modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)) }));
    },
    [updateState],
  );

  const reorderModules = useCallback(
    (courseId: string, orderedModuleIds: string[]) => {
      updateState((prev) => ({
        ...prev,
        modules: prev.modules.map((m) => {
          if (m.courseId !== courseId) return m;
          const idx = orderedModuleIds.indexOf(m.id);
          return idx === -1 ? m : { ...m, order: idx + 1 };
        }),
      }));
    },
    [updateState],
  );

  const archiveModule = useCallback(
    (moduleId: string) => {
      updateState((prev) => ({ ...prev, modules: prev.modules.map((m) => (m.id === moduleId ? { ...m, status: "Archived" } : m)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Lessons
  // -------------------------------------------------------------------
  const createLesson = useCallback(
    (input: CreateLessonInput): Lesson => {
      let created!: Lesson;
      updateState((prev) => {
        const existingInModule = prev.lessons.filter((l) => l.moduleId === input.moduleId);
        created = {
          id: crypto.randomUUID(),
          lessonId: generateLessonId(prev.lessons),
          moduleId: input.moduleId,
          courseId: input.courseId,
          title: input.title,
          description: input.description,
          type: input.type,
          videoProvider: input.videoProvider,
          videoRef: input.videoRef,
          textContent: input.textContent,
          resources: [],
          duration: input.duration,
          order: existingInModule.length + 1,
          status: "Draft",
        };
        return { ...prev, lessons: [...prev.lessons, created] };
      });
      return created;
    },
    [updateState],
  );

  const updateLesson = useCallback(
    (lessonId: string, patch: Partial<Lesson>) => {
      updateState((prev) => ({ ...prev, lessons: prev.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)) }));
    },
    [updateState],
  );

  const reorderLessons = useCallback(
    (moduleId: string, orderedLessonIds: string[]) => {
      updateState((prev) => ({
        ...prev,
        lessons: prev.lessons.map((l) => {
          if (l.moduleId !== moduleId) return l;
          const idx = orderedLessonIds.indexOf(l.id);
          return idx === -1 ? l : { ...l, order: idx + 1 };
        }),
      }));
    },
    [updateState],
  );

  const setLessonStatus = useCallback(
    (lessonId: string, status: LessonStatus) => {
      updateState((prev) => ({ ...prev, lessons: prev.lessons.map((l) => (l.id === lessonId ? { ...l, status } : l)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Course access — package matrix + individual grants
  // -------------------------------------------------------------------
  const setPackageAccessMatrix = useCallback(
    (matrix: PackageAccessMatrix) => {
      updateState((prev) => ({ ...prev, packageAccessMatrix: matrix }));
    },
    [updateState],
  );

  const grantCourseAccess = useCallback(
    (
      studentId: string,
      courseId: string,
      source: CourseAccessSource,
      options?: { expiresAt?: string | null; notes?: string },
    ): CourseAccessGrant => {
      const iso = nowIso();
      let created!: CourseAccessGrant;
      updateState((prev) => {
        created = {
          id: crypto.randomUUID(),
          studentId,
          courseId,
          source,
          grantedBy: CURRENT_DEMO_USER,
          grantedAt: iso,
          expiresAt: options?.expiresAt ?? null,
          status: "Active",
          revokedAt: null,
          revokedBy: null,
          notes: options?.notes ?? "",
        };
        return { ...prev, accessGrants: [created, ...prev.accessGrants] };
      });
      const course = state.courses.find((c) => c.id === courseId);
      appendActivity(studentId, `Course access granted — ${course?.title ?? courseId} (${source})`);
      dispatchGhlEvent({
        type: "student.course_access_granted",
        occurredAt: iso,
        studentId,
        summary: `Course access granted: ${course?.title ?? courseId}`,
      });
      return created;
    },
    [updateState, state.courses, appendActivity],
  );

  const revokeCourseAccess = useCallback(
    (grantId: string) => {
      const iso = nowIso();
      const grant = state.accessGrants.find((g) => g.id === grantId);
      if (!grant) return;
      updateState((prev) => ({
        ...prev,
        accessGrants: prev.accessGrants.map((g) =>
          g.id === grantId ? { ...g, status: "Revoked", revokedAt: iso, revokedBy: CURRENT_DEMO_USER } : g,
        ),
      }));
      const course = state.courses.find((c) => c.id === grant.courseId);
      appendActivity(grant.studentId, `Course access revoked — ${course?.title ?? grant.courseId}`);
    },
    [updateState, state.accessGrants, state.courses, appendActivity],
  );

  const extendCourseAccess = useCallback(
    (grantId: string, newExpiresAt: string) => {
      const grant = state.accessGrants.find((g) => g.id === grantId);
      if (!grant) return;
      updateState((prev) => ({
        ...prev,
        accessGrants: prev.accessGrants.map((g) => (g.id === grantId ? { ...g, expiresAt: newExpiresAt, status: "Active" } : g)),
      }));
      const course = state.courses.find((c) => c.id === grant.courseId);
      appendActivity(grant.studentId, `Course access extended — ${course?.title ?? grant.courseId} (new expiry: ${newExpiresAt})`);
    },
    [updateState, state.accessGrants, state.courses, appendActivity],
  );

  // -------------------------------------------------------------------
  // Lesson progress — the single source of truth every course progress
  // view is computed from (see computeCourseProgress in src/utils/lms.ts).
  // -------------------------------------------------------------------
  const upsertProgress = useCallback(
    (
      studentId: string,
      courseId: string,
      moduleId: string,
      lessonId: string,
      patch: Partial<Pick<LessonProgress, "status" | "startedAt" | "completedAt">>,
    ) => {
      const iso = nowIso();
      updateState((prev) => {
        const existing = prev.lessonProgress.find(
          (p) => p.studentId === studentId && p.lessonId === lessonId,
        );
        if (existing) {
          return {
            ...prev,
            lessonProgress: prev.lessonProgress.map((p) =>
              p.id === existing.id ? { ...p, ...patch, lastAccessedAt: iso } : p,
            ),
          };
        }
        const created: LessonProgress = {
          id: crypto.randomUUID(),
          studentId,
          courseId,
          moduleId,
          lessonId,
          status: "Not Started",
          startedAt: null,
          completedAt: null,
          lastAccessedAt: iso,
          ...patch,
        };
        return { ...prev, lessonProgress: [...prev.lessonProgress, created] };
      });
    },
    [updateState],
  );

  const startLesson = useCallback(
    (studentId: string, courseId: string, moduleId: string, lessonId: string) => {
      const iso = nowIso();
      const existing = state.lessonProgress.find((p) => p.studentId === studentId && p.lessonId === lessonId);
      upsertProgress(studentId, courseId, moduleId, lessonId, {
        status: existing?.status === "Completed" ? "Completed" : "In Progress",
        startedAt: existing?.startedAt ?? iso,
        completedAt: existing?.completedAt ?? null,
      });
    },
    [state.lessonProgress, upsertProgress],
  );

  const completeLesson = useCallback(
    (studentId: string, courseId: string, moduleId: string, lessonId: string) => {
      const iso = nowIso();
      const existing = state.lessonProgress.find((p) => p.studentId === studentId && p.lessonId === lessonId);
      upsertProgress(studentId, courseId, moduleId, lessonId, {
        status: "Completed",
        startedAt: existing?.startedAt ?? iso,
        completedAt: iso,
      });

      const lesson = state.lessons.find((l) => l.id === lessonId);
      appendActivity(studentId, `Completed lesson — ${lesson?.title ?? lessonId}`);

      // Check whether this lesson was the last one needed to finish the course.
      const nextProgress = [
        ...state.lessonProgress.filter((p) => !(p.studentId === studentId && p.lessonId === lessonId)),
        { studentId, courseId, moduleId, lessonId, status: "Completed" as const, startedAt: existing?.startedAt ?? iso, completedAt: iso, lastAccessedAt: iso, id: existing?.id ?? crypto.randomUUID() },
      ];
      const progressSummary = computeCourseProgress(studentId, courseId, state.lessons, nextProgress);
      if (progressSummary.status === "Completed") {
        const course = state.courses.find((c) => c.id === courseId);
        appendActivity(studentId, `Course completed — ${course?.title ?? courseId}`);
        dispatchGhlEvent({
          type: "student.course_completed",
          occurredAt: iso,
          studentId,
          summary: `Course completed: ${course?.title ?? courseId}`,
        });
      }
    },
    [state.lessonProgress, state.lessons, state.courses, upsertProgress, appendActivity],
  );

  const setAccessAutomation = useCallback(
    (settings: CourseAccessAutomationSettings) => {
      updateState((prev) => ({ ...prev, automationSettings: settings }));
    },
    [updateState],
  );

  const value = useMemo<LmsStoreValue>(
    () => ({
      courses: state.courses,
      modules: state.modules,
      lessons: state.lessons,
      packageAccessMatrix: state.packageAccessMatrix,
      accessGrants: state.accessGrants,
      lessonProgress: state.lessonProgress,
      automationSettings: state.automationSettings,
      createCourse,
      updateCourse,
      setCourseStatus,
      duplicateCourse,
      createModule,
      updateModule,
      reorderModules,
      archiveModule,
      createLesson,
      updateLesson,
      reorderLessons,
      setLessonStatus,
      setPackageAccessMatrix,
      grantCourseAccess,
      revokeCourseAccess,
      extendCourseAccess,
      startLesson,
      completeLesson,
      setAccessAutomation,
    }),
    [
      state,
      createCourse,
      updateCourse,
      setCourseStatus,
      duplicateCourse,
      createModule,
      updateModule,
      reorderModules,
      archiveModule,
      createLesson,
      updateLesson,
      reorderLessons,
      setLessonStatus,
      setPackageAccessMatrix,
      grantCourseAccess,
      revokeCourseAccess,
      extendCourseAccess,
      startLesson,
      completeLesson,
      setAccessAutomation,
    ],
  );

  // `students` isn't referenced directly here (progress/access are keyed
  // by studentId, resolved by callers) but the store depends on
  // StudentStoreProvider being mounted above it for appendActivity to work.
  void students;

  return <LmsStoreContext.Provider value={value}>{children}</LmsStoreContext.Provider>;
}

export function useLmsStore() {
  const ctx = useContext(LmsStoreContext);
  if (!ctx) throw new Error("useLmsStore must be used within a LmsStoreProvider");
  return ctx;
}
