import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Batch } from "@/types/student";
import type { StaffRoleName } from "@/types/staff";
import type {
  TaskAttachmentMeta,
  TaskCategory,
  TaskChecklistItem,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from "@/types/task";
import { DEMO_TASKS } from "@/data/demoTasks";
import { TASK_TEMPLATES } from "@/data/taskConfig";
import { generateTaskId, isTaskActive } from "@/utils/staffTasks";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { useStaffStore } from "@/data/staffStore";
import { getRequirementsBucket } from "@/utils/dashboard";
import { getStudentFinanceSummary } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { dispatchGhlEvent } from "@/integrations/ghlEvents";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as the other Step 1-4 stores: tasks live in React state and
// are mirrored to this browser's localStorage only — not a real database,
// not shared across devices/users, cleared if browser data is cleared.
//
// AUTOMATIC TASK CREATION: this provider watches the student/finance/staff
// stores (read via their own hooks, since this provider is nested innermost
// in src/App.tsx) and reactively creates/auto-completes tasks when real
// trigger conditions are met — see the effect below. Nothing here modifies
// studentStore/financeStore/staffStore directly; it only reads them and
// manages its own task records, so Steps 1-4 remain untouched.
//
// Every automatically-created task carries a unique `autoTriggerKey` so the
// same real-world event never creates a duplicate task, even after the
// first one is completed or cancelled (completed tasks are kept forever —
// never deleted — as the record of what happened).
//
// NOTE ON NOTIFICATIONS: this store does not push real-time notifications.
// "New" tasks are simply new rows the UI reads on its next render — see
// src/components/layout/NotificationsDropdown.tsx for the honesty notice
// shown to the user about this.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_tasks_v1";

function loadInitialTasks(): TaskRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TaskRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  return DEMO_TASKS;
}

function persist(tasks: TaskRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CURRENT_DEMO_USER = "Mommy Ann";
const SYSTEM_USER = "System (Automatic)";

export interface CreateTaskInput {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  assignedTo: string;
  assignedToName: string;
  dueDate: string;
  relatedStudentId?: string | null;
  relatedStudentName?: string | null;
  relatedBatch?: Batch | null;
  checklist?: string[];
}

export interface ApplyTemplateInput {
  templateId: string;
  assignedTo: string;
  assignedToName: string;
  relatedStudentId?: string | null;
  relatedStudentName?: string | null;
  relatedBatch?: Batch | null;
}

interface TaskStoreValue {
  tasks: TaskRecord[];
  getTaskById: (id: string) => TaskRecord | undefined;
  getTasksForStudent: (studentId: string) => TaskRecord[];
  createTask: (input: CreateTaskInput) => TaskRecord;
  applyTemplate: (input: ApplyTemplateInput) => TaskRecord[];
  updateTask: (
    id: string,
    patch: Partial<Pick<TaskRecord, "title" | "description" | "category" | "priority" | "dueDate">>,
  ) => void;
  startTask: (id: string) => void;
  sendForReview: (id: string) => void;
  approveAndComplete: (id: string, reviewNotes?: string) => void;
  returnForChanges: (id: string, reviewNotes: string) => void;
  markBlocked: (id: string, reason: string) => void;
  unblockTask: (id: string) => void;
  cancelTask: (id: string, reason: string) => void;
  reassignTask: (id: string, staffId: string, staffName: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  addComment: (taskId: string, text: string) => void;
  addAttachment: (taskId: string, meta: TaskAttachmentMeta) => void;
}

const TaskStoreContext = createContext<TaskStoreValue | undefined>(undefined);

export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskRecord[]>(() => loadInitialTasks());
  const { students, appendActivity } = useStudentStore();
  const { transactions, adjustments } = useFinanceStore();
  const { staff } = useStaffStore();

  const updateTasksState = useCallback((updater: (prev: TaskRecord[]) => TaskRecord[]) => {
    setTasks((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      persist(next);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------
  // Automatic task creation + auto-completion (spec sections 15 & 28)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (staff.length === 0) return;

    function pickAssignee(role: StaffRoleName) {
      return (
        staff.find((s) => s.role === role && s.accountStatus === "Active") ??
        staff.find((s) => s.role === "Owner") ??
        staff[0]
      );
    }

    updateTasksState((prev) => {
      let changed = false;
      const next = [...prev];
      const hasKey = (key: string) => next.some((t) => t.autoTriggerKey === key);

      function addAuto(input: {
        key: string;
        title: string;
        description: string;
        category: TaskCategory;
        priority: TaskPriority;
        role: StaffRoleName;
        dueOffsetDays: number;
        relatedStudentId?: string;
        relatedStudentName?: string;
        relatedBatch?: Batch;
      }) {
        if (hasKey(input.key)) return;
        const assignee = pickAssignee(input.role);
        const id = generateTaskId(next);
        const task: TaskRecord = {
          id,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          status: "To Do",
          assignedTo: assignee.id,
          assignedToName: assignee.fullName,
          createdBy: SYSTEM_USER,
          relatedStudentId: input.relatedStudentId ?? null,
          relatedStudentName: input.relatedStudentName ?? null,
          relatedBatch: input.relatedBatch ?? null,
          dueDate: todayPlus(input.dueOffsetDays),
          createdAt: new Date().toISOString(),
          startedAt: null,
          sentForReviewAt: null,
          completedAt: null,
          blockedReason: null,
          cancelledReason: null,
          checklist: [],
          comments: [],
          attachments: [],
          source: "Automatic",
          autoTriggerKey: input.key,
          templateId: null,
          reviewedBy: null,
          reviewNotes: null,
        };
        next.push(task);
        changed = true;
        dispatchGhlEvent({
          type: "task.created",
          occurredAt: task.createdAt,
          taskId: task.id,
          studentId: task.relatedStudentId ?? undefined,
          summary: `Automatic task created: ${task.title}`,
        });
      }

      for (const s of students) {
        if (s.enrollmentStatus === "Pending Verification") {
          addAuto({
            key: `enrollment-verify-${s.id}`,
            title: `Verify new enrollment: ${s.fullName}`,
            description: `${s.fullName} (${s.studentId}) submitted a new enrollment and needs verification.`,
            category: "Enrollment",
            priority: "High",
            role: "Enrollment Officer",
            dueOffsetDays: 1,
            relatedStudentId: s.id,
            relatedStudentName: s.fullName,
            relatedBatch: s.batch,
          });
        }

        if (s.validId.file && s.validId.status === "Pending") {
          addAuto({
            key: `validid-review-${s.id}`,
            title: `Review Valid ID: ${s.fullName}`,
            description: `${s.fullName} (${s.studentId}) uploaded a Valid ID that needs review.`,
            category: "Requirements",
            priority: "Medium",
            role: "Enrollment Officer",
            dueOffsetDays: 1,
            relatedStudentId: s.id,
            relatedStudentName: s.fullName,
            relatedBatch: s.batch,
          });
        }

        const financeSummary = getStudentFinanceSummary(s, transactions, adjustments);
        if (financeSummary.status === "Fully Paid") {
          addAuto({
            key: `fully-paid-${s.id}`,
            title: `Confirm slot for fully paid student: ${s.fullName}`,
            description: `${s.fullName} (${s.studentId}) is now fully paid — confirm their slot and proceed with onboarding.`,
            category: "Enrollment",
            priority: "Medium",
            role: "Enrollment Officer",
            dueOffsetDays: 2,
            relatedStudentId: s.id,
            relatedStudentName: s.fullName,
            relatedBatch: s.batch,
          });
        }

        if (getRequirementsBucket(s) === "Verified" && s.taobao.status === "Not Yet Created") {
          addAuto({
            key: `taobao-create-${s.id}`,
            title: `Create Taobao account: ${s.fullName}`,
            description: `${s.fullName} (${s.studentId}) has verified requirements and needs a Taobao account created.`,
            category: "Taobao",
            priority: "Medium",
            role: "Student Success Coordinator",
            dueOffsetDays: 3,
            relatedStudentId: s.id,
            relatedStudentName: s.fullName,
            relatedBatch: s.batch,
          });
        }

        if (s.masterBrainStatus === "Submitted") {
          addAuto({
            key: `masterbrain-review-${s.id}`,
            title: `Review Master Brain submission: ${s.fullName}`,
            description: `${s.fullName} (${s.studentId}) submitted their Master Brain questionnaire for review.`,
            category: "Master Brain",
            priority: "Medium",
            role: "Student Success Coordinator",
            dueOffsetDays: 2,
            relatedStudentId: s.id,
            relatedStudentName: s.fullName,
            relatedBatch: s.batch,
          });
        }

        if (s.masterBrainStatus === "Completed") {
          addAuto({
            key: `certificate-prep-${s.id}`,
            title: `Prepare certificate: ${s.fullName}`,
            description: `${s.fullName} (${s.studentId}) has an approved Master Brain — prepare their certificate.`,
            category: "Certificates",
            priority: "Low",
            role: "Training Coordinator",
            dueOffsetDays: 5,
            relatedStudentId: s.id,
            relatedStudentName: s.fullName,
            relatedBatch: s.batch,
          });
        }

        if (s.enrollmentStatus === "Completed") {
          addAuto({
            key: `certificate-release-${s.id}`,
            title: `Release certificate: ${s.fullName}`,
            description: `${s.fullName} (${s.studentId}) completed training — release their certificate and close out their file.`,
            category: "Certificates",
            priority: "Low",
            role: "Training Coordinator",
            dueOffsetDays: 3,
            relatedStudentId: s.id,
            relatedStudentName: s.fullName,
            relatedBatch: s.batch,
          });
        }
      }

      for (const t of transactions) {
        if (t.status === "Pending Verification") {
          addAuto({
            key: `payment-verify-${t.id}`,
            title: `Verify payment ${t.id}: ${t.studentName}`,
            description: `${t.studentName} (${t.studentDisplayId}) submitted a payment of ${formatPeso(t.amount)} that needs verification.`,
            category: "Payment Verification",
            priority: "High",
            role: "Finance Officer",
            dueOffsetDays: 0,
            relatedStudentId: t.studentId,
            relatedStudentName: t.studentName,
            relatedBatch: t.batch,
          });
        }
      }

      // Auto-complete: resolve automatic tasks whose trigger condition no longer holds.
      for (let i = 0; i < next.length; i++) {
        const t = next[i];
        if (t.source !== "Automatic" || !t.autoTriggerKey || !isTaskActive(t.status)) continue;

        let resolved = false;

        if (t.autoTriggerKey.startsWith("payment-verify-")) {
          const txnId = t.autoTriggerKey.replace("payment-verify-", "");
          const txn = transactions.find((x) => x.id === txnId);
          resolved = !txn || txn.status !== "Pending Verification";
        } else if (t.autoTriggerKey.startsWith("validid-review-")) {
          const studentId = t.autoTriggerKey.replace("validid-review-", "");
          const student = students.find((s) => s.id === studentId);
          resolved = !student || student.validId.status !== "Pending";
        } else if (t.autoTriggerKey.startsWith("taobao-create-")) {
          const studentId = t.autoTriggerKey.replace("taobao-create-", "");
          const student = students.find((s) => s.id === studentId);
          resolved = !student || student.taobao.status !== "Not Yet Created";
        } else if (t.autoTriggerKey.startsWith("masterbrain-review-")) {
          const studentId = t.autoTriggerKey.replace("masterbrain-review-", "");
          const student = students.find((s) => s.id === studentId);
          resolved = !student || student.masterBrainStatus !== "Submitted";
        } else if (t.autoTriggerKey.startsWith("enrollment-verify-")) {
          const studentId = t.autoTriggerKey.replace("enrollment-verify-", "");
          const student = students.find((s) => s.id === studentId);
          resolved = !student || student.enrollmentStatus !== "Pending Verification";
        }

        if (resolved) {
          changed = true;
          next[i] = {
            ...t,
            status: "Completed",
            completedAt: new Date().toISOString(),
            reviewedBy: SYSTEM_USER,
            reviewNotes: "Auto-completed — the trigger condition was resolved elsewhere in the app.",
          };
          dispatchGhlEvent({
            type: "task.completed",
            occurredAt: new Date().toISOString(),
            taskId: t.id,
            studentId: t.relatedStudentId ?? undefined,
            summary: `Task auto-completed: ${t.title}`,
          });
        }
      }

      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, transactions, adjustments, staff]);

  const logStudentActivity = useCallback(
    (task: TaskRecord, message: string) => {
      if (task.relatedStudentId) {
        appendActivity(task.relatedStudentId, message);
      }
    },
    [appendActivity],
  );

  const getTaskById = useCallback((id: string) => tasks.find((t) => t.id === id), [tasks]);

  const getTasksForStudent = useCallback(
    (studentId: string) => tasks.filter((t) => t.relatedStudentId === studentId),
    [tasks],
  );

  const createTask = useCallback(
    (input: CreateTaskInput): TaskRecord => {
      let created!: TaskRecord;
      updateTasksState((prev) => {
        const id = generateTaskId(prev);
        created = {
          id,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          status: "To Do",
          assignedTo: input.assignedTo,
          assignedToName: input.assignedToName,
          createdBy: CURRENT_DEMO_USER,
          relatedStudentId: input.relatedStudentId ?? null,
          relatedStudentName: input.relatedStudentName ?? null,
          relatedBatch: input.relatedBatch ?? null,
          dueDate: input.dueDate,
          createdAt: new Date().toISOString(),
          startedAt: null,
          sentForReviewAt: null,
          completedAt: null,
          blockedReason: null,
          cancelledReason: null,
          checklist: (input.checklist ?? []).map((label) => ({ id: crypto.randomUUID(), label, done: false })),
          comments: [],
          attachments: [],
          source: "Manual",
          autoTriggerKey: null,
          templateId: null,
          reviewedBy: null,
          reviewNotes: null,
        };
        return [created, ...prev];
      });
      return created;
    },
    [updateTasksState],
  );

  const applyTemplate = useCallback(
    (input: ApplyTemplateInput): TaskRecord[] => {
      const template = TASK_TEMPLATES.find((t) => t.id === input.templateId);
      if (!template) return [];
      const created: TaskRecord[] = [];

      updateTasksState((prev) => {
        let working = [...prev];
        for (const item of template.items) {
          const id = generateTaskId(working);
          const task: TaskRecord = {
            id,
            title: item.title,
            description: item.description,
            category: item.category,
            priority: item.priority,
            status: "To Do",
            assignedTo: input.assignedTo,
            assignedToName: input.assignedToName,
            createdBy: CURRENT_DEMO_USER,
            relatedStudentId: input.relatedStudentId ?? null,
            relatedStudentName: input.relatedStudentName ?? null,
            relatedBatch: input.relatedBatch ?? null,
            dueDate: todayPlus(item.daysFromNow),
            createdAt: new Date().toISOString(),
            startedAt: null,
            sentForReviewAt: null,
            completedAt: null,
            blockedReason: null,
            cancelledReason: null,
            checklist: item.checklist.map((label) => ({ id: crypto.randomUUID(), label, done: false })),
            comments: [],
            attachments: [],
            source: "Template",
            autoTriggerKey: null,
            templateId: template.id,
            reviewedBy: null,
            reviewNotes: null,
          };
          working = [task, ...working];
          created.push(task);
        }
        return working;
      });

      return created;
    },
    [updateTasksState],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Pick<TaskRecord, "title" | "description" | "category" | "priority" | "dueDate">>) => {
      updateTasksState((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [updateTasksState],
  );

  const startTask = useCallback(
    (id: string) => {
      const iso = new Date().toISOString();
      let target: TaskRecord | undefined;
      updateTasksState((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          target = t;
          return { ...t, status: "In Progress" as TaskStatus, startedAt: t.startedAt ?? iso };
        }),
      );
      if (target) logStudentActivity(target, `Task started: ${target.title} (${target.id})`);
    },
    [updateTasksState, logStudentActivity],
  );

  const sendForReview = useCallback(
    (id: string) => {
      const iso = new Date().toISOString();
      let target: TaskRecord | undefined;
      updateTasksState((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          target = t;
          return { ...t, status: "For Review" as TaskStatus, sentForReviewAt: iso };
        }),
      );
      if (target) logStudentActivity(target, `Task sent for review: ${target.title} (${target.id})`);
    },
    [updateTasksState, logStudentActivity],
  );

  const approveAndComplete = useCallback(
    (id: string, reviewNotes?: string) => {
      const iso = new Date().toISOString();
      let target: TaskRecord | undefined;
      updateTasksState((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          target = t;
          return {
            ...t,
            status: "Completed" as TaskStatus,
            completedAt: iso,
            reviewedBy: CURRENT_DEMO_USER,
            reviewNotes: reviewNotes ?? null,
          };
        }),
      );
      if (target) {
        logStudentActivity(target, `Task completed: ${target.title} (${target.id})`);
        dispatchGhlEvent({
          type: "task.completed",
          occurredAt: iso,
          taskId: target.id,
          studentId: target.relatedStudentId ?? undefined,
          summary: `Task completed: ${target.title}`,
        });
      }
    },
    [updateTasksState, logStudentActivity],
  );

  const returnForChanges = useCallback(
    (id: string, reviewNotes: string) => {
      updateTasksState((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, status: "In Progress" as TaskStatus, sentForReviewAt: null, reviewedBy: CURRENT_DEMO_USER, reviewNotes }
            : t,
        ),
      );
    },
    [updateTasksState],
  );

  const markBlocked = useCallback(
    (id: string, reason: string) => {
      updateTasksState((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "Blocked" as TaskStatus, blockedReason: reason } : t)),
      );
    },
    [updateTasksState],
  );

  const unblockTask = useCallback(
    (id: string) => {
      updateTasksState((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "In Progress" as TaskStatus, blockedReason: null } : t)),
      );
    },
    [updateTasksState],
  );

  const cancelTask = useCallback(
    (id: string, reason: string) => {
      updateTasksState((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "Cancelled" as TaskStatus, cancelledReason: reason } : t)),
      );
    },
    [updateTasksState],
  );

  const reassignTask = useCallback(
    (id: string, staffId: string, staffName: string) => {
      updateTasksState((prev) =>
        prev.map((t) => (t.id === id ? { ...t, assignedTo: staffId, assignedToName: staffName } : t)),
      );
    },
    [updateTasksState],
  );

  const toggleChecklistItem = useCallback(
    (taskId: string, itemId: string) => {
      updateTasksState((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                checklist: t.checklist.map((item: TaskChecklistItem) =>
                  item.id === itemId ? { ...item, done: !item.done } : item,
                ),
              }
            : t,
        ),
      );
    },
    [updateTasksState],
  );

  const addComment = useCallback(
    (taskId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      updateTasksState((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                comments: [
                  ...t.comments,
                  { id: crypto.randomUUID(), author: CURRENT_DEMO_USER, text: trimmed, timestamp: new Date().toISOString() },
                ],
              }
            : t,
        ),
      );
    },
    [updateTasksState],
  );

  const addAttachment = useCallback(
    (taskId: string, meta: TaskAttachmentMeta) => {
      updateTasksState((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, attachments: [...t.attachments, meta] } : t)),
      );
    },
    [updateTasksState],
  );

  const value = useMemo<TaskStoreValue>(
    () => ({
      tasks,
      getTaskById,
      getTasksForStudent,
      createTask,
      applyTemplate,
      updateTask,
      startTask,
      sendForReview,
      approveAndComplete,
      returnForChanges,
      markBlocked,
      unblockTask,
      cancelTask,
      reassignTask,
      toggleChecklistItem,
      addComment,
      addAttachment,
    }),
    [
      tasks,
      getTaskById,
      getTasksForStudent,
      createTask,
      applyTemplate,
      updateTask,
      startTask,
      sendForReview,
      approveAndComplete,
      returnForChanges,
      markBlocked,
      unblockTask,
      cancelTask,
      reassignTask,
      toggleChecklistItem,
      addComment,
      addAttachment,
    ],
  );

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>;
}

export function useTaskStore() {
  const ctx = useContext(TaskStoreContext);
  if (!ctx) throw new Error("useTaskStore must be used within a TaskStoreProvider");
  return ctx;
}
