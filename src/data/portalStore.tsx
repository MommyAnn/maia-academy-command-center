import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  Announcement,
  AnnouncementAudienceType,
  MasterBrainProgress,
  PortalAccessRecord,
  SupportCategory,
  SupportRequest,
  SupportStatus,
  UpdateRequest,
  UpdateRequestStatus,
} from "@/types/portal";
import { DEMO_ANNOUNCEMENTS } from "@/data/portalConfig";
import { generateSupportId, generateUpdateRequestId } from "@/utils/portal";
import { useStudentStore } from "@/data/studentStore";
import { dispatchGhlEvent } from "@/integrations/ghlEvents";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: announcements, support
// requests, update requests, portal access flags, and course grants live in
// React state and are mirrored to this browser's localStorage only. This is
// NOT a real backend:
//   - Not shared across devices, browsers, or real users.
//   - Not encrypted, backed up, or access-controlled.
//   - "Portal Activated" here is a demo flag this store enforces at login
//     time (Login.tsx checks it) — it is not a real account-provisioning
//     system, and no real password/reset email is ever sent.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_portal_v1";

interface PortalState {
  announcements: Announcement[];
  supportRequests: SupportRequest[];
  updateRequests: UpdateRequest[];
  portalAccess: PortalAccessRecord[];
  masterBrainProgress: MasterBrainProgress[];
}

function loadInitialState(): PortalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PortalState;
      if (parsed && Array.isArray(parsed.announcements)) {
        return {
          announcements: parsed.announcements,
          supportRequests: parsed.supportRequests ?? [],
          updateRequests: parsed.updateRequests ?? [],
          portalAccess: parsed.portalAccess ?? [],
          masterBrainProgress: parsed.masterBrainProgress ?? [],
        };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  return {
    announcements: DEMO_ANNOUNCEMENTS,
    supportRequests: [],
    updateRequests: [],
    portalAccess: [],
    masterBrainProgress: [],
  };
}

function persist(state: PortalState) {
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

const CURRENT_DEMO_USER = "Mommy Ann";

/** Profile-only fields we know how to apply directly onto StudentRecord once an update request is approved. Enrollment-level fields (Batch, Package, Attendance, Companion info) are intentionally NOT auto-applied — approving those just records the decision, since changing them has cascading effects (finance, training rosters) an Admin should still action directly. */
const AUTO_APPLIABLE_FIELDS = new Set(["Facebook Name", "Email", "Contact Number", "City"]);

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  audienceType: AnnouncementAudienceType;
  audienceValue: string | null;
  important: boolean;
  attachmentLabel: string;
  attachmentUrl: string;
}

export interface CreateSupportRequestInput {
  studentId: string;
  category: SupportCategory;
  subject: string;
  message: string;
}

export interface CreateUpdateRequestInput {
  studentId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

interface PortalStoreValue {
  announcements: Announcement[];
  supportRequests: SupportRequest[];
  updateRequests: UpdateRequest[];
  portalAccess: PortalAccessRecord[];
  masterBrainProgress: MasterBrainProgress[];
  getPortalAccess: (studentId: string) => PortalAccessRecord;
  createAnnouncement: (input: CreateAnnouncementInput) => Announcement;
  togglePinAnnouncement: (id: string) => void;
  toggleImportantAnnouncement: (id: string) => void;
  createSupportRequest: (input: CreateSupportRequestInput) => SupportRequest;
  updateSupportRequestStatus: (id: string, status: SupportStatus) => void;
  createUpdateRequest: (input: CreateUpdateRequestInput) => UpdateRequest;
  reviewUpdateRequest: (id: string, status: UpdateRequestStatus, reviewNotes: string) => void;
  activatePortalAccess: (studentId: string) => void;
  deactivatePortalAccess: (studentId: string) => void;
  sendAccessInstructions: (studentId: string) => void;
  resetAccess: (studentId: string) => void;
  recordLogin: (studentId: string) => void;
  saveMasterBrainProgress: (studentId: string, patch: { progressPercent?: number; businessBrand?: string }) => void;
}

const PortalStoreContext = createContext<PortalStoreValue | undefined>(undefined);

const DEFAULT_ACCESS: Omit<PortalAccessRecord, "studentId"> = {
  activated: true,
  accessCreatedDate: null,
  lastLogin: null,
  instructionsSentAt: null,
};

export function PortalStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalState>(() => loadInitialState());
  const { students, appendActivity, applyProfileFieldUpdate } = useStudentStore();

  const updateState = useCallback((updater: (prev: PortalState) => PortalState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const getPortalAccess = useCallback(
    (studentId: string): PortalAccessRecord => {
      const found = state.portalAccess.find((p) => p.studentId === studentId);
      if (found) return found;
      const student = students.find((s) => s.id === studentId);
      return {
        studentId,
        ...DEFAULT_ACCESS,
        accessCreatedDate: student ? student.enrollmentDate.slice(0, 10) : null,
      };
    },
    [state.portalAccess, students],
  );

  const updateAccessRecord = useCallback(
    (studentId: string, patch: Partial<PortalAccessRecord>) => {
      updateState((prev) => {
        const existing = prev.portalAccess.find((p) => p.studentId === studentId);
        if (existing) {
          return {
            ...prev,
            portalAccess: prev.portalAccess.map((p) => (p.studentId === studentId ? { ...p, ...patch } : p)),
          };
        }
        const student = students.find((s) => s.id === studentId);
        const created: PortalAccessRecord = {
          studentId,
          ...DEFAULT_ACCESS,
          accessCreatedDate: student ? student.enrollmentDate.slice(0, 10) : null,
          ...patch,
        };
        return { ...prev, portalAccess: [...prev.portalAccess, created] };
      });
    },
    [updateState, students],
  );

  const createAnnouncement = useCallback(
    (input: CreateAnnouncementInput): Announcement => {
      const { iso, date } = nowParts();
      let created!: Announcement;
      updateState((prev) => {
        created = {
          id: crypto.randomUUID(),
          title: input.title,
          message: input.message,
          audienceType: input.audienceType,
          audienceValue: input.audienceValue,
          pinned: false,
          important: input.important,
          attachmentLabel: input.attachmentLabel,
          attachmentUrl: input.attachmentUrl,
          createdBy: CURRENT_DEMO_USER,
          createdAt: iso,
          date,
        };
        return { ...prev, announcements: [created, ...prev.announcements] };
      });
      return created;
    },
    [updateState],
  );

  const togglePinAnnouncement = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        announcements: prev.announcements.map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a)),
      }));
    },
    [updateState],
  );

  const toggleImportantAnnouncement = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        announcements: prev.announcements.map((a) => (a.id === id ? { ...a, important: !a.important } : a)),
      }));
    },
    [updateState],
  );

  const createSupportRequest = useCallback(
    (input: CreateSupportRequestInput): SupportRequest => {
      const { iso } = nowParts();
      let created!: SupportRequest;
      updateState((prev) => {
        created = {
          id: crypto.randomUUID(),
          supportId: generateSupportId(prev.supportRequests),
          studentId: input.studentId,
          category: input.category,
          subject: input.subject,
          message: input.message,
          status: "Open",
          assignedStaffId: null,
          createdAt: iso,
          updatedAt: iso,
        };
        return { ...prev, supportRequests: [created, ...prev.supportRequests] };
      });
      appendActivity(input.studentId, `Support request created: ${created.supportId} (${input.category})`);
      return created;
    },
    [updateState, appendActivity],
  );

  const updateSupportRequestStatus = useCallback(
    (id: string, status: SupportStatus) => {
      const { iso } = nowParts();
      updateState((prev) => ({
        ...prev,
        supportRequests: prev.supportRequests.map((r) => (r.id === id ? { ...r, status, updatedAt: iso } : r)),
      }));
    },
    [updateState],
  );

  const createUpdateRequest = useCallback(
    (input: CreateUpdateRequestInput): UpdateRequest => {
      const { iso } = nowParts();
      let created!: UpdateRequest;
      updateState((prev) => {
        created = {
          id: crypto.randomUUID(),
          requestId: generateUpdateRequestId(prev.updateRequests),
          studentId: input.studentId,
          field: input.field,
          oldValue: input.oldValue,
          newValue: input.newValue,
          reason: input.reason,
          status: "Pending",
          createdAt: iso,
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: "",
        };
        return { ...prev, updateRequests: [created, ...prev.updateRequests] };
      });
      appendActivity(input.studentId, `Update request submitted: ${input.field} (${created.requestId})`);
      return created;
    },
    [updateState, appendActivity],
  );

  const reviewUpdateRequest = useCallback(
    (id: string, status: UpdateRequestStatus, reviewNotes: string) => {
      const { iso } = nowParts();
      let target: UpdateRequest | undefined;
      updateState((prev) => ({
        ...prev,
        updateRequests: prev.updateRequests.map((r) => {
          if (r.id !== id) return r;
          target = r;
          return { ...r, status, reviewedBy: CURRENT_DEMO_USER, reviewedAt: iso, reviewNotes };
        }),
      }));
      if (target) {
        if (status === "Approved" && AUTO_APPLIABLE_FIELDS.has(target.field)) {
          applyProfileFieldUpdate(target.studentId, target.field, target.newValue);
        }
        appendActivity(
          target.studentId,
          `Update request ${status.toLowerCase()}: ${target.field} (${target.requestId})${status === "Approved" && !AUTO_APPLIABLE_FIELDS.has(target.field) ? " — Admin will apply this manually" : ""}`,
        );
      }
    },
    [updateState, appendActivity, applyProfileFieldUpdate],
  );

  const activatePortalAccess = useCallback(
    (studentId: string) => {
      const { iso, date } = nowParts();
      updateAccessRecord(studentId, { activated: true, accessCreatedDate: date });
      appendActivity(studentId, "Portal access activated");
      dispatchGhlEvent({
        type: "portal.activated",
        occurredAt: iso,
        studentId,
        summary: "Student Portal access activated",
      });
    },
    [updateAccessRecord, appendActivity],
  );

  const deactivatePortalAccess = useCallback(
    (studentId: string) => {
      updateAccessRecord(studentId, { activated: false });
      appendActivity(studentId, "Portal access deactivated");
    },
    [updateAccessRecord, appendActivity],
  );

  const sendAccessInstructions = useCallback(
    (studentId: string) => {
      const { iso } = nowParts();
      updateAccessRecord(studentId, { instructionsSentAt: iso });
      appendActivity(studentId, "Portal access instructions sent");
    },
    [updateAccessRecord, appendActivity],
  );

  const resetAccess = useCallback(
    (studentId: string) => {
      appendActivity(studentId, "Portal access reset requested — no real password exists to reset in this demo");
    },
    [appendActivity],
  );

  const recordLogin = useCallback(
    (studentId: string) => {
      const { iso } = nowParts();
      updateAccessRecord(studentId, { lastLogin: iso });
      appendActivity(studentId, "Logged into Student Portal");
    },
    [updateAccessRecord, appendActivity],
  );

  const saveMasterBrainProgress = useCallback(
    (studentId: string, patch: { progressPercent?: number; businessBrand?: string }) => {
      const { iso } = nowParts();
      updateState((prev) => {
        const existing = prev.masterBrainProgress.find((p) => p.studentId === studentId);
        if (existing) {
          return {
            ...prev,
            masterBrainProgress: prev.masterBrainProgress.map((p) =>
              p.studentId === studentId ? { ...p, ...patch, lastSaved: iso } : p,
            ),
          };
        }
        const created: MasterBrainProgress = {
          studentId,
          submissionId: crypto.randomUUID(),
          businessBrand: patch.businessBrand ?? "",
          questionnaireVersion: "v1.0",
          progressPercent: patch.progressPercent ?? 0,
          lastSaved: iso,
        };
        return { ...prev, masterBrainProgress: [...prev.masterBrainProgress, created] };
      });
      appendActivity(studentId, "Master Brain progress saved");
    },
    [updateState, appendActivity],
  );

  const value = useMemo<PortalStoreValue>(
    () => ({
      announcements: state.announcements,
      supportRequests: state.supportRequests,
      updateRequests: state.updateRequests,
      portalAccess: state.portalAccess,
      masterBrainProgress: state.masterBrainProgress,
      getPortalAccess,
      createAnnouncement,
      togglePinAnnouncement,
      toggleImportantAnnouncement,
      createSupportRequest,
      updateSupportRequestStatus,
      createUpdateRequest,
      reviewUpdateRequest,
      activatePortalAccess,
      deactivatePortalAccess,
      sendAccessInstructions,
      resetAccess,
      recordLogin,
      saveMasterBrainProgress,
    }),
    [
      state,
      getPortalAccess,
      createAnnouncement,
      togglePinAnnouncement,
      toggleImportantAnnouncement,
      createSupportRequest,
      updateSupportRequestStatus,
      createUpdateRequest,
      reviewUpdateRequest,
      activatePortalAccess,
      deactivatePortalAccess,
      sendAccessInstructions,
      resetAccess,
      recordLogin,
      saveMasterBrainProgress,
    ],
  );

  return <PortalStoreContext.Provider value={value}>{children}</PortalStoreContext.Provider>;
}

export function usePortalStore() {
  const ctx = useContext(PortalStoreContext);
  if (!ctx) throw new Error("usePortalStore must be used within a PortalStoreProvider");
  return ctx;
}
