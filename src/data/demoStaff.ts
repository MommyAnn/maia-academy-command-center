// ---------------------------------------------------------------------------
// DEMO DATA ONLY
// ---------------------------------------------------------------------------
// Seed staff records for Step 5 (Staff, Task Management & Operations
// System). None of this is connected to a real HR system or authentication
// backend. IMPORTANT: no real passwords/credentials exist anywhere in this
// build — the demo login (src/context/AuthContext.tsx) always signs the
// visitor in as the Owner regardless of what is typed, and always shows the
// same Owner Dashboard. These staff accounts exist so the Staff, Task, and
// Workload pages have realistic sample data — they are not real, separately
// logged-in accounts yet.
// ---------------------------------------------------------------------------

import type { StaffRecord } from "@/types/staff";
import { ROLE_DEFAULT_PERMISSIONS } from "@/data/staffConfig";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function makeStaff(partial: {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  role: StaffRecord["role"];
  accountStatus?: StaffRecord["accountStatus"];
  dateJoined: string;
  assignedBatches?: StaffRecord["assignedBatches"];
  notes?: string;
}): StaffRecord {
  return {
    id: partial.id,
    staffId: partial.staffId,
    fullName: partial.fullName,
    email: partial.email,
    contactNumber: partial.contactNumber,
    role: partial.role,
    customRoleLabel: "",
    permissions: ROLE_DEFAULT_PERMISSIONS[partial.role],
    accountStatus: partial.accountStatus ?? "Active",
    dateJoined: partial.dateJoined,
    avatarInitials: initials(partial.fullName),
    notes: partial.notes ?? "",
    assignedBatches: partial.assignedBatches ?? [],
    activity: [
      { id: crypto.randomUUID(), action: "Staff account created", date: partial.dateJoined, time: "9:00 AM", by: "Mommy Ann" },
    ],
  };
}

export const DEMO_STAFF: StaffRecord[] = [
  makeStaff({
    id: "staff-owner",
    staffId: "STAFF-000001",
    fullName: "Mommy Ann",
    email: "owner@maiaacademy.demo",
    contactNumber: "0917 100 0001",
    role: "Owner",
    dateJoined: "Jan 2, 2024",
    assignedBatches: ["Batch 14", "Batch 13", "Batch 12"],
  }),
  makeStaff({
    id: "staff-anna",
    staffId: "STAFF-000002",
    fullName: "Anna Reyes",
    email: "anna.reyes@maiaacademy.demo",
    contactNumber: "0917 100 0002",
    role: "Enrollment Officer",
    dateJoined: "Mar 4, 2024",
    assignedBatches: ["Batch 14"],
  }),
  makeStaff({
    id: "staff-jane",
    staffId: "STAFF-000003",
    fullName: "Jane Villareal",
    email: "jane.villareal@maiaacademy.demo",
    contactNumber: "0917 100 0003",
    role: "Student Success Coordinator",
    dateJoined: "Apr 15, 2024",
    assignedBatches: ["Batch 14", "Batch 13"],
  }),
  makeStaff({
    id: "staff-mark",
    staffId: "STAFF-000004",
    fullName: "Mark Dizon",
    email: "mark.dizon@maiaacademy.demo",
    contactNumber: "0917 100 0004",
    role: "Training Coordinator",
    dateJoined: "May 20, 2024",
    assignedBatches: ["Batch 13", "Batch 12"],
  }),
  makeStaff({
    id: "staff-rica",
    staffId: "STAFF-000005",
    fullName: "Rica Manalo",
    email: "rica.manalo@maiaacademy.demo",
    contactNumber: "0917 100 0005",
    role: "Finance Officer",
    dateJoined: "Jun 10, 2024",
    assignedBatches: ["Batch 14", "Batch 13", "Batch 12"],
  }),
  makeStaff({
    id: "staff-paolo",
    staffId: "STAFF-000006",
    fullName: "Paolo Santos",
    email: "paolo.santos@maiaacademy.demo",
    contactNumber: "0917 100 0006",
    role: "Inventory Officer",
    accountStatus: "Inactive",
    dateJoined: "Jul 1, 2024",
    notes: "On extended leave since August 2025.",
  }),
];
