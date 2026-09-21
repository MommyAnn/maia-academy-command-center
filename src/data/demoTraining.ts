// ---------------------------------------------------------------------------
// DEMO DATA ONLY
// ---------------------------------------------------------------------------
// Seed training sessions, session rosters/attendance, and certificate
// records for Step 6. None of this is connected to a real database, a real
// venue, or a real Zoom account. Cross-references DEMO_STUDENTS by
// studentId the same way src/data/demoFinance.ts does.
// ---------------------------------------------------------------------------

import type { CertificateRecord, SessionEnrollment, TrainingSession } from "@/types/training";
import { DEMO_STUDENTS } from "@/data/demoStudents";
import { DEFAULT_PROGRAM_NAME } from "@/data/trainingConfig";

function findStudent(studentDisplayId: string) {
  const s = DEMO_STUDENTS.find((st) => st.studentId === studentDisplayId);
  if (!s) throw new Error(`Demo training data references unknown student ${studentDisplayId}`);
  return s;
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DEMO_SESSIONS: TrainingSession[] = [
  {
    id: "session-b14-orientation",
    sessionId: "TRN-B14-0001",
    title: "Batch 14 Orientation",
    type: "Face-to-Face",
    batch: "Batch 14",
    date: offsetDate(5),
    startTime: "09:00",
    endTime: "12:00",
    venueName: "M.A.I.A. Academy Training Hall",
    venueAddress: "3rd Floor, Prime Business Center, Makati City",
    capacity: 60,
    platform: "",
    zoomLink: "",
    meetingId: "",
    passcode: "",
    trainer: "Mommy Ann",
    assignedStaffIds: ["staff-anna", "staff-mark"],
    materials: [
      { itemId: "item-student-ids", quantity: 5 },
      { itemId: "item-lanyards", quantity: 5 },
      { itemId: "item-training-kits", quantity: 5 },
    ],
    description: "Welcome orientation for newly confirmed Batch 14 students.",
    status: "Scheduled",
    notes: "",
    createdBy: "Mommy Ann",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-b14-zoom1",
    sessionId: "TRN-B14-0002",
    title: "Batch 14 Early Access Zoom Session 1",
    type: "Early Access Zoom",
    batch: "Batch 14",
    date: offsetDate(2),
    startTime: "19:00",
    endTime: "21:00",
    venueName: "",
    venueAddress: "",
    capacity: null,
    platform: "Zoom",
    zoomLink: "https://zoom.example.com/j/demo-session",
    meetingId: "123 456 7890",
    passcode: "maia2026",
    trainer: "Mommy Ann",
    assignedStaffIds: ["staff-jane"],
    materials: [],
    description: "Early access online session for students who chose Zoom attendance.",
    status: "Scheduled",
    notes: "",
    createdBy: "Mommy Ann",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-b13-main",
    sessionId: "TRN-B13-0001",
    title: "Batch 13 Main Training Day",
    type: "Face-to-Face",
    batch: "Batch 13",
    date: "2025-08-10",
    startTime: "08:00",
    endTime: "17:00",
    venueName: "M.A.I.A. Academy Training Hall",
    venueAddress: "3rd Floor, Prime Business Center, Makati City",
    capacity: 60,
    platform: "",
    zoomLink: "",
    meetingId: "",
    passcode: "",
    trainer: "Mommy Ann",
    assignedStaffIds: ["staff-anna", "staff-mark"],
    materials: [
      { itemId: "item-student-ids", quantity: 4 },
      { itemId: "item-lanyards", quantity: 4 },
      { itemId: "item-training-kits", quantity: 4 },
    ],
    description: "Full-day main training event for Batch 13.",
    status: "Completed",
    notes: "",
    createdBy: "Mommy Ann",
    createdAt: "2025-07-01T09:00:00.000Z",
    updatedAt: "2025-08-10T18:00:00.000Z",
  },
  {
    id: "session-b13-masterclass",
    sessionId: "TRN-B13-0002",
    title: "Batch 13 Masterclass",
    type: "Masterclass",
    batch: "Batch 13",
    date: "2025-08-20",
    startTime: "13:00",
    endTime: "17:00",
    venueName: "M.A.I.A. Academy Training Hall",
    venueAddress: "3rd Floor, Prime Business Center, Makati City",
    capacity: 60,
    platform: "",
    zoomLink: "",
    meetingId: "",
    passcode: "",
    trainer: "Mommy Ann",
    assignedStaffIds: ["staff-mark"],
    materials: [{ itemId: "item-certificates", quantity: 4 }],
    description: "Advanced masterclass follow-up session for Batch 13.",
    status: "Completed",
    notes: "",
    createdBy: "Mommy Ann",
    createdAt: "2025-07-15T09:00:00.000Z",
    updatedAt: "2025-08-20T18:00:00.000Z",
  },
  {
    id: "session-b12-main",
    sessionId: "TRN-B12-0001",
    title: "Batch 12 Main Training Day",
    type: "Face-to-Face",
    batch: "Batch 12",
    date: "2025-05-10",
    startTime: "08:00",
    endTime: "17:00",
    venueName: "M.A.I.A. Academy Training Hall",
    venueAddress: "3rd Floor, Prime Business Center, Makati City",
    capacity: 60,
    platform: "",
    zoomLink: "",
    meetingId: "",
    passcode: "",
    trainer: "Mommy Ann",
    assignedStaffIds: ["staff-mark"],
    materials: [],
    description: "Full-day main training event for Batch 12.",
    status: "Completed",
    notes: "",
    createdBy: "Mommy Ann",
    createdAt: "2025-04-01T09:00:00.000Z",
    updatedAt: "2025-05-10T18:00:00.000Z",
  },
];

function enrollment(
  sessionId: string,
  studentDisplayId: string,
  attendanceStatus: SessionEnrollment["attendanceStatus"],
  addedAt: string,
): SessionEnrollment {
  const student = findStudent(studentDisplayId);
  const attended = attendanceStatus === "Present" || attendanceStatus === "Late" || attendanceStatus === "Online Attended";
  return {
    id: crypto.randomUUID(),
    sessionId,
    studentId: student.id,
    eligibility: "Eligible",
    attendanceStatus,
    checkInTime: attended ? `${addedAt}T08:15:00.000Z` : null,
    checkOutTime: null,
    recordedBy: attendanceStatus === "Registered" ? null : "Mommy Ann",
    recordedAt: attendanceStatus === "Registered" ? null : `${addedAt}T08:15:00.000Z`,
    notes: "",
    addedAt,
  };
}

export const DEMO_SESSION_ENROLLMENTS: SessionEnrollment[] = [
  // Batch 14 — upcoming, not yet attended
  enrollment("session-b14-orientation", "MAIA-B14-0001", "Registered", "2025-09-01"),
  enrollment("session-b14-orientation", "MAIA-B14-0002", "Registered", "2025-09-01"),
  enrollment("session-b14-orientation", "MAIA-B14-0003", "Registered", "2025-09-01"),
  enrollment("session-b14-zoom1", "MAIA-B14-0004", "Registered", "2025-09-01"),
  enrollment("session-b14-zoom1", "MAIA-B14-0005", "Registered", "2025-09-01"),

  // Batch 13 — main training day (completed)
  enrollment("session-b13-main", "MAIA-B13-0006", "Present", "2025-08-10"),
  enrollment("session-b13-main", "MAIA-B13-0007", "Present", "2025-08-10"),
  enrollment("session-b13-main", "MAIA-B13-0008", "Late", "2025-08-10"),
  enrollment("session-b13-main", "MAIA-B13-0009", "Absent", "2025-08-10"),

  // Batch 13 — masterclass (completed)
  enrollment("session-b13-masterclass", "MAIA-B13-0006", "Present", "2025-08-20"),
  enrollment("session-b13-masterclass", "MAIA-B13-0007", "Present", "2025-08-20"),
  enrollment("session-b13-masterclass", "MAIA-B13-0008", "Present", "2025-08-20"),
  enrollment("session-b13-masterclass", "MAIA-B13-0009", "Absent", "2025-08-20"),

  // Batch 12 — main training day (completed, strong attendance)
  enrollment("session-b12-main", "MAIA-B12-0010", "Present", "2025-05-10"),
  enrollment("session-b12-main", "MAIA-B12-0011", "Present", "2025-05-10"),
  enrollment("session-b12-main", "MAIA-B12-0012", "Present", "2025-05-10"),
];

function cert(
  id: string,
  studentDisplayId: string,
  status: CertificateRecord["status"],
  extra: Partial<CertificateRecord> = {},
): CertificateRecord {
  const student = findStudent(studentDisplayId);
  return {
    id: crypto.randomUUID(),
    certificateId: id,
    studentId: student.id,
    batch: student.batch,
    program: DEFAULT_PROGRAM_NAME,
    certificateType: "Certificate of Completion",
    completionDate: null,
    issueDate: null,
    status,
    file: null,
    preparedBy: null,
    preparedAt: null,
    issuedBy: null,
    issuedAt: null,
    notes: "",
    reissueOfId: null,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

export const DEMO_CERTIFICATES: CertificateRecord[] = [
  cert("CERT-B12-000001", "MAIA-B12-0010", "Issued", {
    completionDate: "2025-05-10",
    issueDate: "2025-05-20",
    preparedBy: "Mark Dizon",
    preparedAt: "2025-05-12T09:00:00.000Z",
    issuedBy: "Mommy Ann",
    issuedAt: "2025-05-20T09:00:00.000Z",
  }),
  cert("CERT-B12-000002", "MAIA-B12-0011", "Issued", {
    completionDate: "2025-05-10",
    issueDate: "2025-05-20",
    preparedBy: "Mark Dizon",
    preparedAt: "2025-05-12T09:00:00.000Z",
    issuedBy: "Mommy Ann",
    issuedAt: "2025-05-20T09:00:00.000Z",
  }),
  cert("CERT-B12-000003", "MAIA-B12-0012", "Issued", {
    completionDate: "2025-05-10",
    issueDate: "2025-05-20",
    preparedBy: "Mark Dizon",
    preparedAt: "2025-05-12T09:00:00.000Z",
    issuedBy: "Mommy Ann",
    issuedAt: "2025-05-20T09:00:00.000Z",
  }),
  cert("CERT-B13-000001", "MAIA-B13-0006", "Ready", {
    completionDate: "2025-08-20",
    preparedBy: "Mark Dizon",
    preparedAt: "2025-08-22T09:00:00.000Z",
  }),
  cert("CERT-B13-000002", "MAIA-B13-0007", "Ready", {
    completionDate: "2025-08-20",
    preparedBy: "Mark Dizon",
    preparedAt: "2025-08-22T09:00:00.000Z",
  }),
  cert("CERT-B13-000003", "MAIA-B13-0008", "For Preparation", {}),
];
