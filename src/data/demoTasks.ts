// ---------------------------------------------------------------------------
// DEMO DATA ONLY
// ---------------------------------------------------------------------------
// Seed task records for Step 5 (Staff, Task Management & Operations
// System). None of this is connected to a real database. It replaces the
// old placeholder DEMO_STAFF_TASKS in src/data/demoDashboardData.ts, which
// is no longer used by the Owner Dashboard (see src/data/taskStore.tsx).
// ---------------------------------------------------------------------------

import type { TaskRecord } from "@/types/task";
import { DEMO_STAFF } from "@/data/demoStaff";
import { DEMO_STUDENTS } from "@/data/demoStudents";

function findStaff(fullName: string) {
  const s = DEMO_STAFF.find((st) => st.fullName === fullName);
  if (!s) throw new Error(`Demo task data references unknown staff ${fullName}`);
  return s;
}

function findStudent(studentDisplayId: string) {
  const s = DEMO_STUDENTS.find((st) => st.studentId === studentDisplayId);
  return s ?? null;
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeTask(partial: {
  id: string;
  title: string;
  description: string;
  category: TaskRecord["category"];
  priority: TaskRecord["priority"];
  status: TaskRecord["status"];
  assignedTo: string;
  dueOffsetDays: number;
  relatedStudentDisplayId?: string;
  createdOffsetDays?: number;
  source?: TaskRecord["source"];
  checklist?: string[];
  completedOffsetDays?: number;
}): TaskRecord {
  const assignee = findStaff(partial.assignedTo);
  const student = partial.relatedStudentDisplayId ? findStudent(partial.relatedStudentDisplayId) : null;
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - (partial.createdOffsetDays ?? 3));

  return {
    id: partial.id,
    title: partial.title,
    description: partial.description,
    category: partial.category,
    priority: partial.priority,
    status: partial.status,
    assignedTo: assignee.id,
    assignedToName: assignee.fullName,
    createdBy: "Mommy Ann",
    relatedStudentId: student?.id ?? null,
    relatedStudentName: student?.fullName ?? null,
    relatedBatch: student?.batch ?? null,
    relatedLeadId: null,
    relatedLeadName: null,
    dueDate: offsetDate(partial.dueOffsetDays),
    createdAt: createdAt.toISOString(),
    startedAt: partial.status !== "To Do" ? createdAt.toISOString() : null,
    sentForReviewAt: partial.status === "For Review" || partial.status === "Completed" ? createdAt.toISOString() : null,
    completedAt:
      partial.status === "Completed"
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() - (partial.completedOffsetDays ?? 0));
            return d.toISOString();
          })()
        : null,
    blockedReason: partial.status === "Blocked" ? "Waiting on student to resubmit a document." : null,
    cancelledReason: null,
    checklist: (partial.checklist ?? []).map((label) => ({
      id: crypto.randomUUID(),
      label,
      done: partial.status === "Completed",
    })),
    comments: [],
    attachments: [],
    source: partial.source ?? "Manual",
    autoTriggerKey: null,
    templateId: null,
    reviewedBy: partial.status === "Completed" ? "Mommy Ann" : null,
    reviewNotes: null,
  };
}

export const DEMO_TASKS: TaskRecord[] = [
  makeTask({
    id: "TASK-2026-000001",
    title: "Verify Proof of Payment",
    description: "Check the submitted proof of payment against the recorded transaction amount.",
    category: "Payment Verification",
    priority: "High",
    status: "To Do",
    assignedTo: "Anna Reyes",
    dueOffsetDays: 0,
    relatedStudentDisplayId: "MAIA-B14-0002",
    checklist: ["Compare reference number", "Confirm amount matches", "Mark payment verified"],
  }),
  makeTask({
    id: "TASK-2026-000002",
    title: "Review Master Brain Submission",
    description: "Review the student's submitted Master Brain questionnaire.",
    category: "Master Brain",
    priority: "Medium",
    status: "In Progress",
    assignedTo: "Jane Villareal",
    dueOffsetDays: 0,
    relatedStudentDisplayId: "MAIA-B14-0001",
  }),
  makeTask({
    id: "TASK-2026-000003",
    title: "Prepare Certificates for Batch 13",
    description: "Prepare and print certificates for Batch 13 graduates.",
    category: "Certificates",
    priority: "Low",
    status: "To Do",
    assignedTo: "Mark Dizon",
    dueOffsetDays: 1,
  }),
  makeTask({
    id: "TASK-2026-000004",
    title: "Follow up on outstanding balance",
    description: "Reach out to the student regarding their remaining balance.",
    category: "Payment Verification",
    priority: "High",
    status: "To Do",
    assignedTo: "Anna Reyes",
    dueOffsetDays: -2,
    relatedStudentDisplayId: "MAIA-B14-0003",
    createdOffsetDays: 6,
  }),
  makeTask({
    id: "TASK-2026-000005",
    title: "Create Taobao account",
    description: "Create a Taobao account for the newly confirmed student.",
    category: "Taobao",
    priority: "Medium",
    status: "For Review",
    assignedTo: "Jane Villareal",
    dueOffsetDays: -1,
    relatedStudentDisplayId: "MAIA-B13-0006",
    createdOffsetDays: 4,
  }),
  makeTask({
    id: "TASK-2026-000006",
    title: "Confirm F2F venue booking",
    description: "Confirm the venue booking for the next Face-to-Face training event.",
    category: "Event Prep",
    priority: "High",
    status: "Blocked",
    assignedTo: "Mark Dizon",
    dueOffsetDays: 3,
    createdOffsetDays: 5,
  }),
  makeTask({
    id: "TASK-2026-000007",
    title: "Send welcome message to new student",
    description: "Welcome the newly confirmed student and share batch orientation details.",
    category: "Enrollment",
    priority: "Medium",
    status: "Completed",
    assignedTo: "Anna Reyes",
    dueOffsetDays: -3,
    relatedStudentDisplayId: "MAIA-B12-0010",
    createdOffsetDays: 5,
    completedOffsetDays: 2,
  }),
  makeTask({
    id: "TASK-2026-000008",
    title: "Reorder Student ID cards",
    description: "Stock of blank Student ID cards is running low — coordinate reorder with supplier.",
    category: "Inventory",
    priority: "Medium",
    status: "To Do",
    assignedTo: "Paolo Santos",
    dueOffsetDays: 2,
  }),
];
