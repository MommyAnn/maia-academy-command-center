import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AutomationRule,
  AutomationRuleStatus,
  CommunicationLog,
  CommunicationLogStatus,
  CommunicationPreference,
  CreateAutomationRuleInput,
  CreateMessageTemplateInput,
  FieldMappingEntry,
  GhlContactSync,
  IntegrationSettings,
  MessageTemplate,
  MessageTemplateStatus,
  PersonType,
  SendManualMessageInput,
  SyncLog,
  TagMappingEntry,
  WebhookLogEntry,
  WorkflowMappingEntry,
} from "@/types/communications";
import { GHL_INTEGRATED_CHANNELS } from "@/types/communications";
import {
  DEFAULT_FIELD_MAPPINGS,
  DEFAULT_INTEGRATION_SETTINGS,
  DEFAULT_TAG_MAPPINGS,
  DEFAULT_WORKFLOW_MAPPINGS,
  DEMO_AUTOMATION_RULES,
  DEMO_COMMUNICATION_LOGS,
  DEMO_COMMUNICATION_PREFERENCES,
  DEMO_GHL_CONTACT_SYNCS,
  DEMO_MESSAGE_TEMPLATES,
  DEMO_SYNC_LOGS,
  DEMO_WEBHOOK_LOG,
  CURRENT_DEMO_USER,
} from "@/data/communicationsConfig";
import {
  buildAutomationIdempotencyKey,
  checkChannelEligibility,
  extractVariablesUsed,
  generateAutomationRuleId,
  generateCommunicationId,
  generateSyncId,
  generateTemplateId,
  resolveTemplateVariables,
  type VariableContext,
} from "@/utils/communications";
import { subscribeToGhlEvents, type GhlEventPayload } from "@/integrations/ghlEvents";
import { useWebinarStore } from "@/data/webinarStore";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import type { Lead } from "@/types/webinar";
import type { StudentRecord } from "@/types/student";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY — NO REAL GHL CONNECTION
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: everything here lives in
// React state mirrored to this browser's localStorage. There is no server,
// no real GoHighLevel API call, no real email/SMS/WhatsApp send. Every
// "Sync to GHL" and "Send Communication" action below is SIMULATED and
// labeled as such (provider: "GHL (Simulated)") — see IntegrationSettings.
//
// THE AUTOMATION ENGINE: this provider subscribes to subscribeToGhlEvents()
// (src/integrations/ghlEvents.ts) on mount, so every dispatchGhlEvent() call
// already made across Steps 5-10 (feedback submitted, lead interested,
// payment verified, course completed, etc.) reaches the Active
// AutomationRule whose triggerEvent matches, without any of those call
// sites needing to know this module exists. Each rule's actions run once
// per real event — a stable idempotency key (ruleId+eventType+person+
// occurredAt) prevents the same event from firing the same rule twice, even
// across a page reload (see utils/communications.ts).
//
// TASK OWNERSHIP: this store never creates staff tasks for the webinar/lead
// lifecycle — src/data/taskStore.tsx already owns that automation (Step 10).
// This store's job is communications/GHL only.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_communications_v1";
/** Keeps the idempotency ledger from growing forever in a long demo session. */
const MAX_IDEMPOTENCY_KEYS = 2000;

interface CommunicationsState {
  contactSyncs: GhlContactSync[];
  preferences: CommunicationPreference[];
  templates: MessageTemplate[];
  automationRules: AutomationRule[];
  communicationLogs: CommunicationLog[];
  syncLogs: SyncLog[];
  tagMappings: TagMappingEntry[];
  fieldMappings: FieldMappingEntry[];
  workflowMappings: WorkflowMappingEntry[];
  integrationSettings: IntegrationSettings;
  webhookLog: WebhookLogEntry[];
  processedEventKeys: string[];
}

function loadInitialState(): CommunicationsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CommunicationsState;
      if (parsed && Array.isArray(parsed.templates)) {
        return {
          contactSyncs: parsed.contactSyncs ?? [],
          preferences: parsed.preferences ?? [],
          templates: parsed.templates,
          automationRules: parsed.automationRules ?? [],
          communicationLogs: parsed.communicationLogs ?? [],
          syncLogs: parsed.syncLogs ?? [],
          tagMappings: parsed.tagMappings ?? DEFAULT_TAG_MAPPINGS,
          fieldMappings: parsed.fieldMappings ?? DEFAULT_FIELD_MAPPINGS,
          workflowMappings: parsed.workflowMappings ?? DEFAULT_WORKFLOW_MAPPINGS,
          integrationSettings: parsed.integrationSettings ?? DEFAULT_INTEGRATION_SETTINGS,
          webhookLog: parsed.webhookLog ?? [],
          processedEventKeys: parsed.processedEventKeys ?? [],
        };
      }
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  // Persist immediately — seed data resolves demo Student ids (via
  // findStudentId in communicationsConfig.ts) at this exact module load,
  // same freeze-on-load requirement every other Step 9/10 store follows.
  const seeded: CommunicationsState = {
    contactSyncs: DEMO_GHL_CONTACT_SYNCS,
    preferences: DEMO_COMMUNICATION_PREFERENCES,
    templates: DEMO_MESSAGE_TEMPLATES,
    automationRules: DEMO_AUTOMATION_RULES,
    communicationLogs: DEMO_COMMUNICATION_LOGS,
    syncLogs: DEMO_SYNC_LOGS,
    tagMappings: DEFAULT_TAG_MAPPINGS,
    fieldMappings: DEFAULT_FIELD_MAPPINGS,
    workflowMappings: DEFAULT_WORKFLOW_MAPPINGS,
    integrationSettings: DEFAULT_INTEGRATION_SETTINGS,
    webhookLog: DEMO_WEBHOOK_LOG,
    processedEventKeys: [],
  };
  persist(seeded);
  return seeded;
}

function persist(state: CommunicationsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowIso() {
  return new Date().toISOString();
}

interface ResolvedPerson {
  personType: PersonType;
  personId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  /** Only set for a Student converted from a Lead (Step 10) — used to reuse the same GHL contact rather than create a new one (spec section 21). */
  linkedLeadInternalId: string | null;
}

interface CommunicationsStoreValue {
  contactSyncs: GhlContactSync[];
  preferences: CommunicationPreference[];
  templates: MessageTemplate[];
  automationRules: AutomationRule[];
  communicationLogs: CommunicationLog[];
  syncLogs: SyncLog[];
  tagMappings: TagMappingEntry[];
  fieldMappings: FieldMappingEntry[];
  workflowMappings: WorkflowMappingEntry[];
  integrationSettings: IntegrationSettings;
  webhookLog: WebhookLogEntry[];

  getSyncForPerson: (personType: PersonType, personId: string) => GhlContactSync | undefined;
  getPreferenceForPerson: (personType: PersonType, personId: string) => CommunicationPreference | undefined;
  syncContact: (personType: PersonType, personId: string) => void;
  resyncContact: (personType: PersonType, personId: string) => void;
  retrySync: (syncLogId: string) => void;
  resolveSyncConflict: (syncLogId: string) => void;
  markPossibleDuplicate: (personType: PersonType, personId: string, value: boolean) => void;

  setPreference: (personType: PersonType, personId: string, patch: Partial<Omit<CommunicationPreference, "id" | "personType" | "personId">>) => void;
  optOut: (personType: PersonType, personId: string) => void;

  createTemplate: (input: CreateMessageTemplateInput) => MessageTemplate;
  updateTemplate: (id: string, patch: Partial<CreateMessageTemplateInput>) => void;
  setTemplateStatus: (id: string, status: MessageTemplateStatus) => void;

  createAutomationRule: (input: CreateAutomationRuleInput) => AutomationRule;
  updateAutomationRule: (id: string, patch: Partial<CreateAutomationRuleInput>) => void;
  setAutomationRuleStatus: (id: string, status: AutomationRuleStatus) => void;

  setTagMapping: (id: string, patch: Partial<Pick<TagMappingEntry, "tagName" | "enabled">>) => void;
  setFieldMapping: (id: string, patch: Partial<Pick<FieldMappingEntry, "ghlField" | "direction" | "enabled">>) => void;
  setWorkflowMapping: (id: string, patch: Partial<Pick<WorkflowMappingEntry, "ghlWorkflowName" | "enabled">>) => void;
  setIntegrationSettings: (patch: Partial<IntegrationSettings>) => void;

  sendManualMessage: (input: SendManualMessageInput) => CommunicationLog;
  buildVariableContext: (personType: PersonType, personId: string) => VariableContext;
  simulateInboundWebhook: (eventType: string, duplicateOfWebhookId?: string) => WebhookLogEntry;
}

const CommunicationsStoreContext = createContext<CommunicationsStoreValue | undefined>(undefined);

export function CommunicationsStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CommunicationsState>(() => loadInitialState());
  const { leads, sessions: webinarSessions } = useWebinarStore();
  const { students } = useStudentStore();
  const { transactions, adjustments } = useFinanceStore();

  const updateState = useCallback((updater: (prev: CommunicationsState) => CommunicationsState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------
  // Person resolution + variable context — the only place this store
  // reaches into Lead/StudentRecord shapes.
  // -------------------------------------------------------------------
  const resolvePerson = useCallback(
    (payload: GhlEventPayload): ResolvedPerson | null => {
      if (payload.studentId) {
        const student = students.find((s) => s.id === payload.studentId);
        if (student) {
          return {
            personType: "Student",
            personId: student.id,
            fullName: student.fullName,
            email: student.email,
            contactNumber: student.contactNumber,
            linkedLeadInternalId: student.leadId,
          };
        }
      }
      if (payload.leadId) {
        // GhlEventPayload.leadId is the DISPLAY id (Lead.leadId), not the internal id — every webinarStore dispatch call already uses this shape.
        const lead = leads.find((l) => l.leadId === payload.leadId);
        if (lead) {
          return {
            personType: "Lead",
            personId: lead.id,
            fullName: lead.fullName,
            email: lead.email,
            contactNumber: lead.contactNumber,
            linkedLeadInternalId: null,
          };
        }
      }
      return null;
    },
    [leads, students],
  );

  const findPersonRecord = useCallback(
    (personType: PersonType, personId: string): Lead | StudentRecord | undefined =>
      personType === "Lead" ? leads.find((l) => l.id === personId) : students.find((s) => s.id === personId),
    [leads, students],
  );

  const buildVariableContext = useCallback(
    (personType: PersonType, personId: string): VariableContext => {
      if (personType === "Lead") {
        const lead = leads.find((l) => l.id === personId);
        if (!lead) return {};
        const session = webinarSessions.find((s) => s.id === lead.latestWebinarSessionId);
        return {
          firstName: lead.fullName.split(" ")[0],
          fullName: lead.fullName,
          leadId: lead.leadId,
          webinarTitle: session?.title,
          webinarDate: session?.date,
          webinarTime: session?.startTime,
          feedbackLink: "/webinar/feedback-form",
          portalLink: "/webinar/register",
        };
      }
      const student = students.find((s) => s.id === personId);
      if (!student) return {};
      const summary = getStudentFinanceSummary(student, transactions, adjustments);
      return {
        firstName: student.fullName.split(" ")[0],
        fullName: student.fullName,
        studentId: student.studentId,
        batch: student.batch,
        package: student.package,
        balance: formatPeso(summary.balance),
        feedbackLink: "/portal/feedback",
        portalLink: "/portal",
      };
    },
    [leads, students, webinarSessions, transactions, adjustments],
  );

  const checkStopConditions = useCallback(
    (rule: AutomationRule, person: ResolvedPerson, preferences: CommunicationPreference[]): boolean => {
      for (const cond of rule.stopConditions) {
        if (cond === "Contact opted out") {
          const pref = preferences.find((p) => p.personType === person.personType && p.personId === person.personId);
          if (pref?.optOutDate) return true;
        }
        if (person.personType === "Lead") {
          const lead = leads.find((l) => l.id === person.personId);
          if (!lead) continue;
          if (cond === "Lead Enrolled" && (lead.status === "Enrolled" || lead.convertedToStudentId)) return true;
          if (cond === "Lead marked Not Interested" && lead.status === "Not Interested") return true;
        }
        if (person.personType === "Student" && cond === "Student Fully Paid") {
          const student = students.find((s) => s.id === person.personId);
          if (student) {
            const summary = getStudentFinanceSummary(student, transactions, adjustments);
            if (summary.status === "Fully Paid") return true;
          }
        }
      }
      return false;
    },
    [leads, students, transactions, adjustments],
  );

  // -------------------------------------------------------------------
  // GHL Contact Sync (spec sections 4, 7-9, 21)
  // -------------------------------------------------------------------
  const getSyncForPerson = useCallback(
    (personType: PersonType, personId: string) => state.contactSyncs.find((s) => s.personType === personType && s.personId === personId),
    [state.contactSyncs],
  );

  const getPreferenceForPerson = useCallback(
    (personType: PersonType, personId: string) => state.preferences.find((p) => p.personType === personType && p.personId === personId),
    [state.preferences],
  );

  const performSync = useCallback(
    (prev: CommunicationsState, personType: PersonType, personId: string): CommunicationsState => {
      const iso = nowIso();
      const record = findPersonRecord(personType, personId);
      const personName = record ? ("fullName" in record ? record.fullName : "") : personId;
      const existing = prev.contactSyncs.find((s) => s.personType === personType && s.personId === personId);

      // Preserve the SAME GHL contact when a Lead converts to a Student —
      // never create a second contact for the same person (spec section 21).
      let reusedContactId = existing?.ghlContactId ?? null;
      if (!reusedContactId && personType === "Student") {
        const student = record as StudentRecord | undefined;
        if (student?.leadId) {
          const leadSync = prev.contactSyncs.find((s) => s.personType === "Lead" && s.personId === student.leadId);
          if (leadSync?.ghlContactId) reusedContactId = leadSync.ghlContactId;
        }
      }

      const disconnected = prev.integrationSettings.mode === "Disconnected";
      const nextSync: GhlContactSync = existing
        ? {
            ...existing,
            lastAttemptDate: iso,
            ...(disconnected
              ? { lastSyncStatus: "Error", syncError: "GHL NOT CONNECTED — no real integration is configured in this build." }
              : {
                  ghlContactId: reusedContactId ?? existing.ghlContactId ?? `ghl-sim-${existing.id.slice(0, 8)}`,
                  ghlLocationId: existing.ghlLocationId ?? (prev.integrationSettings.locationLabel || "ghl-location-demo"),
                  lastSyncDate: iso,
                  lastSyncStatus: "Synced",
                  syncError: null,
                }),
            updatedAt: iso,
          }
        : {
            id: crypto.randomUUID(),
            personType,
            personId,
            ghlContactId: disconnected ? null : (reusedContactId ?? `ghl-sim-${crypto.randomUUID().slice(0, 8)}`),
            ghlLocationId: disconnected ? null : prev.integrationSettings.locationLabel || "ghl-location-demo",
            lastSyncDate: disconnected ? null : iso,
            lastAttemptDate: iso,
            lastSyncStatus: disconnected ? "Error" : "Synced",
            syncError: disconnected ? "GHL NOT CONNECTED — no real integration is configured in this build." : null,
            possibleDuplicate: false,
            createdAt: iso,
            updatedAt: iso,
          };

      const log: SyncLog = {
        id: crypto.randomUUID(),
        syncId: generateSyncId(prev.syncLogs),
        personType,
        personId,
        personName,
        direction: "M.A.I.A. → GHL",
        event: "contact.sync",
        occurredAt: iso,
        status: disconnected ? "Failed" : "Success",
        retryCount: existing && existing.lastSyncStatus === "Error" ? existing.lastAttemptDate ? 1 : 0 : 0,
        error: disconnected ? "GHL NOT CONNECTED" : null,
        externalId: nextSync.ghlContactId,
      };

      return {
        ...prev,
        contactSyncs: existing ? prev.contactSyncs.map((s) => (s.id === existing.id ? nextSync : s)) : [nextSync, ...prev.contactSyncs],
        syncLogs: [log, ...prev.syncLogs],
      };
    },
    [findPersonRecord],
  );

  const syncContact = useCallback(
    (personType: PersonType, personId: string) => {
      updateState((prev) => performSync(prev, personType, personId));
    },
    [updateState, performSync],
  );

  const resyncContact = useCallback(
    (personType: PersonType, personId: string) => {
      updateState((prev) => performSync(prev, personType, personId));
    },
    [updateState, performSync],
  );

  const retrySync = useCallback(
    (syncLogId: string) => {
      updateState((prev) => {
        const log = prev.syncLogs.find((s) => s.id === syncLogId);
        if (!log) return prev;
        const next = performSync(prev, log.personType, log.personId);
        const newLog = next.syncLogs[0];
        const retryCount = log.retryCount + 1;
        const overLimit = retryCount >= prev.integrationSettings.retryLimit && newLog.status !== "Success";
        return {
          ...next,
          syncLogs: [
            { ...newLog, retryCount, status: overLimit ? "Needs Review" : newLog.status },
            ...next.syncLogs.slice(1),
          ],
        };
      });
    },
    [updateState, performSync],
  );

  const resolveSyncConflict = useCallback(
    (syncLogId: string) => {
      updateState((prev) => {
        const log = prev.syncLogs.find((s) => s.id === syncLogId);
        if (!log) return prev;
        return {
          ...prev,
          contactSyncs: prev.contactSyncs.map((s) =>
            s.personType === log.personType && s.personId === log.personId
              ? { ...s, lastSyncStatus: "Not Synced", syncError: null, possibleDuplicate: false }
              : s,
          ),
        };
      });
    },
    [updateState],
  );

  const markPossibleDuplicate = useCallback(
    (personType: PersonType, personId: string, value: boolean) => {
      updateState((prev) => ({
        ...prev,
        contactSyncs: prev.contactSyncs.map((s) => (s.personType === personType && s.personId === personId ? { ...s, possibleDuplicate: value } : s)),
      }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Communication Preferences / Opt-Out (spec sections 41-42)
  // -------------------------------------------------------------------
  const setPreference = useCallback(
    (personType: PersonType, personId: string, patch: Partial<Omit<CommunicationPreference, "id" | "personType" | "personId">>) => {
      updateState((prev) => {
        const existing = prev.preferences.find((p) => p.personType === personType && p.personId === personId);
        if (existing) {
          return { ...prev, preferences: prev.preferences.map((p) => (p.id === existing.id ? { ...p, ...patch } : p)) };
        }
        const created: CommunicationPreference = {
          id: crypto.randomUUID(),
          personType,
          personId,
          emailAllowed: true,
          smsAllowed: true,
          whatsappAllowed: false,
          marketingAllowed: false,
          operationalAllowed: true,
          optOutDate: null,
          consentSource: "Admin-recorded",
          consentDate: nowIso(),
          ...patch,
        };
        return { ...prev, preferences: [created, ...prev.preferences] };
      });
    },
    [updateState],
  );

  const optOut = useCallback(
    (personType: PersonType, personId: string) => {
      setPreference(personType, personId, {
        optOutDate: nowIso(),
        marketingAllowed: false,
        emailAllowed: false,
        smsAllowed: false,
        whatsappAllowed: false,
      });
    },
    [setPreference],
  );

  // -------------------------------------------------------------------
  // Message Templates
  // -------------------------------------------------------------------
  const createTemplate = useCallback(
    (input: CreateMessageTemplateInput): MessageTemplate => {
      let created!: MessageTemplate;
      updateState((prev) => {
        const iso = nowIso();
        created = {
          id: crypto.randomUUID(),
          templateId: generateTemplateId(prev.templates),
          ...input,
          variablesUsed: extractVariablesUsed(`${input.subject} ${input.message}`),
          status: "Draft",
          approvedBy: null,
          lastUpdated: iso,
          createdAt: iso,
        };
        return { ...prev, templates: [created, ...prev.templates] };
      });
      return created;
    },
    [updateState],
  );

  const updateTemplate = useCallback(
    (id: string, patch: Partial<CreateMessageTemplateInput>) => {
      updateState((prev) => ({
        ...prev,
        templates: prev.templates.map((t) => {
          if (t.id !== id) return t;
          const merged = { ...t, ...patch };
          return { ...merged, variablesUsed: extractVariablesUsed(`${merged.subject} ${merged.message}`), lastUpdated: nowIso() };
        }),
      }));
    },
    [updateState],
  );

  const setTemplateStatus = useCallback(
    (id: string, status: MessageTemplateStatus) => {
      updateState((prev) => ({
        ...prev,
        templates: prev.templates.map((t) => (t.id === id ? { ...t, status, approvedBy: status === "Active" ? CURRENT_DEMO_USER : t.approvedBy, lastUpdated: nowIso() } : t)),
      }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Automation Rules
  // -------------------------------------------------------------------
  const createAutomationRule = useCallback(
    (input: CreateAutomationRuleInput): AutomationRule => {
      let created!: AutomationRule;
      updateState((prev) => {
        const iso = nowIso();
        created = {
          id: crypto.randomUUID(),
          ruleId: generateAutomationRuleId(prev.automationRules),
          name: input.name,
          category: input.category,
          triggerEvent: input.triggerEvent,
          conditions: input.conditions,
          actions: input.actions.map((a) => ({ ...a, id: crypto.randomUUID() })),
          stopConditions: input.stopConditions,
          status: "Draft",
          totalTriggered: 0,
          successful: 0,
          failed: 0,
          lastTriggeredAt: null,
          createdBy: CURRENT_DEMO_USER,
          createdAt: iso,
          updatedAt: iso,
        };
        return { ...prev, automationRules: [created, ...prev.automationRules] };
      });
      return created;
    },
    [updateState],
  );

  const updateAutomationRule = useCallback(
    (id: string, patch: Partial<CreateAutomationRuleInput>) => {
      updateState((prev) => ({
        ...prev,
        automationRules: prev.automationRules.map((r) =>
          r.id === id
            ? {
                ...r,
                ...patch,
                actions: patch.actions ? patch.actions.map((a) => ({ ...a, id: crypto.randomUUID() })) : r.actions,
                updatedAt: nowIso(),
              }
            : r,
        ),
      }));
    },
    [updateState],
  );

  const setAutomationRuleStatus = useCallback(
    (id: string, status: AutomationRuleStatus) => {
      updateState((prev) => ({ ...prev, automationRules: prev.automationRules.map((r) => (r.id === id ? { ...r, status, updatedAt: nowIso() } : r)) }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Tag / Field / Workflow Mapping + Integration Settings
  // -------------------------------------------------------------------
  const setTagMapping = useCallback(
    (id: string, patch: Partial<Pick<TagMappingEntry, "tagName" | "enabled">>) => {
      updateState((prev) => ({ ...prev, tagMappings: prev.tagMappings.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    },
    [updateState],
  );

  const setFieldMapping = useCallback(
    (id: string, patch: Partial<Pick<FieldMappingEntry, "ghlField" | "direction" | "enabled">>) => {
      updateState((prev) => ({ ...prev, fieldMappings: prev.fieldMappings.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
    },
    [updateState],
  );

  const setWorkflowMapping = useCallback(
    (id: string, patch: Partial<Pick<WorkflowMappingEntry, "ghlWorkflowName" | "enabled">>) => {
      updateState((prev) => ({ ...prev, workflowMappings: prev.workflowMappings.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
    },
    [updateState],
  );

  const setIntegrationSettings = useCallback(
    (patch: Partial<IntegrationSettings>) => {
      updateState((prev) => ({
        ...prev,
        integrationSettings: {
          ...prev.integrationSettings,
          ...patch,
          connectedAt: patch.mode && patch.mode !== "Disconnected" && prev.integrationSettings.mode === "Disconnected" ? nowIso() : prev.integrationSettings.connectedAt,
        },
      }));
    },
    [updateState],
  );

  // -------------------------------------------------------------------
  // Sending a communication (shared by automation + manual send)
  // -------------------------------------------------------------------
  const buildCommunicationLog = useCallback(
    (
      prev: CommunicationsState,
      input: {
        personType: PersonType;
        personId: string;
        personName: string;
        channel: SendManualMessageInput["channel"];
        templateId: string | null;
        automationId: string | null;
        subject: string;
        message: string;
        purpose: "marketing" | "operational";
        sentBy: string;
      },
    ): CommunicationLog => {
      const iso = nowIso();
      const preference = prev.preferences.find((p) => p.personType === input.personType && p.personId === input.personId);
      const eligibility = checkChannelEligibility(preference, input.channel, input.purpose);
      const disconnected = prev.integrationSettings.mode === "Disconnected" && GHL_INTEGRATED_CHANNELS.includes(input.channel);

      let status: CommunicationLogStatus = "Sent";
      let failureReason: string | null = null;
      if (!eligibility.allowed) {
        status = "Skipped";
        failureReason = eligibility.reason;
      } else if (disconnected) {
        status = "Failed";
        failureReason = "GHL NOT CONNECTED — no real send occurred.";
      }

      return {
        id: crypto.randomUUID(),
        communicationId: generateCommunicationId(prev.communicationLogs),
        personType: input.personType,
        personId: input.personId,
        personName: input.personName,
        channel: input.channel,
        templateId: input.templateId,
        automationId: input.automationId,
        subject: input.subject || null,
        message: input.message,
        status,
        provider: input.channel === "Internal Notification" ? "Internal" : GHL_INTEGRATED_CHANNELS.includes(input.channel) ? "GHL (Simulated)" : "Manual",
        externalMessageId: status === "Sent" ? `sim-msg-${crypto.randomUUID().slice(0, 8)}` : null,
        failureReason,
        occurredAt: iso,
        sentBy: input.sentBy,
      };
    },
    [],
  );

  const sendManualMessage = useCallback(
    (input: SendManualMessageInput): CommunicationLog => {
      let created!: CommunicationLog;
      updateState((prev) => {
        const record = findPersonRecord(input.personType, input.personId);
        const personName = record ? record.fullName : input.personId;
        const template = input.templateId ? prev.templates.find((t) => t.id === input.templateId) : undefined;
        const vars = buildVariableContext(input.personType, input.personId);
        const subject = template ? resolveTemplateVariables(template.subject, vars).resolved : input.subject;
        const message = resolveTemplateVariables(template ? template.message : input.message, vars).resolved;
        created = buildCommunicationLog(prev, {
          personType: input.personType,
          personId: input.personId,
          personName,
          channel: input.channel,
          templateId: input.templateId,
          automationId: null,
          subject,
          message,
          purpose: "operational",
          sentBy: CURRENT_DEMO_USER,
        });
        return { ...prev, communicationLogs: [created, ...prev.communicationLogs] };
      });
      return created;
    },
    [updateState, findPersonRecord, buildVariableContext, buildCommunicationLog],
  );

  // -------------------------------------------------------------------
  // Automation engine — subscribes to every dispatchGhlEvent() call made
  // anywhere in the app (spec sections 12-32, 37-40, 51, 69-71).
  // -------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = subscribeToGhlEvents((payload) => {
      const person = resolvePerson(payload);

      updateState((prev) => {
        const matchingRules = prev.automationRules.filter((r) => r.status === "Active" && r.triggerEvent === payload.type);
        if (matchingRules.length === 0) return prev;
        if (!person) return prev; // nothing to sync/message without a resolved person

        let working = prev;
        for (const rule of matchingRules) {
          const idempotencyKey = buildAutomationIdempotencyKey(rule.id, payload);
          if (working.processedEventKeys.includes(idempotencyKey)) continue;

          let nextWorking: CommunicationsState = {
            ...working,
            processedEventKeys: [...working.processedEventKeys, idempotencyKey].slice(-MAX_IDEMPOTENCY_KEYS),
          };

          if (checkStopConditions(rule, person, working.preferences)) {
            working = nextWorking;
            continue;
          }

          let ruleSucceeded = true;
          for (const act of rule.actions) {
            if (act.type === "Sync to GHL") {
              nextWorking = performSync(nextWorking, person.personType, person.personId);
            } else if (act.type === "Apply Tag" || act.type === "Remove Tag" || act.type === "Start GHL Workflow") {
              const tagMapping = working.tagMappings.find((t) => t.triggerEvent === payload.type && t.enabled);
              const label = act.type === "Start GHL Workflow" ? act.targetLabel : (tagMapping?.tagName ?? act.targetLabel);
              const disconnected = nextWorking.integrationSettings.mode === "Disconnected";
              const log: SyncLog = {
                id: crypto.randomUUID(),
                syncId: generateSyncId(nextWorking.syncLogs),
                personType: person.personType,
                personId: person.personId,
                personName: person.fullName,
                direction: "M.A.I.A. → GHL",
                event: `${act.type}: ${label || "(unnamed)"}`,
                occurredAt: nowIso(),
                status: disconnected ? "Failed" : "Success",
                retryCount: 0,
                error: disconnected ? "GHL NOT CONNECTED" : null,
                externalId: null,
              };
              if (disconnected) ruleSucceeded = false;
              nextWorking = { ...nextWorking, syncLogs: [log, ...nextWorking.syncLogs] };
            } else if (act.type === "Send Communication" && act.channel) {
              const template = act.templateId ? nextWorking.templates.find((t) => t.id === act.templateId) : undefined;
              const vars = buildVariableContext(person.personType, person.personId);
              const resolvedSubject = template ? resolveTemplateVariables(template.subject, vars).resolved : "";
              const resolvedMessage = template ? resolveTemplateVariables(template.message, vars).resolved : payload.summary;
              const purpose: "marketing" | "operational" = rule.category === "Leads" ? "marketing" : "operational";
              const log = buildCommunicationLog(nextWorking, {
                personType: person.personType,
                personId: person.personId,
                personName: person.fullName,
                channel: act.channel,
                templateId: act.templateId,
                automationId: rule.id,
                subject: resolvedSubject,
                message: resolvedMessage,
                purpose,
                sentBy: "System (Automatic)",
              });
              if (log.status === "Failed" || log.status === "Skipped") ruleSucceeded = false;
              nextWorking = { ...nextWorking, communicationLogs: [log, ...nextWorking.communicationLogs] };
            }
          }

          nextWorking = {
            ...nextWorking,
            automationRules: nextWorking.automationRules.map((r) =>
              r.id === rule.id
                ? {
                    ...r,
                    totalTriggered: r.totalTriggered + 1,
                    successful: r.successful + (ruleSucceeded ? 1 : 0),
                    failed: r.failed + (ruleSucceeded ? 0 : 1),
                    lastTriggeredAt: nowIso(),
                  }
                : r,
            ),
          };

          working = nextWorking;
        }

        return working === prev ? prev : working;
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, students, webinarSessions, transactions, adjustments, resolvePerson, updateState, performSync, buildCommunicationLog, checkStopConditions, buildVariableContext]);

  // -------------------------------------------------------------------
  // Inbound webhook simulation (spec sections 52-53, 57, 70) — no real
  // server endpoint exists; this demonstrates the idempotent-processing
  // architecture a real webhook handler would need.
  // -------------------------------------------------------------------
  const simulateInboundWebhook = useCallback(
    (eventType: string, duplicateOfWebhookId?: string): WebhookLogEntry => {
      let created!: WebhookLogEntry;
      updateState((prev) => {
        const duplicateOf = duplicateOfWebhookId ? prev.webhookLog.find((w) => w.webhookId === duplicateOfWebhookId) : undefined;
        const isDuplicate = Boolean(duplicateOf);
        created = {
          id: crypto.randomUUID(),
          webhookId: duplicateOf ? duplicateOf.webhookId : `whk-sim-${crypto.randomUUID().slice(0, 8)}`,
          eventType,
          receivedAt: nowIso(),
          signatureVerified: true,
          processed: !isDuplicate,
          duplicate: isDuplicate,
          payloadSummary: isDuplicate ? `Duplicate delivery of ${eventType} — ignored (idempotent).` : `Simulated inbound: ${eventType}`,
        };
        return { ...prev, webhookLog: [created, ...prev.webhookLog] };
      });
      return created;
    },
    [updateState],
  );

  const value = useMemo<CommunicationsStoreValue>(
    () => ({
      contactSyncs: state.contactSyncs,
      preferences: state.preferences,
      templates: state.templates,
      automationRules: state.automationRules,
      communicationLogs: state.communicationLogs,
      syncLogs: state.syncLogs,
      tagMappings: state.tagMappings,
      fieldMappings: state.fieldMappings,
      workflowMappings: state.workflowMappings,
      integrationSettings: state.integrationSettings,
      webhookLog: state.webhookLog,
      getSyncForPerson,
      getPreferenceForPerson,
      syncContact,
      resyncContact,
      retrySync,
      resolveSyncConflict,
      markPossibleDuplicate,
      setPreference,
      optOut,
      createTemplate,
      updateTemplate,
      setTemplateStatus,
      createAutomationRule,
      updateAutomationRule,
      setAutomationRuleStatus,
      setTagMapping,
      setFieldMapping,
      setWorkflowMapping,
      setIntegrationSettings,
      sendManualMessage,
      simulateInboundWebhook,
      buildVariableContext,
    }),
    [
      state,
      getSyncForPerson,
      getPreferenceForPerson,
      syncContact,
      resyncContact,
      retrySync,
      resolveSyncConflict,
      markPossibleDuplicate,
      setPreference,
      optOut,
      createTemplate,
      updateTemplate,
      setTemplateStatus,
      createAutomationRule,
      updateAutomationRule,
      setAutomationRuleStatus,
      setTagMapping,
      setFieldMapping,
      setWorkflowMapping,
      setIntegrationSettings,
      sendManualMessage,
      simulateInboundWebhook,
      buildVariableContext,
    ],
  );

  return <CommunicationsStoreContext.Provider value={value}>{children}</CommunicationsStoreContext.Provider>;
}

export function useCommunicationsStore() {
  const ctx = useContext(CommunicationsStoreContext);
  if (!ctx) throw new Error("useCommunicationsStore must be used within a CommunicationsStoreProvider");
  return ctx;
}
