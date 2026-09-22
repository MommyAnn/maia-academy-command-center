import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  MasterBrainDocument,
  MasterBrainDocumentSection,
  MasterBrainRevisionRequest,
  MasterBrainSubmission,
} from "@/types/masterBrain";
import type { MasterBrainStatus } from "@/types/student";
import { DEMO_MASTER_BRAIN_DOCUMENTS, DEMO_MASTER_BRAIN_SUBMISSIONS, createEmptySubmission } from "@/data/masterBrainConfig";
import { generateMasterBrainDraft, getMissingRequiredFields } from "@/utils/masterBrain";
import { useStudentStore } from "@/data/studentStore";
import { dispatchGhlEvent } from "@/integrations/ghlEvents";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: submissions, revision
// requests, and generated documents live in React state and are mirrored to
// this browser's localStorage only. This is NOT a real database — not
// shared across devices/users, not encrypted, cleared if browser data is
// cleared. See src/data/masterBrainConfig.ts / src/utils/masterBrain.ts for
// why "generation" here is a deterministic template transform, never a real
// AI call.
//
// TWO RECORD TYPES, NEVER MERGED: `submissions` holds what the student
// typed (the questionnaire). `documents` holds the generated/edited final
// Brand Master Brain. Editing a document never mutates the submission it
// came from, and requesting a revision never mutates either — see
// requestRevision() below.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_master_brain_v1";
const CURRENT_DEMO_USER = "Mommy Ann";

interface MasterBrainState {
  submissions: MasterBrainSubmission[];
  documents: MasterBrainDocument[];
}

function loadInitialState(): MasterBrainState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MasterBrainState;
      if (parsed && Array.isArray(parsed.submissions)) {
        return { submissions: parsed.submissions, documents: parsed.documents ?? [] };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  // Persist immediately: the seed submissions' studentId values are
  // resolved against DEMO_STUDENTS at this exact load, and studentStore.tsx
  // now persists that same-load student array on first read too — so both
  // must freeze on load #1, or a reload would regenerate fresh random ids
  // on each side that no longer match each other.
  const seeded = { submissions: DEMO_MASTER_BRAIN_SUBMISSIONS, documents: DEMO_MASTER_BRAIN_DOCUMENTS };
  persist(seeded);
  return seeded;
}

function persist(state: MasterBrainState) {
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

export interface RequestRevisionInput {
  section: string;
  question: string;
  reason: string;
}

interface MasterBrainStoreValue {
  submissions: MasterBrainSubmission[];
  documents: MasterBrainDocument[];
  getSubmissionForStudent: (studentId: string) => MasterBrainSubmission | undefined;
  getDocumentsForStudent: (studentId: string) => MasterBrainDocument[];
  getPublishedDocument: (studentId: string) => MasterBrainDocument | undefined;
  startSubmission: (studentId: string) => MasterBrainSubmission;
  updateSubmission: (submissionId: string, patch: Partial<MasterBrainSubmission>) => void;
  saveProgress: (submissionId: string, currentStep: number, progressPercent: number) => void;
  submitAssessment: (submissionId: string) => { ok: boolean; missing: string[] };
  assignReviewer: (submissionId: string, reviewerId: string, reviewerName: string, dueDate: string) => void;
  requestRevision: (submissionId: string, input: RequestRevisionInput) => void;
  resubmitAfterRevision: (submissionId: string) => void;
  approveForGeneration: (submissionId: string) => void;
  startGeneration: (submissionId: string) => void;
  completeGeneration: (submissionId: string) => MasterBrainDocument;
  editDocumentSection: (documentId: string, sectionKey: string, patch: { content?: string; bullets?: string[] }) => void;
  approveDocumentSection: (documentId: string, sectionKey: string) => void;
  addCustomSection: (documentId: string, title: string) => void;
  beginFinalReview: (submissionId: string) => void;
  approveFinal: (submissionId: string) => void;
  publish: (submissionId: string, documentId: string) => void;
  addAdminNote: (submissionId: string, text: string) => void;
}

const MasterBrainStoreContext = createContext<MasterBrainStoreValue | undefined>(undefined);

export function MasterBrainStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MasterBrainState>(() => loadInitialState());
  const { appendActivity, updateMasterBrainStatus } = useStudentStore();

  const updateState = useCallback((updater: (prev: MasterBrainState) => MasterBrainState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const getSubmissionForStudent = useCallback(
    (studentId: string) => state.submissions.find((s) => s.studentId === studentId),
    [state.submissions],
  );

  const getDocumentsForStudent = useCallback(
    (studentId: string) => state.documents.filter((d) => d.studentId === studentId).sort((a, b) => b.documentVersion - a.documentVersion),
    [state.documents],
  );

  const getPublishedDocument = useCallback(
    (studentId: string) => state.documents.find((d) => d.studentId === studentId && d.isCurrentPublished),
    [state.documents],
  );

  const syncStatus = useCallback(
    (studentId: string, status: MasterBrainStatus) => updateMasterBrainStatus(studentId, status),
    [updateMasterBrainStatus],
  );

  const updateSubmissionInternal = useCallback(
    (submissionId: string, updater: (s: MasterBrainSubmission) => MasterBrainSubmission) => {
      updateState((prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) => (s.id === submissionId ? updater(s) : s)),
      }));
    },
    [updateState],
  );

  const startSubmission = useCallback(
    (studentId: string): MasterBrainSubmission => {
      const { iso } = nowParts();
      let created!: MasterBrainSubmission;
      updateState((prev) => {
        const existing = prev.submissions.find((s) => s.studentId === studentId);
        if (existing) {
          created = existing;
          return prev;
        }
        created = { ...createEmptySubmission(studentId), status: "In Progress", startedAt: iso, lastSaved: iso };
        return { ...prev, submissions: [created, ...prev.submissions] };
      });
      syncStatus(studentId, "In Progress");
      appendActivity(studentId, "Started Brand Master Brain questionnaire");
      return created;
    },
    [updateState, syncStatus, appendActivity],
  );

  const updateSubmission = useCallback(
    (submissionId: string, patch: Partial<MasterBrainSubmission>) => {
      const { iso } = nowParts();
      updateSubmissionInternal(submissionId, (s) => ({ ...s, ...patch, lastSaved: iso }));
    },
    [updateSubmissionInternal],
  );

  const saveProgress = useCallback(
    (submissionId: string, currentStep: number, progressPercent: number) => {
      const { iso } = nowParts();
      updateSubmissionInternal(submissionId, (s) => ({ ...s, currentStep, progressPercent, lastSaved: iso }));
    },
    [updateSubmissionInternal],
  );

  const submitAssessment = useCallback(
    (submissionId: string): { ok: boolean; missing: string[] } => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return { ok: false, missing: [] };
      const missing = getMissingRequiredFields(submission);
      if (missing.length > 0) return { ok: false, missing };

      const { iso } = nowParts();
      updateSubmissionInternal(submissionId, (s) => ({
        ...s,
        status: "Submitted",
        submittedAt: iso,
        lastSaved: iso,
        progressPercent: 100,
        submissionHistory: [
          ...s.submissionHistory,
          {
            id: crypto.randomUUID(),
            submissionVersion: s.submissionVersion,
            submittedAt: iso,
            submittedBy: CURRENT_DEMO_USER,
            reviewedBy: null,
            reviewedAt: null,
            statusAtSnapshot: "Submitted",
          },
        ],
      }));
      syncStatus(submission.studentId, "Submitted");
      appendActivity(submission.studentId, "Submitted Brand Master Brain assessment for review");
      return { ok: true, missing: [] };
    },
    [state.submissions, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const assignReviewer = useCallback(
    (submissionId: string, reviewerId: string, reviewerName: string, dueDate: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      updateSubmissionInternal(submissionId, (s) => ({
        ...s,
        assignedReviewerId: reviewerId,
        reviewDueDate: dueDate,
        status: s.status === "Submitted" ? "Under Review" : s.status,
      }));
      if (submission.status === "Submitted") syncStatus(submission.studentId, "Under Review");
      appendActivity(submission.studentId, `Master Brain assigned to ${reviewerName} for review`);
    },
    [state.submissions, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const requestRevision = useCallback(
    (submissionId: string, input: RequestRevisionInput) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      const { iso } = nowParts();
      const revision: MasterBrainRevisionRequest = {
        id: crypto.randomUUID(),
        section: input.section,
        question: input.question,
        reason: input.reason,
        requestedBy: CURRENT_DEMO_USER,
        requestedAt: iso,
        resolved: false,
        resolvedAt: null,
      };
      updateSubmissionInternal(submissionId, (s) => ({
        ...s,
        status: "Needs Revision",
        revisionRequests: [...s.revisionRequests, revision],
      }));
      syncStatus(submission.studentId, "Needs Revision");
      appendActivity(
        submission.studentId,
        `Master Brain revision requested — ${input.section}${input.question ? ` (${input.question})` : ""}: ${input.reason}`,
      );
    },
    [state.submissions, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const resubmitAfterRevision = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      const { iso } = nowParts();
      updateSubmissionInternal(submissionId, (s) => ({
        ...s,
        status: "Under Review",
        submissionVersion: s.submissionVersion + 1,
        submittedAt: iso,
        revisionRequests: s.revisionRequests.map((r) => (r.resolved ? r : { ...r, resolved: true, resolvedAt: iso })),
        submissionHistory: [
          ...s.submissionHistory,
          {
            id: crypto.randomUUID(),
            submissionVersion: s.submissionVersion + 1,
            submittedAt: iso,
            submittedBy: CURRENT_DEMO_USER,
            reviewedBy: null,
            reviewedAt: null,
            statusAtSnapshot: "Under Review",
          },
        ],
      }));
      syncStatus(submission.studentId, "Under Review");
      appendActivity(submission.studentId, "Resubmitted Brand Master Brain after requested revisions");
    },
    [state.submissions, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const approveForGeneration = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      const { iso } = nowParts();
      updateSubmissionInternal(submissionId, (s) => ({
        ...s,
        status: "Approved for Generation",
        reviewedBy: CURRENT_DEMO_USER,
        reviewedAt: iso,
      }));
      syncStatus(submission.studentId, "Approved for Generation");
      appendActivity(submission.studentId, "Master Brain approved for generation");
      dispatchGhlEvent({
        type: "student.master_brain_approved",
        occurredAt: iso,
        studentId: submission.studentId,
        summary: "Master Brain approved for generation",
      });
    },
    [state.submissions, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const startGeneration = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      updateSubmissionInternal(submissionId, (s) => ({ ...s, status: "Generating" }));
      syncStatus(submission.studentId, "Generating");
    },
    [state.submissions, updateSubmissionInternal, syncStatus],
  );

  const completeGeneration = useCallback(
    (submissionId: string): MasterBrainDocument => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) throw new Error("Submission not found");
      const { iso } = nowParts();
      const existingVersions = state.documents.filter((d) => d.submissionId === submissionId);
      const document: MasterBrainDocument = {
        id: crypto.randomUUID(),
        submissionId: submission.id,
        studentId: submission.studentId,
        businessId: submission.businessId,
        documentVersion: existingVersions.length + 1,
        generatedFromSubmissionVersion: submission.submissionVersion,
        generatedAt: iso,
        sections: generateMasterBrainDraft(submission),
        isCurrentPublished: false,
        publishedAt: null,
        publishedBy: null,
      };
      updateState((prev) => ({ ...prev, documents: [document, ...prev.documents] }));
      updateSubmissionInternal(submissionId, (s) => ({ ...s, status: "Draft Ready" }));
      syncStatus(submission.studentId, "Draft Ready");
      appendActivity(submission.studentId, "Master Brain draft generated and ready for admin editing");
      return document;
    },
    [state.submissions, state.documents, updateState, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const editDocumentSection = useCallback(
    (documentId: string, sectionKey: string, patch: { content?: string; bullets?: string[] }) => {
      const { iso } = nowParts();
      updateState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => {
          if (d.id !== documentId) return d;
          return {
            ...d,
            sections: d.sections.map((sec) =>
              sec.key === sectionKey
                ? { ...sec, ...patch, lastEditedBy: CURRENT_DEMO_USER, lastEditedAt: iso, approved: false }
                : sec,
            ),
          };
        }),
      }));
    },
    [updateState],
  );

  const approveDocumentSection = useCallback(
    (documentId: string, sectionKey: string) => {
      const { iso } = nowParts();
      updateState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) =>
          d.id !== documentId
            ? d
            : {
                ...d,
                sections: d.sections.map((sec) =>
                  sec.key === sectionKey ? { ...sec, approved: true, lastEditedBy: CURRENT_DEMO_USER, lastEditedAt: iso } : sec,
                ),
              },
        ),
      }));
    },
    [updateState],
  );

  const addCustomSection = useCallback(
    (documentId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const newSection: MasterBrainDocumentSection = {
        key: `custom-${crypto.randomUUID()}`,
        title: trimmed,
        content: "",
        bullets: [],
        approved: false,
        lastEditedBy: CURRENT_DEMO_USER,
        lastEditedAt: nowParts().iso,
      };
      updateState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => (d.id === documentId ? { ...d, sections: [...d.sections, newSection] } : d)),
      }));
    },
    [updateState],
  );

  const beginFinalReview = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      updateSubmissionInternal(submissionId, (s) => ({ ...s, status: "Final Review" }));
      syncStatus(submission.studentId, "Final Review");
      appendActivity(submission.studentId, "Master Brain sent to final review");
    },
    [state.submissions, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const approveFinal = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      updateSubmissionInternal(submissionId, (s) => ({ ...s, status: "Completed" }));
      syncStatus(submission.studentId, "Completed");
      appendActivity(submission.studentId, "Master Brain approved — ready to publish");
    },
    [state.submissions, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const publish = useCallback(
    (submissionId: string, documentId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      const { iso } = nowParts();
      updateState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => {
          if (d.studentId !== submission.studentId) return d;
          if (d.id === documentId) return { ...d, isCurrentPublished: true, publishedAt: iso, publishedBy: CURRENT_DEMO_USER };
          return { ...d, isCurrentPublished: false };
        }),
      }));
      updateSubmissionInternal(submissionId, (s) => ({ ...s, status: "Published" }));
      syncStatus(submission.studentId, "Published");
      appendActivity(submission.studentId, "Brand Master Brain published — now visible in the Student Portal");
      dispatchGhlEvent({ type: "masterbrain.published", occurredAt: iso, studentId: submission.studentId, summary: "Brand Master Brain published" });
    },
    [state.submissions, updateState, updateSubmissionInternal, syncStatus, appendActivity],
  );

  const addAdminNote = useCallback(
    (submissionId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const { iso } = nowParts();
      updateSubmissionInternal(submissionId, (s) => ({
        ...s,
        adminNotes: [{ id: crypto.randomUUID(), text: trimmed, author: CURRENT_DEMO_USER, timestamp: iso }, ...s.adminNotes],
      }));
    },
    [updateSubmissionInternal],
  );

  const value = useMemo<MasterBrainStoreValue>(
    () => ({
      submissions: state.submissions,
      documents: state.documents,
      getSubmissionForStudent,
      getDocumentsForStudent,
      getPublishedDocument,
      startSubmission,
      updateSubmission,
      saveProgress,
      submitAssessment,
      assignReviewer,
      requestRevision,
      resubmitAfterRevision,
      approveForGeneration,
      startGeneration,
      completeGeneration,
      editDocumentSection,
      approveDocumentSection,
      addCustomSection,
      beginFinalReview,
      approveFinal,
      publish,
      addAdminNote,
    }),
    [
      state,
      getSubmissionForStudent,
      getDocumentsForStudent,
      getPublishedDocument,
      startSubmission,
      updateSubmission,
      saveProgress,
      submitAssessment,
      assignReviewer,
      requestRevision,
      resubmitAfterRevision,
      approveForGeneration,
      startGeneration,
      completeGeneration,
      editDocumentSection,
      approveDocumentSection,
      addCustomSection,
      beginFinalReview,
      approveFinal,
      publish,
      addAdminNote,
    ],
  );

  return <MasterBrainStoreContext.Provider value={value}>{children}</MasterBrainStoreContext.Provider>;
}

export function useMasterBrainStore() {
  const ctx = useContext(MasterBrainStoreContext);
  if (!ctx) throw new Error("useMasterBrainStore must be used within a MasterBrainStoreProvider");
  return ctx;
}
