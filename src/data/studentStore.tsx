import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  AdminNote,
  Batch,
  DocumentReviewStatus,
  EnrollmentStatus,
  EnrollmentSubmission,
  MasterBrainStatus,
  StudentRecord,
  TaobaoStatus,
  UploadedFileMeta,
} from "@/types/student";
import { DEMO_STUDENTS } from "@/data/demoStudents";
import { PACKAGE_PRICES } from "@/data/enrollmentConfig";
import { generateStudentId } from "@/utils/studentId";
import { dispatchGhlEvent } from "@/integrations/ghlEvents";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// This store keeps Student Records in React state and mirrors them into this
// browser's localStorage so that a submission made on the public Enrollment
// Form is visible in the admin's New Enrollments / All Students pages within
// the same browser during this demo. This is NOT a real database:
//   - It is not shared across devices, browsers, or users.
//   - It is not encrypted, backed up, or access-controlled.
//   - Clearing browser data will erase it.
// A real backend/database integration will replace this store in a later
// build step without requiring changes to the pages/components that consume
// useStudentStore().
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_students_v1";

function loadInitialStudents(): StudentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StudentRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  return DEMO_STUDENTS;
}

function persist(students: StudentRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
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

const CURRENT_DEMO_USER = "Mommy Ann";

interface StudentStoreValue {
  students: StudentRecord[];
  getStudentById: (id: string) => StudentRecord | undefined;
  submitEnrollment: (submission: EnrollmentSubmission) => StudentRecord;
  updateEnrollmentStatus: (id: string, status: EnrollmentStatus) => void;
  updateDocumentStatus: (id: string, doc: "validId" | "proofOfPayment", status: DocumentReviewStatus, note?: string) => void;
  updateTaobao: (
    id: string,
    updates: Partial<{ status: TaobaoStatus; username: string; dateGiven: string | null; adminNotes: string }>,
  ) => void;
  updateMasterBrainStatus: (id: string, status: MasterBrainStatus) => void;
  addAdminNote: (id: string, text: string) => void;
  /** Appends a free-form entry to a student's Activity History. Used by other
   * stores (e.g. the finance store) so financial actions on a student show up
   * in their profile's Activity History tab, without those stores needing to
   * know how StudentRecord is structured internally. `user` defaults to the
   * demo admin — pass the student's own name for Student Portal actions. */
  appendActivity: (id: string, action: string, user?: string) => void;
  /** A student (re)submitting a requirement document from the Student Portal — resets that document to Pending review with the new file. */
  resubmitDocument: (id: string, doc: "validId" | "proofOfPayment", file: UploadedFileMeta) => void;
  /** Applies an approved, low-risk profile field update (see AUTO_APPLIABLE_FIELDS in portalStore). */
  applyProfileFieldUpdate: (id: string, field: string, newValue: string) => void;
}

const StudentStoreContext = createContext<StudentStoreValue | undefined>(undefined);

export function StudentStoreProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<StudentRecord[]>(() => loadInitialStudents());

  const updateStudent = useCallback((id: string, updater: (student: StudentRecord) => StudentRecord) => {
    setStudents((prev) => {
      const next = prev.map((s) => (s.id === id ? updater(s) : s));
      persist(next);
      return next;
    });
  }, []);

  const getStudentById = useCallback((id: string) => students.find((s) => s.id === id), [students]);

  const submitEnrollment = useCallback((submission: EnrollmentSubmission): StudentRecord => {
    const { iso, date, time } = nowParts();
    let created!: StudentRecord;

    setStudents((prev) => {
      const studentId = generateStudentId(submission.batch as Batch, prev);
      created = {
        id: crypto.randomUUID(),
        studentId,
        facebookName: submission.facebookName,
        fullName: submission.fullName,
        companionName: submission.companionName,
        email: submission.email,
        contactNumber: submission.contactNumber,
        city: submission.city,
        batch: submission.batch,
        package: submission.package,
        attendance: submission.attendance,
        enrollmentDate: iso,
        enrollmentStatus: "Pending Verification",
        dateSubmitted: iso,
        validId: { status: "Pending", file: submission.validIdFile },
        proofOfPayment: { status: "Pending", file: submission.proofOfPaymentFile },
        payment: {
          packagePrice: PACKAGE_PRICES[submission.package],
        },
        taobao: { status: "Not Yet Created", username: "", dateCreated: null, dateGiven: null, adminNotes: "" },
        masterBrainStatus: "Not Started",
        termsAccepted: submission.termsAccepted,
        termsAcceptedDate: iso,
        termsVersion: submission.termsVersion,
        adminNotes: [],
        activity: [{ id: crypto.randomUUID(), action: "Enrollment submitted", date, time, user: "Student (Public Form)" }],
      };
      const next = [created, ...prev];
      persist(next);
      return next;
    });

    return created;
  }, []);

  const updateEnrollmentStatus = useCallback(
    (id: string, status: EnrollmentStatus) => {
      const { date, time } = nowParts();
      updateStudent(id, (s) => ({
        ...s,
        enrollmentStatus: status,
        activity: [...s.activity, { id: crypto.randomUUID(), action: `Enrollment status changed to ${status}`, date, time, user: CURRENT_DEMO_USER }],
      }));
    },
    [updateStudent],
  );

  const updateDocumentStatus = useCallback(
    (id: string, doc: "validId" | "proofOfPayment", status: DocumentReviewStatus, note?: string) => {
      const { iso, date, time } = nowParts();
      const label = doc === "validId" ? "Valid ID" : "Proof of Payment";
      updateStudent(id, (s) => ({
        ...s,
        [doc]: { ...s[doc], status, note: status === "Needs Resubmission" ? (note ?? "") : "" },
        activity: [
          ...s.activity,
          {
            id: crypto.randomUUID(),
            action: `${label} marked ${status}${status === "Needs Resubmission" && note ? ` — ${note}` : ""}`,
            date,
            time,
            user: CURRENT_DEMO_USER,
          },
        ],
      }));
      if (status === "Needs Resubmission") {
        dispatchGhlEvent({
          type: "student.requirement_missing",
          occurredAt: iso,
          studentId: id,
          summary: `${label} needs resubmission${note ? `: ${note}` : ""}`,
        });
      }
    },
    [updateStudent],
  );

  const updateTaobao = useCallback(
    (
      id: string,
      updates: Partial<{ status: TaobaoStatus; username: string; dateGiven: string | null; adminNotes: string }>,
    ) => {
      const { iso, date, time } = nowParts();
      updateStudent(id, (s) => {
        const statusChanged = updates.status && updates.status !== s.taobao.status;
        const dateCreated =
          statusChanged && updates.status !== "Not Yet Created" && !s.taobao.dateCreated ? iso : s.taobao.dateCreated;
        const dateGiven =
          updates.dateGiven !== undefined
            ? updates.dateGiven
            : statusChanged && updates.status === "Login Details Given to Student"
              ? iso
              : s.taobao.dateGiven;

        return {
          ...s,
          taobao: { ...s.taobao, ...updates, dateCreated, dateGiven },
          activity: statusChanged
            ? [...s.activity, { id: crypto.randomUUID(), action: `Taobao login status updated to ${updates.status}`, date, time, user: CURRENT_DEMO_USER }]
            : s.activity,
        };
      });
    },
    [updateStudent],
  );

  const updateMasterBrainStatus = useCallback(
    (id: string, status: MasterBrainStatus) => {
      const { iso, date, time } = nowParts();
      updateStudent(id, (s) => {
        if (s.masterBrainStatus === status) return s;
        return {
          ...s,
          masterBrainStatus: status,
          activity: [...s.activity, { id: crypto.randomUUID(), action: `Master Brain status updated to ${status}`, date, time, user: CURRENT_DEMO_USER }],
        };
      });
      if (status === "Submitted") {
        dispatchGhlEvent({
          type: "student.master_brain_submitted",
          occurredAt: iso,
          studentId: id,
          summary: "Master Brain submitted for review",
        });
      }
    },
    [updateStudent],
  );

  const addAdminNote = useCallback(
    (id: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const { iso, date, time } = nowParts();
      const note: AdminNote = { id: crypto.randomUUID(), text: trimmed, author: CURRENT_DEMO_USER, timestamp: iso };
      updateStudent(id, (s) => ({
        ...s,
        adminNotes: [note, ...s.adminNotes],
        activity: [...s.activity, { id: crypto.randomUUID(), action: "Admin note added", date, time, user: CURRENT_DEMO_USER }],
      }));
    },
    [updateStudent],
  );

  const appendActivity = useCallback(
    (id: string, action: string, user?: string) => {
      const { date, time } = nowParts();
      updateStudent(id, (s) => ({
        ...s,
        activity: [...s.activity, { id: crypto.randomUUID(), action, date, time, user: user ?? CURRENT_DEMO_USER }],
      }));
    },
    [updateStudent],
  );

  const resubmitDocument = useCallback(
    (id: string, doc: "validId" | "proofOfPayment", file: UploadedFileMeta) => {
      const { date, time } = nowParts();
      const label = doc === "validId" ? "Valid ID" : "Proof of Payment";
      updateStudent(id, (s) => ({
        ...s,
        [doc]: { status: "Pending", file, note: "" },
        activity: [
          ...s.activity,
          { id: crypto.randomUUID(), action: `${label} submitted for review`, date, time, user: s.fullName },
        ],
      }));
    },
    [updateStudent],
  );

  const applyProfileFieldUpdate = useCallback(
    (id: string, field: string, newValue: string) => {
      const { date, time } = nowParts();
      updateStudent(id, (s) => {
        let patch: Partial<StudentRecord> | null = null;
        if (field === "Facebook Name") patch = { facebookName: newValue };
        else if (field === "Email") patch = { email: newValue };
        else if (field === "Contact Number") patch = { contactNumber: newValue };
        else if (field === "City") patch = { city: newValue };
        if (!patch) return s;
        return {
          ...s,
          ...patch,
          activity: [
            ...s.activity,
            { id: crypto.randomUUID(), action: `${field} updated via approved request`, date, time, user: CURRENT_DEMO_USER },
          ],
        };
      });
    },
    [updateStudent],
  );

  const value = useMemo<StudentStoreValue>(
    () => ({
      students,
      getStudentById,
      submitEnrollment,
      updateEnrollmentStatus,
      updateDocumentStatus,
      updateTaobao,
      updateMasterBrainStatus,
      addAdminNote,
      appendActivity,
      resubmitDocument,
      applyProfileFieldUpdate,
    }),
    [
      students,
      getStudentById,
      submitEnrollment,
      updateEnrollmentStatus,
      updateDocumentStatus,
      updateTaobao,
      updateMasterBrainStatus,
      addAdminNote,
      appendActivity,
      resubmitDocument,
      applyProfileFieldUpdate,
    ],
  );

  return <StudentStoreContext.Provider value={value}>{children}</StudentStoreContext.Provider>;
}

export function useStudentStore() {
  const ctx = useContext(StudentStoreContext);
  if (!ctx) throw new Error("useStudentStore must be used within a StudentStoreProvider");
  return ctx;
}
