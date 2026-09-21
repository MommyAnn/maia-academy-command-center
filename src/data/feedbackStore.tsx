import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  FeedbackAutomationSettings,
  FeedbackIncentive,
  FeedbackIncentiveStatus,
  FeedbackRequest,
  FeedbackRequestStatus,
  FeedbackReviewStatus,
  FeedbackSourceType,
  FeedbackSubmission,
  IncentiveRedemption,
  MarketingConsent,
  MarketingPermittedAsset,
} from "@/types/feedback";
import { DEFAULT_FEEDBACK_AUTOMATION_SETTINGS } from "@/types/feedback";
import {
  DEMO_FEEDBACK_INCENTIVES,
  DEMO_FEEDBACK_REQUESTS,
  DEMO_FEEDBACK_SUBMISSIONS,
  DEMO_INCENTIVE_REDEMPTIONS,
  DEMO_MARKETING_CONSENTS,
  CURRENT_DEMO_USER,
  cloneDefaultQuestions,
} from "@/data/feedbackConfig";
import { generateConsentId, generateFeedbackId, generateFeedbackRequestId, isEligibleForIncentive } from "@/utils/feedback";
import { useStudentStore } from "@/data/studentStore";
import { useLmsStore } from "@/data/lmsStore";
import { computeCourseProgress } from "@/utils/lms";
import { dispatchGhlEvent } from "@/integrations/ghlEvents";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: requests, submissions,
// consents, incentives and redemptions live in React state mirrored to this
// browser's localStorage only. No real database, no real video/file
// storage behind any "uploaded" asset — see src/types/feedback.ts.
//
// CRITICAL: a FeedbackSubmission and a MarketingConsent are NEVER merged or
// implied by each other. submitFeedback() never touches consent. Consent is
// only ever created/changed by grantMarketingConsent()/withdrawConsent()
// below, and a withdrawal appends to history rather than deleting the past
// record — see MarketingConsent.history in src/types/feedback.ts.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_feedback_v1";

interface FeedbackState {
  requests: FeedbackRequest[];
  submissions: FeedbackSubmission[];
  incentives: FeedbackIncentive[];
  consents: MarketingConsent[];
  redemptions: IncentiveRedemption[];
  automationSettings: FeedbackAutomationSettings;
}

function loadInitialState(): FeedbackState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FeedbackState;
      if (parsed && Array.isArray(parsed.requests)) {
        return {
          requests: parsed.requests,
          submissions: parsed.submissions ?? [],
          incentives: parsed.incentives ?? [],
          consents: parsed.consents ?? [],
          redemptions: parsed.redemptions ?? [],
          automationSettings: parsed.automationSettings ?? DEFAULT_FEEDBACK_AUTOMATION_SETTINGS,
        };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  // Persist immediately — the seed submissions/consents/redemptions resolve
  // studentId against DEMO_STUDENTS at this exact module load, same
  // freeze-on-load-#1 requirement as every other Step 8/9 store.
  const seeded: FeedbackState = {
    requests: DEMO_FEEDBACK_REQUESTS,
    submissions: DEMO_FEEDBACK_SUBMISSIONS,
    incentives: DEMO_FEEDBACK_INCENTIVES,
    consents: DEMO_MARKETING_CONSENTS,
    redemptions: DEMO_INCENTIVE_REDEMPTIONS,
    automationSettings: DEFAULT_FEEDBACK_AUTOMATION_SETTINGS,
  };
  persist(seeded);
  return seeded;
}

function persist(state: FeedbackState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowIso() {
  return new Date().toISOString();
}

export interface CreateFeedbackRequestInput {
  title: string;
  sourceType: FeedbackSourceType;
  sourceId: string | null;
  sourceLabel: string;
  batch: FeedbackRequest["batch"];
  audience: FeedbackRequest["audience"];
  audienceStudentId: string | null;
  message: string;
  questions: FeedbackRequest["questions"];
  allowWritten: boolean;
  allowVideo: boolean;
  incentiveId: string | null;
  openDate: string;
  closeDate: string | null;
}

export interface SubmitFeedbackInput {
  requestId: string | null;
  studentId: string;
  sourceType: FeedbackSourceType;
  sourceId: string | null;
  sourceLabel: string;
  batch: FeedbackSubmission["batch"];
  rating: number | null;
  writtenFeedback: string;
  videoAsset: FeedbackSubmission["videoAsset"];
  answers: FeedbackSubmission["answers"];
  incentiveId: string | null;
}

export interface CreateIncentiveInput {
  name: string;
  description: string;
  eligibility: string;
  sourceTypeFilter: FeedbackIncentive["sourceTypeFilter"];
  deliveryType: FeedbackIncentive["deliveryType"];
  bonusCourseId: string | null;
  resourceFileMeta: FeedbackIncentive["resourceFileMeta"];
}

interface FeedbackStoreValue {
  requests: FeedbackRequest[];
  submissions: FeedbackSubmission[];
  incentives: FeedbackIncentive[];
  consents: MarketingConsent[];
  redemptions: IncentiveRedemption[];
  automationSettings: FeedbackAutomationSettings;

  setAutomationSettings: (settings: FeedbackAutomationSettings) => void;
  createRequest: (input: CreateFeedbackRequestInput) => FeedbackRequest;
  updateRequest: (requestId: string, patch: Partial<FeedbackRequest>) => void;
  setRequestStatus: (requestId: string, status: FeedbackRequestStatus) => void;

  saveDraft: (existingId: string | null, input: SubmitFeedbackInput) => FeedbackSubmission;
  submitFeedback: (existingId: string | null, input: SubmitFeedbackInput) => FeedbackSubmission;

  grantMarketingConsent: (feedbackId: string, studentId: string, permittedAssets: MarketingPermittedAsset[], consentVersion: string) => MarketingConsent;
  withdrawConsent: (consentId: string) => void;
  getConsentForFeedback: (feedbackId: string) => MarketingConsent | undefined;

  markReviewed: (submissionId: string) => void;
  approveForMarketing: (submissionId: string) => { ok: boolean; reason?: string };
  keepPrivate: (submissionId: string) => void;
  featureSubmission: (submissionId: string) => void;
  archiveSubmission: (submissionId: string) => void;
  addInternalNote: (submissionId: string, text: string) => void;
  setMarketingTags: (submissionId: string, tags: string[]) => void;

  createIncentive: (input: CreateIncentiveInput) => FeedbackIncentive;
  updateIncentive: (incentiveId: string, patch: Partial<FeedbackIncentive>) => void;
  setIncentiveStatus: (incentiveId: string, status: FeedbackIncentiveStatus) => void;

  deliverRedemption: (redemptionId: string) => void;
}

const FeedbackStoreContext = createContext<FeedbackStoreValue | undefined>(undefined);

export function FeedbackStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FeedbackState>(() => loadInitialState());
  const { students, appendActivity } = useStudentStore();
  const { courses, lessons, lessonProgress, grantCourseAccess } = useLmsStore();

  const updateState = useCallback((updater: (prev: FeedbackState) => FeedbackState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const setAutomationSettings = useCallback(
    (settings: FeedbackAutomationSettings) => {
      updateState((prev) => ({ ...prev, automationSettings: settings }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Automatic feedback request trigger (spec section 28): the first time
  // ANY student completes a Published course, open one course-wide
  // FeedbackRequest (audience: all eligible students) so everyone who
  // completes it — now or later — sees it. Configurable via
  // automationSettings.onCourseCompleted, and deduped one request per
  // course (never a duplicate request for the same source).
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!state.automationSettings.onCourseCompleted) return;
    if (students.length === 0 || courses.length === 0) return;

    updateState((prev) => {
      let changed = false;
      const nextRequests = [...prev.requests];
      const hasRequestFor = (courseId: string) => nextRequests.some((r) => r.sourceType === "Course" && r.sourceId === courseId);

      for (const course of courses) {
        if (course.status !== "Published") continue;
        if (hasRequestFor(course.id)) continue;
        const anyoneCompleted = students.some((s) => computeCourseProgress(s.id, course.id, lessons, lessonProgress).status === "Completed");
        if (!anyoneCompleted) continue;

        const iso = new Date().toISOString();
        nextRequests.push({
          id: crypto.randomUUID(),
          requestId: generateFeedbackRequestId(nextRequests),
          title: `${course.title} — Course Feedback`,
          sourceType: "Course",
          sourceId: course.id,
          sourceLabel: course.title,
          batch: "",
          audience: "All Eligible Students",
          audienceStudentId: null,
          message: `Congratulations on completing ${course.title}! We'd love to hear about your experience.`,
          questions: cloneDefaultQuestions(),
          allowWritten: true,
          allowVideo: true,
          incentiveId: null,
          openDate: iso,
          closeDate: null,
          status: "Open",
          createdBy: "System (Automatic)",
          createdAt: iso,
        });
        changed = true;
      }

      return changed ? { ...prev, requests: nextRequests } : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.automationSettings.onCourseCompleted, students, courses, lessons, lessonProgress]);

  // -------------------------------------------------------------------
  // Feedback Requests
  // -------------------------------------------------------------------
  const createRequest = useCallback(
    (input: CreateFeedbackRequestInput): FeedbackRequest => {
      let created!: FeedbackRequest;
      updateState((prev) => {
        created = {
          ...input,
          id: crypto.randomUUID(),
          requestId: generateFeedbackRequestId(prev.requests),
          status: "Draft",
          createdBy: CURRENT_DEMO_USER,
          createdAt: nowIso(),
        };
        return { ...prev, requests: [created, ...prev.requests] };
      });
      return created;
    },
    [updateState],
  );

  const updateRequest = useCallback(
    (requestId: string, patch: Partial<FeedbackRequest>) => {
      updateState((prev) => ({ ...prev, requests: prev.requests.map((r) => (r.id === requestId ? { ...r, ...patch } : r)) }));
    },
    [updateState],
  );

  const setRequestStatus = useCallback(
    (requestId: string, status: FeedbackRequestStatus) => {
      updateState((prev) => ({ ...prev, requests: prev.requests.map((r) => (r.id === requestId ? { ...r, status } : r)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Redemptions — unlock/deliver (spec section 36). Never rating-gated;
  // isEligibleForIncentive() only checks that a genuine submission exists.
  // -------------------------------------------------------------------
  const unlockEligibleIncentive = useCallback(
    (submission: FeedbackSubmission) => {
      if (!submission.incentiveId) return;
      const incentive = state.incentives.find((i) => i.id === submission.incentiveId);
      if (!incentive || !isEligibleForIncentive(submission, incentive)) return;

      const iso = nowIso();
      const isImmediatelyDeliverable = incentive.deliveryType === "Bonus Course" || Boolean(incentive.resourceFileMeta);
      const redemption: IncentiveRedemption = {
        id: crypto.randomUUID(),
        incentiveId: incentive.id,
        studentId: submission.studentId,
        feedbackSubmissionId: submission.id,
        unlockedAt: iso,
        deliveryStatus: isImmediatelyDeliverable ? "Delivered" : "Unlocked",
        deliveredAt: isImmediatelyDeliverable ? iso : null,
      };
      updateState((prev) => ({ ...prev, redemptions: [redemption, ...prev.redemptions] }));

      if (incentive.deliveryType === "Bonus Course" && incentive.bonusCourseId) {
        grantCourseAccess(submission.studentId, incentive.bonusCourseId, "Bonus", {
          notes: `Unlocked from feedback incentive: ${incentive.name}`,
        });
      }

      appendActivity(submission.studentId, `Bonus unlocked — ${incentive.name}`);
      dispatchGhlEvent({
        type: "student.incentive_unlocked",
        occurredAt: iso,
        studentId: submission.studentId,
        summary: `Feedback incentive unlocked: ${incentive.name}`,
      });
    },
    [state.incentives, updateState, grantCourseAccess, appendActivity],
  );

  // -------------------------------------------------------------------
  // Feedback Submissions
  // -------------------------------------------------------------------
  const saveDraft = useCallback(
    (existingId: string | null, input: SubmitFeedbackInput): FeedbackSubmission => {
      const iso = nowIso();
      let result!: FeedbackSubmission;
      updateState((prev) => {
        if (existingId) {
          const existing = prev.submissions.find((s) => s.id === existingId);
          if (existing) {
            result = { ...existing, ...input, lastSaved: iso, isDraft: true };
            return { ...prev, submissions: prev.submissions.map((s) => (s.id === existingId ? result : s)) };
          }
        }
        result = {
          id: crypto.randomUUID(),
          feedbackId: generateFeedbackId(prev.submissions),
          ...input,
          status: "Submitted",
          reviewedBy: null,
          reviewedAt: null,
          internalNotes: [],
          marketingTags: [],
          submittedAt: iso,
          lastSaved: iso,
          isDraft: true,
        };
        return { ...prev, submissions: [result, ...prev.submissions] };
      });
      return result;
    },
    [updateState],
  );

  const submitFeedback = useCallback(
    (existingId: string | null, input: SubmitFeedbackInput): FeedbackSubmission => {
      const iso = nowIso();
      let result!: FeedbackSubmission;
      updateState((prev) => {
        if (existingId) {
          const existing = prev.submissions.find((s) => s.id === existingId);
          if (existing) {
            result = { ...existing, ...input, status: "Submitted", submittedAt: iso, lastSaved: iso, isDraft: false };
            return { ...prev, submissions: prev.submissions.map((s) => (s.id === existingId ? result : s)) };
          }
        }
        result = {
          id: crypto.randomUUID(),
          feedbackId: generateFeedbackId(prev.submissions),
          ...input,
          status: "Submitted",
          reviewedBy: null,
          reviewedAt: null,
          internalNotes: [],
          marketingTags: [],
          submittedAt: iso,
          lastSaved: iso,
          isDraft: false,
        };
        return { ...prev, submissions: [result, ...prev.submissions] };
      });
      appendActivity(input.studentId, `Submitted feedback — ${input.sourceLabel}`);
      dispatchGhlEvent({
        type: "student.feedback_submitted",
        occurredAt: iso,
        studentId: input.studentId,
        summary: `Feedback submitted: ${input.sourceLabel}`,
      });
      if (input.requestId) setRequestStatus(input.requestId, "Open");
      unlockEligibleIncentive(result);
      return result;
    },
    [updateState, appendActivity, setRequestStatus, unlockEligibleIncentive],
  );

  // -------------------------------------------------------------------
  // Marketing Consent — always separate from the submission itself.
  // -------------------------------------------------------------------
  const grantMarketingConsent = useCallback(
    (feedbackId: string, studentId: string, permittedAssets: MarketingPermittedAsset[], consentVersion: string): MarketingConsent => {
      const iso = nowIso();
      let created!: MarketingConsent;
      updateState((prev) => {
        const existing = prev.consents.find((c) => c.feedbackId === feedbackId);
        if (existing) {
          created = {
            ...existing,
            status: "Granted",
            consentDate: iso,
            consentVersion,
            permittedAssets,
            history: [...existing.history, { status: "Granted", date: iso, permittedAssets }],
          };
          return { ...prev, consents: prev.consents.map((c) => (c.id === existing.id ? created : c)) };
        }
        created = {
          id: crypto.randomUUID(),
          consentId: generateConsentId(prev.consents),
          feedbackId,
          studentId,
          status: "Granted",
          consentDate: iso,
          consentVersion,
          permittedAssets,
          history: [{ status: "Granted", date: iso, permittedAssets }],
        };
        return { ...prev, consents: [created, ...prev.consents] };
      });
      appendActivity(studentId, "Marketing consent granted for submitted feedback");
      dispatchGhlEvent({
        type: "student.marketing_consent_granted",
        occurredAt: iso,
        studentId,
        summary: "Marketing consent granted",
      });
      return created;
    },
    [updateState, appendActivity],
  );

  const withdrawConsent = useCallback(
    (consentId: string) => {
      const iso = nowIso();
      const consent = state.consents.find((c) => c.id === consentId);
      if (!consent) return;
      updateState((prev) => ({
        ...prev,
        consents: prev.consents.map((c) =>
          c.id === consentId
            ? { ...c, status: "Withdrawn", history: [...c.history, { status: "Withdrawn", date: iso, permittedAssets: [] }] }
            : c,
        ),
        // A withdrawn consent can no longer justify a marketing-approved testimonial staying public.
        submissions: prev.submissions.map((s) =>
          s.feedbackId === consent.feedbackId && s.status === "Approved for Marketing" ? { ...s, status: "Kept Private" } : s,
        ),
      }));
      appendActivity(consent.studentId, "Marketing consent withdrawn");
    },
    [updateState, state.consents, appendActivity],
  );

  const getConsentForFeedback = useCallback(
    (feedbackId: string) => state.consents.find((c) => c.feedbackId === feedbackId),
    [state.consents],
  );

  // -------------------------------------------------------------------
  // Admin review actions
  // -------------------------------------------------------------------
  const setReviewStatus = useCallback(
    (submissionId: string, status: FeedbackReviewStatus) => {
      const iso = nowIso();
      updateState((prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === submissionId ? { ...s, status, reviewedBy: CURRENT_DEMO_USER, reviewedAt: iso } : s,
        ),
      }));
    },
    [updateState],
  );

  const markReviewed = useCallback((submissionId: string) => setReviewStatus(submissionId, "Reviewed"), [setReviewStatus]);

  const approveForMarketing = useCallback(
    (submissionId: string): { ok: boolean; reason?: string } => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return { ok: false, reason: "Submission not found." };
      const consent = state.consents.find((c) => c.feedbackId === submission.feedbackId);
      if (!consent || consent.status !== "Granted") {
        return { ok: false, reason: "This student hasn't granted marketing consent for this feedback yet." };
      }
      setReviewStatus(submissionId, "Approved for Marketing");
      return { ok: true };
    },
    [state.submissions, state.consents, setReviewStatus],
  );

  const keepPrivate = useCallback((submissionId: string) => setReviewStatus(submissionId, "Kept Private"), [setReviewStatus]);
  const featureSubmission = useCallback((submissionId: string) => setReviewStatus(submissionId, "Featured"), [setReviewStatus]);
  const archiveSubmission = useCallback((submissionId: string) => setReviewStatus(submissionId, "Archived"), [setReviewStatus]);

  const addInternalNote = useCallback(
    (submissionId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const iso = nowIso();
      updateState((prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === submissionId
            ? { ...s, internalNotes: [{ id: crypto.randomUUID(), text: trimmed, author: CURRENT_DEMO_USER, timestamp: iso }, ...s.internalNotes] }
            : s,
        ),
      }));
    },
    [updateState],
  );

  const setMarketingTags = useCallback(
    (submissionId: string, tags: string[]) => {
      updateState((prev) => ({ ...prev, submissions: prev.submissions.map((s) => (s.id === submissionId ? { ...s, marketingTags: tags } : s)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Incentives
  // -------------------------------------------------------------------
  const createIncentive = useCallback(
    (input: CreateIncentiveInput): FeedbackIncentive => {
      let created!: FeedbackIncentive;
      updateState((prev) => {
        created = { ...input, id: crypto.randomUUID(), status: "Active", createdAt: nowIso() };
        return { ...prev, incentives: [created, ...prev.incentives] };
      });
      return created;
    },
    [updateState],
  );

  const updateIncentive = useCallback(
    (incentiveId: string, patch: Partial<FeedbackIncentive>) => {
      updateState((prev) => ({ ...prev, incentives: prev.incentives.map((i) => (i.id === incentiveId ? { ...i, ...patch } : i)) }));
    },
    [updateState],
  );

  const setIncentiveStatus = useCallback(
    (incentiveId: string, status: FeedbackIncentiveStatus) => {
      updateState((prev) => ({ ...prev, incentives: prev.incentives.map((i) => (i.id === incentiveId ? { ...i, status } : i)) }));
    },
    [updateState],
  );

  const deliverRedemption = useCallback(
    (redemptionId: string) => {
      const iso = nowIso();
      updateState((prev) => ({
        ...prev,
        redemptions: prev.redemptions.map((r) => (r.id === redemptionId ? { ...r, deliveryStatus: "Delivered", deliveredAt: iso } : r)),
      }));
    },
    [updateState],
  );

  const value = useMemo<FeedbackStoreValue>(
    () => ({
      requests: state.requests,
      submissions: state.submissions,
      incentives: state.incentives,
      consents: state.consents,
      redemptions: state.redemptions,
      automationSettings: state.automationSettings,
      setAutomationSettings,
      createRequest,
      updateRequest,
      setRequestStatus,
      saveDraft,
      submitFeedback,
      grantMarketingConsent,
      withdrawConsent,
      getConsentForFeedback,
      markReviewed,
      approveForMarketing,
      keepPrivate,
      featureSubmission,
      archiveSubmission,
      addInternalNote,
      setMarketingTags,
      createIncentive,
      updateIncentive,
      setIncentiveStatus,
      deliverRedemption,
    }),
    [
      state,
      setAutomationSettings,
      createRequest,
      updateRequest,
      setRequestStatus,
      saveDraft,
      submitFeedback,
      grantMarketingConsent,
      withdrawConsent,
      getConsentForFeedback,
      markReviewed,
      approveForMarketing,
      keepPrivate,
      featureSubmission,
      archiveSubmission,
      addInternalNote,
      setMarketingTags,
      createIncentive,
      updateIncentive,
      setIncentiveStatus,
      deliverRedemption,
    ],
  );

  return <FeedbackStoreContext.Provider value={value}>{children}</FeedbackStoreContext.Provider>;
}

export function useFeedbackStore() {
  const ctx = useContext(FeedbackStoreContext);
  if (!ctx) throw new Error("useFeedbackStore must be used within a FeedbackStoreProvider");
  return ctx;
}
