// Task Management configuration for Step 5: reusable Task Templates and the
// prepared (architecture-only) Automation Rules list. Kept separate from the
// store/UI so a future "Task Templates" / "Automation Rules" settings page
// can read and edit these without any other code changing.

import type { AutomationRule, TaskTemplate } from "@/types/task";

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "template-student-onboarding",
    name: "Student Onboarding",
    description: "Standard checklist run for every newly confirmed student.",
    items: [
      {
        title: "Verify submitted requirements (Valid ID + Proof of Payment)",
        description: "Check both documents against the student's enrollment submission.",
        category: "Requirements",
        priority: "High",
        daysFromNow: 1,
        checklist: ["Valid ID reviewed", "Proof of Payment reviewed", "Requirements marked in profile"],
      },
      {
        title: "Create Taobao account",
        description: "Set up the student's Taobao account once requirements are verified.",
        category: "Taobao",
        priority: "Medium",
        daysFromNow: 3,
        checklist: ["Account created", "Login details ready"],
      },
      {
        title: "Send welcome message + batch orientation details",
        description: "Welcome the student and share batch schedule/orientation info.",
        category: "Enrollment",
        priority: "Medium",
        daysFromNow: 1,
        checklist: ["Welcome message sent", "Orientation details shared"],
      },
    ],
  },
  {
    id: "template-f2f-event-prep",
    name: "F2F Event Prep",
    description: "Preparation checklist for an upcoming Face-to-Face training event.",
    items: [
      {
        title: "Confirm venue booking",
        description: "Confirm the training venue is booked and paid for.",
        category: "Event Prep",
        priority: "High",
        daysFromNow: 14,
        checklist: ["Venue confirmed", "Deposit paid"],
      },
      {
        title: "Prepare student IDs and lanyards",
        description: "Coordinate with Inventory to prepare IDs/lanyards for all confirmed attendees.",
        category: "Inventory",
        priority: "Medium",
        daysFromNow: 7,
        checklist: ["ID count confirmed", "Lanyards prepared"],
      },
      {
        title: "Prepare training materials and handouts",
        description: "Print/prepare all training-day materials.",
        category: "Training",
        priority: "Medium",
        daysFromNow: 5,
        checklist: ["Materials printed", "Handouts packed"],
      },
      {
        title: "Send event reminder to attendees",
        description: "Send a reminder with venue, schedule, and requirements.",
        category: "Marketing",
        priority: "Medium",
        daysFromNow: 2,
        checklist: ["Reminder sent"],
      },
    ],
  },
  {
    id: "template-zoom-early-access",
    name: "Zoom Early Access",
    description: "Preparation checklist for students attending via Early Access Zoom.",
    items: [
      {
        title: "Send Zoom link and access schedule",
        description: "Share the Zoom meeting link and early-access schedule.",
        category: "Training",
        priority: "High",
        daysFromNow: 2,
        checklist: ["Zoom link sent", "Schedule confirmed"],
      },
      {
        title: "Test student's Zoom access",
        description: "Do a quick connectivity/access test before the session.",
        category: "Training",
        priority: "Medium",
        daysFromNow: 1,
        checklist: ["Access tested"],
      },
    ],
  },
];

/**
 * Prepared, reusable Automation Rules — architecture only (see
 * src/types/task.ts AutomationRule doc comment). This build's actual
 * automatic task creation runs on hardcoded checks in
 * src/data/taskStore.tsx; this list exists so a future settings page has a
 * ready shape to read/toggle without other code changing.
 */
export const AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "rule-new-enrollment",
    label: "New Enrollment Submitted",
    triggerEvent: "A student submits the public Enrollment Form",
    categoryCreated: "Enrollment",
    enabled: true,
    description: "Creates a task to verify the student's requirements.",
  },
  {
    id: "rule-payment-submitted",
    label: "Payment Submitted for Verification",
    triggerEvent: "A payment transaction is recorded as Pending Verification",
    categoryCreated: "Payment Verification",
    enabled: true,
    description: "Creates a task to verify the recorded payment.",
  },
  {
    id: "rule-valid-id-uploaded",
    label: "Valid ID Uploaded",
    triggerEvent: "A student's Valid ID requirement is still Pending review",
    categoryCreated: "Requirements",
    enabled: true,
    description: "Creates a task to review the uploaded Valid ID.",
  },
  {
    id: "rule-fully-paid",
    label: "Student Fully Paid",
    triggerEvent: "A student's payment status becomes Fully Paid",
    categoryCreated: "Enrollment",
    enabled: true,
    description: "Creates a task to confirm the student's slot and proceed with onboarding.",
  },
  {
    id: "rule-taobao-required",
    label: "Taobao Account Required",
    triggerEvent: "A confirmed student's Taobao status is still Not Yet Created",
    categoryCreated: "Taobao",
    enabled: true,
    description: "Creates a task to create the student's Taobao account.",
  },
  {
    id: "rule-master-brain-submitted",
    label: "Master Brain Submitted",
    triggerEvent: "A student's Master Brain status becomes Submitted",
    categoryCreated: "Master Brain",
    enabled: true,
    description: "Creates a task for Master Brain review.",
  },
  {
    id: "rule-master-brain-approved",
    label: "Master Brain Approved",
    triggerEvent: "A student's Master Brain status becomes Completed",
    categoryCreated: "Certificates",
    enabled: true,
    description: "Creates a task to prepare the student's certificate.",
  },
  {
    id: "rule-training-completed",
    label: "Training Completed",
    triggerEvent: "A student reaches the Completed enrollment stage",
    categoryCreated: "Certificates",
    enabled: true,
    description: "Creates a task to release the student's certificate and close out their file.",
  },
];
