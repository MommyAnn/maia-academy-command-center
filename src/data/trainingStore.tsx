import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Batch, StudentRecord } from "@/types/student";
import type {
  AttendanceStatus,
  CertificateEligibilitySettings,
  CertificateRecord,
  SessionEnrollment,
  SessionMaterialLine,
  TrainingSession,
  TrainingSessionStatus,
  TrainingType,
} from "@/types/training";
import { DEFAULT_ELIGIBILITY_SETTINGS } from "@/types/training";
import { DEMO_CERTIFICATES, DEMO_SESSIONS, DEMO_SESSION_ENROLLMENTS } from "@/data/demoTraining";
import { CURRENT_DEMO_USER, DEFAULT_PROGRAM_NAME } from "@/data/trainingConfig";
import { generateCertificateId, generateSessionId } from "@/utils/training";
import { useStudentStore } from "@/data/studentStore";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: sessions, rosters, and
// certificates live in React state and are mirrored to this browser's
// localStorage only. Attendance is NOT production-persistent and
// certificate "files" are metadata only — no secure file storage backend
// exists yet, so nothing here should be presented as securely stored.
//
// Removing a student from a session roster only deletes that roster row —
// it never touches the student's own Academy record (see
// removeStudentFromSession below).
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_training_v1";

interface TrainingState {
  sessions: TrainingSession[];
  enrollments: SessionEnrollment[];
  certificates: CertificateRecord[];
  eligibilitySettings: CertificateEligibilitySettings;
}

function loadInitialState(): TrainingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TrainingState;
      if (parsed && Array.isArray(parsed.sessions)) {
        return { ...parsed, eligibilitySettings: parsed.eligibilitySettings ?? DEFAULT_ELIGIBILITY_SETTINGS };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  return {
    sessions: DEMO_SESSIONS,
    enrollments: DEMO_SESSION_ENROLLMENTS,
    certificates: DEMO_CERTIFICATES,
    eligibilitySettings: DEFAULT_ELIGIBILITY_SETTINGS,
  };
}

function persist(state: TrainingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowParts() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    date: d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
  };
}

export interface CreateSessionInput {
  title: string;
  type: TrainingType;
  batch: Batch;
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  capacity: number | null;
  platform: string;
  zoomLink: string;
  meetingId: string;
  passcode: string;
  trainer: string;
  assignedStaffIds: string[];
  materials: SessionMaterialLine[];
  description: string;
  notes: string;
}

export interface CreateCertificateInput {
  studentId: string;
  batch: Batch;
  program: string;
  certificateType: string;
}

interface TrainingStoreValue {
  sessions: TrainingSession[];
  enrollments: SessionEnrollment[];
  certificates: CertificateRecord[];
  eligibilitySettings: CertificateEligibilitySettings;
  getSessionById: (id: string) => TrainingSession | undefined;
  getEnrollmentsForSession: (sessionId: string) => SessionEnrollment[];
  getEnrollmentsForStudent: (studentId: string) => SessionEnrollment[];
  getCertificatesForStudent: (studentId: string) => CertificateRecord[];
  createSession: (input: CreateSessionInput) => TrainingSession;
  updateSession: (id: string, patch: Partial<CreateSessionInput>) => void;
  setSessionStatus: (id: string, status: TrainingSessionStatus) => void;
  addStudentToSession: (sessionId: string, studentId: string) => void;
  addAllEligibleFromBatch: (sessionId: string, students: StudentRecord[]) => number;
  removeStudentFromSession: (sessionId: string, studentId: string) => void;
  recordAttendance: (
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    checkInTime?: string | null,
  ) => void;
  updateEligibilitySettings: (patch: Partial<CertificateEligibilitySettings>) => void;
  markForPreparation: (input: CreateCertificateInput) => CertificateRecord;
  markReady: (certificateId: string) => void;
  markIssued: (certificateId: string, issueDate: string) => void;
  reissueCertificate: (certificateId: string) => CertificateRecord | null;
}

const TrainingStoreContext = createContext<TrainingStoreValue | undefined>(undefined);

export function TrainingStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrainingState>(() => loadInitialState());
  const { appendActivity } = useStudentStore();

  const updateState = useCallback((updater: (prev: TrainingState) => TrainingState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const getSessionById = useCallback((id: string) => state.sessions.find((s) => s.id === id), [state.sessions]);
  const getEnrollmentsForSession = useCallback(
    (sessionId: string) => state.enrollments.filter((e) => e.sessionId === sessionId),
    [state.enrollments],
  );
  const getEnrollmentsForStudent = useCallback(
    (studentId: string) => state.enrollments.filter((e) => e.studentId === studentId),
    [state.enrollments],
  );
  const getCertificatesForStudent = useCallback(
    (studentId: string) => state.certificates.filter((c) => c.studentId === studentId),
    [state.certificates],
  );

  const createSession = useCallback(
    (input: CreateSessionInput): TrainingSession => {
      const { iso } = nowParts();
      let created!: TrainingSession;
      updateState((prev) => {
        created = {
          id: crypto.randomUUID(),
          sessionId: generateSessionId(input.batch, prev.sessions),
          title: input.title,
          type: input.type,
          batch: input.batch,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          venueName: input.venueName,
          venueAddress: input.venueAddress,
          capacity: input.capacity,
          platform: input.platform,
          zoomLink: input.zoomLink,
          meetingId: input.meetingId,
          passcode: input.passcode,
          trainer: input.trainer,
          assignedStaffIds: input.assignedStaffIds,
          materials: input.materials,
          description: input.description,
          status: "Scheduled",
          notes: input.notes,
          createdBy: CURRENT_DEMO_USER,
          createdAt: iso,
          updatedAt: iso,
        };
        return { ...prev, sessions: [created, ...prev.sessions] };
      });
      return created;
    },
    [updateState],
  );

  const updateSession = useCallback(
    (id: string, patch: Partial<CreateSessionInput>) => {
      const { iso } = nowParts();
      updateState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: iso } : s)),
      }));
    },
    [updateState],
  );

  const setSessionStatus = useCallback(
    (id: string, status: TrainingSessionStatus) => {
      const { iso } = nowParts();
      updateState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === id ? { ...s, status, updatedAt: iso } : s)),
      }));
    },
    [updateState],
  );

  const addStudentToSession = useCallback(
    (sessionId: string, studentId: string) => {
      updateState((prev) => {
        if (prev.enrollments.some((e) => e.sessionId === sessionId && e.studentId === studentId)) return prev;
        const entry: SessionEnrollment = {
          id: crypto.randomUUID(),
          sessionId,
          studentId,
          eligibility: "Eligible",
          attendanceStatus: "Registered",
          checkInTime: null,
          checkOutTime: null,
          recordedBy: null,
          recordedAt: null,
          notes: "",
          addedAt: nowParts().iso,
        };
        return { ...prev, enrollments: [...prev.enrollments, entry] };
      });
    },
    [updateState],
  );

  const addAllEligibleFromBatch = useCallback(
    (sessionId: string, students: StudentRecord[]): number => {
      let addedCount = 0;
      updateState((prev) => {
        const existingIds = new Set(
          prev.enrollments.filter((e) => e.sessionId === sessionId).map((e) => e.studentId),
        );
        const toAdd = students.filter((s) => !existingIds.has(s.id));
        addedCount = toAdd.length;
        if (toAdd.length === 0) return prev;
        const { iso } = nowParts();
        const newEntries: SessionEnrollment[] = toAdd.map((s) => ({
          id: crypto.randomUUID(),
          sessionId,
          studentId: s.id,
          eligibility: "Eligible",
          attendanceStatus: "Registered",
          checkInTime: null,
          checkOutTime: null,
          recordedBy: null,
          recordedAt: null,
          notes: "",
          addedAt: iso,
        }));
        return { ...prev, enrollments: [...prev.enrollments, ...newEntries] };
      });
      return addedCount;
    },
    [updateState],
  );

  const removeStudentFromSession = useCallback(
    (sessionId: string, studentId: string) => {
      updateState((prev) => ({
        ...prev,
        enrollments: prev.enrollments.filter((e) => !(e.sessionId === sessionId && e.studentId === studentId)),
      }));
    },
    [updateState],
  );

  const recordAttendance = useCallback(
    (sessionId: string, studentId: string, status: AttendanceStatus, checkInTime?: string | null) => {
      const { iso } = nowParts();
      let session: TrainingSession | undefined;
      updateState((prev) => {
        session = prev.sessions.find((s) => s.id === sessionId);
        return {
          ...prev,
          enrollments: prev.enrollments.map((e) =>
            e.sessionId === sessionId && e.studentId === studentId
              ? {
                  ...e,
                  attendanceStatus: status,
                  checkInTime: checkInTime !== undefined ? checkInTime : (e.checkInTime ?? iso),
                  recordedBy: CURRENT_DEMO_USER,
                  recordedAt: iso,
                }
              : e,
          ),
        };
      });
      if (session) {
        appendActivity(studentId, `Attendance recorded: ${status} — ${session.title} (${session.sessionId})`);
      }
    },
    [updateState, appendActivity],
  );

  const updateEligibilitySettings = useCallback(
    (patch: Partial<CertificateEligibilitySettings>) => {
      updateState((prev) => ({ ...prev, eligibilitySettings: { ...prev.eligibilitySettings, ...patch } }));
    },
    [updateState],
  );

  const markForPreparation = useCallback(
    (input: CreateCertificateInput): CertificateRecord => {
      const { iso } = nowParts();
      let created!: CertificateRecord;
      updateState((prev) => {
        created = {
          id: crypto.randomUUID(),
          certificateId: generateCertificateId(input.batch, prev.certificates),
          studentId: input.studentId,
          batch: input.batch,
          program: input.program || DEFAULT_PROGRAM_NAME,
          certificateType: input.certificateType,
          completionDate: null,
          issueDate: null,
          status: "For Preparation",
          file: null,
          preparedBy: null,
          preparedAt: null,
          issuedBy: null,
          issuedAt: null,
          notes: "",
          reissueOfId: null,
          createdAt: iso,
        };
        return { ...prev, certificates: [created, ...prev.certificates] };
      });
      appendActivity(input.studentId, `Certificate marked for preparation: ${created.certificateId}`);
      return created;
    },
    [updateState, appendActivity],
  );

  const markReady = useCallback(
    (certificateId: string) => {
      const { iso } = nowParts();
      let studentId: string | null = null;
      let label = "";
      updateState((prev) => ({
        ...prev,
        certificates: prev.certificates.map((c) => {
          if (c.id !== certificateId) return c;
          studentId = c.studentId;
          label = c.certificateId;
          return { ...c, status: "Ready", preparedBy: CURRENT_DEMO_USER, preparedAt: iso };
        }),
      }));
      if (studentId) appendActivity(studentId, `Certificate marked ready: ${label}`);
    },
    [updateState, appendActivity],
  );

  const markIssued = useCallback(
    (certificateId: string, issueDate: string) => {
      const { iso } = nowParts();
      let studentId: string | null = null;
      let label = "";
      updateState((prev) => ({
        ...prev,
        certificates: prev.certificates.map((c) => {
          if (c.id !== certificateId) return c;
          studentId = c.studentId;
          label = c.certificateId;
          return { ...c, status: "Issued", issuedBy: CURRENT_DEMO_USER, issuedAt: iso, issueDate };
        }),
      }));
      if (studentId) appendActivity(studentId, `Certificate issued: ${label}`);
    },
    [updateState, appendActivity],
  );

  const reissueCertificate = useCallback(
    (certificateId: string): CertificateRecord | null => {
      const { iso } = nowParts();
      const holder: { value: CertificateRecord | null } = { value: null };
      updateState((prev) => {
        const original = prev.certificates.find((c) => c.id === certificateId);
        if (!original) return prev;
        const reissued: CertificateRecord = {
          ...original,
          id: crypto.randomUUID(),
          certificateId: generateCertificateId(original.batch, prev.certificates),
          status: "Issued",
          issuedBy: CURRENT_DEMO_USER,
          issuedAt: iso,
          issueDate: iso.slice(0, 10),
          reissueOfId: original.id,
          createdAt: iso,
        };
        holder.value = reissued;
        return {
          ...prev,
          certificates: [
            reissued,
            ...prev.certificates.map((c) => (c.id === certificateId ? { ...c, status: "Reissued" as const } : c)),
          ],
        };
      });
      const created = holder.value;
      if (created) appendActivity(created.studentId, `Certificate reissued: ${created.certificateId} (was ${certificateId})`);
      return created;
    },
    [updateState, appendActivity],
  );

  const value = useMemo<TrainingStoreValue>(
    () => ({
      sessions: state.sessions,
      enrollments: state.enrollments,
      certificates: state.certificates,
      eligibilitySettings: state.eligibilitySettings,
      getSessionById,
      getEnrollmentsForSession,
      getEnrollmentsForStudent,
      getCertificatesForStudent,
      createSession,
      updateSession,
      setSessionStatus,
      addStudentToSession,
      addAllEligibleFromBatch,
      removeStudentFromSession,
      recordAttendance,
      updateEligibilitySettings,
      markForPreparation,
      markReady,
      markIssued,
      reissueCertificate,
    }),
    [
      state,
      getSessionById,
      getEnrollmentsForSession,
      getEnrollmentsForStudent,
      getCertificatesForStudent,
      createSession,
      updateSession,
      setSessionStatus,
      addStudentToSession,
      addAllEligibleFromBatch,
      removeStudentFromSession,
      recordAttendance,
      updateEligibilitySettings,
      markForPreparation,
      markReady,
      markIssued,
      reissueCertificate,
    ],
  );

  return <TrainingStoreContext.Provider value={value}>{children}</TrainingStoreContext.Provider>;
}

export function useTrainingStore() {
  const ctx = useContext(TrainingStoreContext);
  if (!ctx) throw new Error("useTrainingStore must be used within a TrainingStoreProvider");
  return ctx;
}
