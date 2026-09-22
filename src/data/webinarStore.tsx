import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  ConvertLeadToStudentInput,
  FollowUp,
  FollowUpOutcome,
  FollowUpStatus,
  Lead,
  LeadStatus,
  Reservation,
  WebinarConsent,
  WebinarRegistration,
  WebinarRegistrationSubmission,
  WebinarSession,
} from "@/types/webinar";
import { WEBINAR_CONSENT_VERSION } from "@/types/webinar";
import {
  DEMO_FOLLOW_UPS,
  DEMO_LEADS,
  DEMO_WEBINAR_REGISTRATIONS,
  DEMO_WEBINAR_SESSIONS,
  CURRENT_DEMO_USER,
} from "@/data/webinarConfig";
import {
  findDuplicateMatch,
  generateFollowUpId,
  generateLeadId,
  generateRegistrationId,
  generateWebinarSessionId,
  isAttendedStatus,
} from "@/utils/webinar";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { dispatchGhlEvent } from "@/integrations/ghlEvents";
import type { StudentRecord } from "@/types/student";
import type { RegistrationAttendanceStatus } from "@/types/webinar";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Sessions, leads, registrations, and follow-ups live in React state
// mirrored to this browser's localStorage only. Not a real database, no
// real GHL sync, no real SMS/email sending — see src/types/webinar.ts.
//
// CORE RULE: registerForWebinar() never creates a new Lead for a person who
// already has one — see findDuplicateMatch() in src/utils/webinar.ts. A
// Lead only ever becomes a StudentRecord through convertLeadToStudent(),
// which delegates to studentStore.createStudentFromLead() rather than
// building a second, parallel "person" concept.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_webinar_v1";

interface WebinarState {
  sessions: WebinarSession[];
  leads: Lead[];
  registrations: WebinarRegistration[];
  followUps: FollowUp[];
}

function loadInitialState(): WebinarState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WebinarState;
      if (parsed && Array.isArray(parsed.sessions)) {
        return {
          sessions: parsed.sessions,
          leads: parsed.leads ?? [],
          registrations: parsed.registrations ?? [],
          followUps: parsed.followUps ?? [],
        };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  // Persist immediately — one seed lead resolves studentId against
  // DEMO_STUDENTS at this exact module load, same freeze-on-load-#1
  // requirement as every other Step 8/9/10 store.
  const seeded: WebinarState = {
    sessions: DEMO_WEBINAR_SESSIONS,
    leads: DEMO_LEADS,
    registrations: DEMO_WEBINAR_REGISTRATIONS,
    followUps: DEMO_FOLLOW_UPS,
  };
  persist(seeded);
  return seeded;
}

function persist(state: WebinarState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowIso() {
  return new Date().toISOString();
}

function nowParts() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    date: d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
  };
}

export interface CreateWebinarSessionInput {
  title: string;
  type: WebinarSession["type"];
  date: string;
  startTime: string;
  endTime: string;
  platform: WebinarSession["platform"];
  meetingLink: string;
  meetingId: string;
  passcode: string;
  host: string;
  capacity: number | null;
  registrationOpenDate: string | null;
  registrationCloseDate: string | null;
  notes: string;
}

export interface RecordReservationInput {
  amount: number;
  method: Reservation["method"];
  referenceNumber: string;
  date: string;
  proof: Reservation["proof"];
}

export interface CreateFollowUpInput {
  leadId: string;
  assignedStaffId: string;
  assignedStaffName: string;
  channel: FollowUp["channel"];
  date: string;
  time: string;
  notes: string;
}

export interface UpdateFollowUpResultInput {
  status: FollowUpStatus;
  outcome: FollowUpOutcome | null;
  notes?: string;
  nextFollowUpDate?: string | null;
}

export interface RegisterForWebinarResult {
  lead: Lead;
  registration: WebinarRegistration;
  isNewLead: boolean;
  isNewRegistration: boolean;
}

interface WebinarStoreValue {
  sessions: WebinarSession[];
  leads: Lead[];
  registrations: WebinarRegistration[];
  followUps: FollowUp[];

  createSession: (input: CreateWebinarSessionInput) => WebinarSession;
  updateSession: (sessionId: string, patch: Partial<CreateWebinarSessionInput>) => void;
  setSessionStatus: (sessionId: string, status: WebinarSession["status"]) => void;

  registerForWebinar: (submission: WebinarRegistrationSubmission) => RegisterForWebinarResult;
  recordAttendance: (registrationId: string, status: RegistrationAttendanceStatus, recordedBy: string, notes?: string) => void;

  setLeadStatus: (leadId: string, status: LeadStatus) => void;
  assignLead: (leadId: string, staffId: string, staffName: string) => void;
  addLeadNote: (leadId: string, text: string) => void;
  setNextFollowUpDate: (leadId: string, date: string | null) => void;

  createFollowUp: (input: CreateFollowUpInput) => FollowUp;
  updateFollowUpResult: (followUpId: string, input: UpdateFollowUpResultInput) => void;

  recordReservation: (leadId: string, input: RecordReservationInput) => void;
  verifyReservation: (leadId: string) => void;
  rejectReservation: (leadId: string) => void;

  convertLeadToStudent: (leadId: string, input: ConvertLeadToStudentInput) => StudentRecord;

  /** Exposed so other stores (e.g. feedbackStore, for a webinar lead's feedback events) can log to this lead's Activity History without needing webinarStore's internals. */
  logLeadActivity: (leadId: string, action: string) => void;
}

const WebinarStoreContext = createContext<WebinarStoreValue | undefined>(undefined);

export function WebinarStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WebinarState>(() => loadInitialState());
  const { students, appendActivity, createStudentFromLead } = useStudentStore();
  const { recordPayment, verifyPayment } = useFinanceStore();

  const updateState = useCallback((updater: (prev: WebinarState) => WebinarState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const appendLeadActivity = useCallback(
    (leadId: string, action: string) => {
      const { date, time } = nowParts();
      updateState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId ? { ...l, activity: [...l.activity, { id: crypto.randomUUID(), action, date, time, user: CURRENT_DEMO_USER }] } : l,
        ),
      }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Webinar Sessions
  // -------------------------------------------------------------------
  const createSession = useCallback(
    (input: CreateWebinarSessionInput): WebinarSession => {
      let created!: WebinarSession;
      updateState((prev) => {
        created = { ...input, id: crypto.randomUUID(), sessionId: generateWebinarSessionId(prev.sessions), status: "Draft", createdBy: CURRENT_DEMO_USER, createdAt: nowIso() };
        return { ...prev, sessions: [created, ...prev.sessions] };
      });
      return created;
    },
    [updateState],
  );

  const updateSession = useCallback(
    (sessionId: string, patch: Partial<CreateWebinarSessionInput>) => {
      updateState((prev) => ({ ...prev, sessions: prev.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)) }));
    },
    [updateState],
  );

  const setSessionStatus = useCallback(
    (sessionId: string, status: WebinarSession["status"]) => {
      updateState((prev) => ({ ...prev, sessions: prev.sessions.map((s) => (s.id === sessionId ? { ...s, status } : s)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Registration — duplicate-safe, one Lead per person (spec 10-13)
  // -------------------------------------------------------------------
  const registerForWebinar = useCallback(
    (submission: WebinarRegistrationSubmission): RegisterForWebinarResult => {
      const iso = nowIso();
      const consent: WebinarConsent = {
        registrationCommsConsent: submission.registrationCommsConsent,
        marketingConsent: submission.marketingConsent,
        consentVersion: WEBINAR_CONSENT_VERSION,
        consentDate: iso,
      };

      let resultLead!: Lead;
      let resultRegistration!: WebinarRegistration;
      let isNewLead = false;
      let isNewRegistration = false;

      updateState((prev) => {
        const match = findDuplicateMatch({ email: submission.email, contactNumber: submission.contactNumber }, prev.leads, students);

        let leads = prev.leads;
        let lead: Lead;

        if (match.matchedLead) {
          lead = {
            ...match.matchedLead,
            fullName: submission.fullName,
            facebookName: submission.facebookName,
            city: submission.city,
            businessName: submission.businessName,
            businessStatus: submission.businessStatus,
            businessChallenge: submission.businessChallenge,
            sellingCurrently: submission.sellingCurrently,
            importationExperience: submission.importationExperience,
            timeline: submission.timeline,
            latestWebinarSessionId: submission.webinarSessionId,
            updatedAt: iso,
          };
          leads = prev.leads.map((l) => (l.id === lead.id ? lead : l));
        } else {
          isNewLead = true;
          lead = {
            id: crypto.randomUUID(),
            leadId: generateLeadId(prev.leads),
            fullName: submission.fullName,
            facebookName: submission.facebookName,
            email: submission.email,
            contactNumber: submission.contactNumber,
            city: submission.city,
            businessName: submission.businessName,
            businessStatus: submission.businessStatus,
            businessChallenge: submission.businessChallenge,
            sellingCurrently: submission.sellingCurrently,
            importationExperience: submission.importationExperience,
            timeline: submission.timeline,
            firstRegistrationDate: iso,
            latestWebinarSessionId: submission.webinarSessionId,
            leadSource: submission.leadSource,
            campaign: submission.campaign,
            utm: submission.utm,
            status: "Not Contacted",
            assignedStaffId: null,
            assignedStaffName: null,
            nextFollowUpDate: null,
            reservation: null,
            notes: [],
            pipelineHistory: [{ id: crypto.randomUUID(), fromStatus: null, toStatus: "Not Contacted", changedBy: "System", changedAt: iso }],
            activity: [{ id: crypto.randomUUID(), action: "Lead created from webinar registration", date: nowParts().date, time: nowParts().time, user: "System" }],
            linkedStudentId: match.matchedStudent?.id ?? null,
            convertedToStudentId: null,
            convertedAt: null,
            createdAt: iso,
            updatedAt: iso,
          };
          leads = [lead, ...prev.leads];
        }

        const existingRegistration = prev.registrations.find((r) => r.leadId === lead.id && r.webinarSessionId === submission.webinarSessionId);
        let registrations = prev.registrations;
        let registration: WebinarRegistration;
        if (existingRegistration) {
          registration = existingRegistration;
        } else {
          isNewRegistration = true;
          registration = {
            id: crypto.randomUUID(),
            registrationId: generateRegistrationId(prev.registrations),
            leadId: lead.id,
            webinarSessionId: submission.webinarSessionId,
            registrationDate: iso,
            leadSource: submission.leadSource,
            campaign: submission.campaign,
            utm: submission.utm,
            consent,
            attendanceStatus: "Registered",
            checkInTime: null,
            checkOutTime: null,
            attendanceRecordedBy: null,
            attendanceNotes: "",
            registeredAsExistingStudent: Boolean(match.matchedStudent),
            createdAt: iso,
          };
          registrations = [registration, ...prev.registrations];
        }

        resultLead = lead;
        resultRegistration = registration;
        return { ...prev, leads, registrations };
      });

      if (isNewRegistration) {
        const session = state.sessions.find((s) => s.id === submission.webinarSessionId);
        appendLeadActivity(resultLead.id, isNewLead ? "Lead created from webinar registration" : `Registered for another webinar: ${session?.title ?? ""}`);
        if (isNewLead) {
          dispatchGhlEvent({ type: "lead.created", occurredAt: iso, leadId: resultLead.leadId, summary: `New lead: ${resultLead.fullName}` });
        }
        dispatchGhlEvent({
          type: "lead.webinar_registered",
          occurredAt: iso,
          leadId: resultLead.leadId,
          summary: `${resultLead.fullName} registered for ${session?.title ?? "a webinar"}`,
        });
      }

      return { lead: resultLead, registration: resultRegistration, isNewLead, isNewRegistration };
    },
    [updateState, students, appendLeadActivity, state.sessions],
  );

  const recordAttendance = useCallback(
    (registrationId: string, status: RegistrationAttendanceStatus, recordedBy: string, notes?: string) => {
      const iso = nowIso();
      const registration = state.registrations.find((r) => r.id === registrationId);
      if (!registration) return;

      updateState((prev) => ({
        ...prev,
        registrations: prev.registrations.map((r) =>
          r.id === registrationId
            ? {
                ...r,
                attendanceStatus: status,
                checkInTime: isAttendedStatus(status) ? (r.checkInTime ?? iso) : r.checkInTime,
                attendanceRecordedBy: recordedBy,
                attendanceNotes: notes ?? r.attendanceNotes,
              }
            : r,
        ),
      }));

      const lead = state.leads.find((l) => l.id === registration.leadId);
      if (lead) {
        appendLeadActivity(lead.id, `Attendance recorded: ${status}`);
        if (lead.status === "Not Contacted") {
          setLeadStatusInternal(lead.id, "Follow-up Needed", "System");
        }
        dispatchGhlEvent({
          type: isAttendedStatus(status) ? "lead.webinar_attended" : status === "No Show" ? "lead.webinar_no_show" : "lead.webinar_attended",
          occurredAt: iso,
          leadId: lead.leadId,
          summary: `${lead.fullName} — ${status}`,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.registrations, state.leads, updateState, appendLeadActivity],
  );

  // -------------------------------------------------------------------
  // Pipeline
  // -------------------------------------------------------------------
  const setLeadStatusInternal = useCallback(
    (leadId: string, status: LeadStatus, changedBy: string) => {
      const iso = nowIso();
      const lead = state.leads.find((l) => l.id === leadId);
      if (!lead || lead.status === status) return;

      updateState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                status,
                updatedAt: iso,
                pipelineHistory: [...l.pipelineHistory, { id: crypto.randomUUID(), fromStatus: l.status, toStatus: status, changedBy, changedAt: iso }],
              }
            : l,
        ),
      }));
      appendLeadActivity(leadId, `Pipeline stage changed: ${lead.status} → ${status}`);

      const eventMap: Partial<Record<LeadStatus, Parameters<typeof dispatchGhlEvent>[0]["type"]>> = {
        "Follow-up Needed": "lead.follow_up_needed",
        Interested: "lead.interested",
        Considering: "lead.considering",
        "Reservation Paid": "lead.reservation_paid",
        Enrolled: "lead.enrolled",
      };
      const eventType = eventMap[status];
      if (eventType) {
        dispatchGhlEvent({ type: eventType, occurredAt: iso, leadId: lead.leadId, summary: `${lead.fullName} — ${status}` });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.leads, updateState, appendLeadActivity],
  );

  const setLeadStatus = useCallback(
    (leadId: string, status: LeadStatus) => setLeadStatusInternal(leadId, status, CURRENT_DEMO_USER),
    [setLeadStatusInternal],
  );

  const assignLead = useCallback(
    (leadId: string, staffId: string, staffName: string) => {
      updateState((prev) => ({ ...prev, leads: prev.leads.map((l) => (l.id === leadId ? { ...l, assignedStaffId: staffId, assignedStaffName: staffName } : l)) }));
      appendLeadActivity(leadId, `Assigned to ${staffName}`);
    },
    [updateState, appendLeadActivity],
  );

  const addLeadNote = useCallback(
    (leadId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const iso = nowIso();
      updateState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId ? { ...l, notes: [{ id: crypto.randomUUID(), text: trimmed, author: CURRENT_DEMO_USER, timestamp: iso }, ...l.notes] } : l,
        ),
      }));
    },
    [updateState],
  );

  const setNextFollowUpDate = useCallback(
    (leadId: string, date: string | null) => {
      updateState((prev) => ({ ...prev, leads: prev.leads.map((l) => (l.id === leadId ? { ...l, nextFollowUpDate: date } : l)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Follow-ups
  // -------------------------------------------------------------------
  const createFollowUp = useCallback(
    (input: CreateFollowUpInput): FollowUp => {
      let created!: FollowUp;
      updateState((prev) => {
        created = {
          id: crypto.randomUUID(),
          followUpId: generateFollowUpId(prev.followUps),
          leadId: input.leadId,
          assignedStaffId: input.assignedStaffId,
          assignedStaffName: input.assignedStaffName,
          channel: input.channel,
          date: input.date,
          time: input.time,
          status: "To Do",
          outcome: null,
          notes: input.notes,
          nextFollowUpDate: null,
          createdBy: CURRENT_DEMO_USER,
          createdAt: nowIso(),
          completedAt: null,
        };
        return { ...prev, followUps: [created, ...prev.followUps] };
      });
      setNextFollowUpDate(input.leadId, input.date);
      appendLeadActivity(input.leadId, `Follow-up scheduled: ${input.channel} on ${input.date}`);
      const lead = state.leads.find((l) => l.id === input.leadId);
      if (lead?.status === "Not Contacted") setLeadStatusInternal(input.leadId, "Follow-up Needed", CURRENT_DEMO_USER);
      return created;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateState, setNextFollowUpDate, appendLeadActivity, state.leads, setLeadStatusInternal],
  );

  const updateFollowUpResult = useCallback(
    (followUpId: string, input: UpdateFollowUpResultInput) => {
      const followUp = state.followUps.find((f) => f.id === followUpId);
      if (!followUp) return;
      const iso = nowIso();

      updateState((prev) => ({
        ...prev,
        followUps: prev.followUps.map((f) =>
          f.id === followUpId
            ? {
                ...f,
                status: input.status,
                outcome: input.outcome,
                notes: input.notes ?? f.notes,
                nextFollowUpDate: input.nextFollowUpDate ?? null,
                completedAt: input.status === "Completed" ? iso : f.completedAt,
              }
            : f,
        ),
      }));

      appendLeadActivity(followUp.leadId, `Follow-up ${input.status.toLowerCase()}${input.outcome ? ` — ${input.outcome}` : ""}`);

      if (input.nextFollowUpDate) setNextFollowUpDate(followUp.leadId, input.nextFollowUpDate);
      else if (input.status !== "To Do" && input.status !== "Rescheduled") setNextFollowUpDate(followUp.leadId, null);

      const outcomeStageMap: Partial<Record<FollowUpOutcome, LeadStatus>> = {
        Interested: "Interested",
        Considering: "Considering",
        "Reservation Paid": "Reservation Paid",
        Enrolled: "Enrolled",
        "Not Interested": "Not Interested",
      };
      if (input.outcome && outcomeStageMap[input.outcome]) {
        setLeadStatusInternal(followUp.leadId, outcomeStageMap[input.outcome]!, CURRENT_DEMO_USER);
      } else if (input.outcome === "No Response") {
        setLeadStatusInternal(followUp.leadId, "No Response", CURRENT_DEMO_USER);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.followUps, updateState, appendLeadActivity, setNextFollowUpDate, setLeadStatusInternal],
  );

  // -------------------------------------------------------------------
  // Reservation — pre-conversion only; becomes a real PaymentTransaction
  // at convertLeadToStudent() time, never a disconnected ledger (spec 32).
  // -------------------------------------------------------------------
  const recordReservation = useCallback(
    (leadId: string, input: RecordReservationInput) => {
      const iso = nowIso();
      const reservation: Reservation = {
        id: crypto.randomUUID(),
        amount: input.amount,
        method: input.method,
        referenceNumber: input.referenceNumber,
        date: input.date,
        proof: input.proof,
        verificationStatus: "Pending Verification",
        recordedBy: CURRENT_DEMO_USER,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: iso,
        linkedTransactionId: null,
      };
      updateState((prev) => ({ ...prev, leads: prev.leads.map((l) => (l.id === leadId ? { ...l, reservation } : l)) }));
      appendLeadActivity(leadId, `Reservation recorded: ${input.amount} via ${input.method}`);
      setLeadStatusInternal(leadId, "Reservation Paid", CURRENT_DEMO_USER);
    },
    [updateState, appendLeadActivity, setLeadStatusInternal],
  );

  const verifyReservation = useCallback(
    (leadId: string) => {
      const iso = nowIso();
      updateState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId && l.reservation
            ? { ...l, reservation: { ...l.reservation, verificationStatus: "Verified", verifiedBy: CURRENT_DEMO_USER, verifiedAt: iso } }
            : l,
        ),
      }));
      appendLeadActivity(leadId, "Reservation verified");
      const lead = state.leads.find((l) => l.id === leadId);
      if (lead) {
        dispatchGhlEvent({ type: "lead.reservation_verified", occurredAt: iso, leadId: lead.leadId, summary: `${lead.fullName}'s reservation payment verified` });
      }
    },
    [updateState, appendLeadActivity, state.leads],
  );

  const rejectReservation = useCallback(
    (leadId: string) => {
      updateState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => (l.id === leadId && l.reservation ? { ...l, reservation: { ...l.reservation, verificationStatus: "Rejected" } } : l)),
      }));
      appendLeadActivity(leadId, "Reservation rejected");
    },
    [updateState, appendLeadActivity],
  );

  // -------------------------------------------------------------------
  // Convert Lead to Student — THE critical boundary (spec 33-35)
  // -------------------------------------------------------------------
  const convertLeadToStudent = useCallback(
    (leadId: string, input: ConvertLeadToStudentInput): StudentRecord => {
      const lead = state.leads.find((l) => l.id === leadId);
      if (!lead) throw new Error("Lead not found");
      if (lead.convertedToStudentId) throw new Error("Lead already converted");

      const newStudent = createStudentFromLead({
        leadId: lead.leadId,
        facebookName: lead.facebookName,
        fullName: lead.fullName,
        companionName: input.companionName,
        email: lead.email,
        contactNumber: lead.contactNumber,
        city: lead.city,
        batch: input.batch,
        package: input.package,
        attendance: input.attendance,
        enrollmentDate: input.enrollmentDate,
      });

      let linkedTransactionId: string | null = null;
      if (lead.reservation) {
        const transaction = recordPayment({
          student: newStudent,
          amount: lead.reservation.amount,
          type: "Reservation",
          method: lead.reservation.method,
          referenceNumber: lead.reservation.referenceNumber,
          date: lead.reservation.date,
          proof: lead.reservation.proof,
          notes: `Reservation carried over from Free Webinar Lead ${lead.leadId}.`,
          recordedBy: CURRENT_DEMO_USER,
        });
        linkedTransactionId = transaction.id;
        if (lead.reservation.verificationStatus === "Verified") {
          verifyPayment(transaction.id);
        }
      }

      const iso = nowIso();
      updateState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                status: "Enrolled",
                convertedToStudentId: newStudent.id,
                convertedAt: iso,
                updatedAt: iso,
                reservation: l.reservation && linkedTransactionId ? { ...l.reservation, linkedTransactionId } : l.reservation,
                pipelineHistory: [...l.pipelineHistory, { id: crypto.randomUUID(), fromStatus: l.status, toStatus: "Enrolled", changedBy: CURRENT_DEMO_USER, changedAt: iso }],
              }
            : l,
        ),
      }));
      appendLeadActivity(leadId, `Converted to Student — ${newStudent.studentId}`);
      appendActivity(newStudent.id, `Converted from Free Webinar Lead ${lead.leadId} (source: ${lead.leadSource})`);
      dispatchGhlEvent({ type: "lead.converted_to_student", occurredAt: iso, leadId: lead.leadId, studentId: newStudent.id, studentDisplayId: newStudent.studentId, summary: `${lead.fullName} converted to student ${newStudent.studentId}` });

      return newStudent;
    },
    [state.leads, createStudentFromLead, recordPayment, verifyPayment, updateState, appendLeadActivity, appendActivity],
  );

  const value = useMemo<WebinarStoreValue>(
    () => ({
      sessions: state.sessions,
      leads: state.leads,
      registrations: state.registrations,
      followUps: state.followUps,
      createSession,
      updateSession,
      setSessionStatus,
      registerForWebinar,
      recordAttendance,
      setLeadStatus,
      assignLead,
      addLeadNote,
      setNextFollowUpDate,
      createFollowUp,
      updateFollowUpResult,
      recordReservation,
      verifyReservation,
      rejectReservation,
      convertLeadToStudent,
      logLeadActivity: appendLeadActivity,
    }),
    [
      state,
      createSession,
      updateSession,
      setSessionStatus,
      registerForWebinar,
      recordAttendance,
      setLeadStatus,
      assignLead,
      addLeadNote,
      setNextFollowUpDate,
      createFollowUp,
      updateFollowUpResult,
      recordReservation,
      verifyReservation,
      rejectReservation,
      convertLeadToStudent,
      appendLeadActivity,
    ],
  );

  return <WebinarStoreContext.Provider value={value}>{children}</WebinarStoreContext.Provider>;
}

export function useWebinarStore() {
  const ctx = useContext(WebinarStoreContext);
  if (!ctx) throw new Error("useWebinarStore must be used within a WebinarStoreProvider");
  return ctx;
}
