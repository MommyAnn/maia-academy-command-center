// Configuration + demo seed data for the Free Webinar Lead & Conversion
// System (Step 10). Seed records referencing an existing student are looked
// up by that student's stable display ID (StudentRecord.studentId) rather
// than their internal id — see the matching note in
// src/data/masterBrainConfig.ts for why.

import type {
  FollowUp,
  Lead,
  Reservation,
  WebinarRegistration,
  WebinarSession,
} from "@/types/webinar";
import { blankUtmAttribution } from "@/types/webinar";
import { DEMO_STUDENTS } from "@/data/demoStudents";

export const CURRENT_DEMO_USER = "Mommy Ann";

function findStudentId(studentDisplayId: string): string {
  const student = DEMO_STUDENTS.find((s) => s.studentId === studentDisplayId);
  if (!student) throw new Error(`Demo student not found: ${studentDisplayId}`);
  return student.id;
}

// ---------------------------------------------------------------------------
// DEMO WEBINAR SESSIONS — sample sessions only, the Academy can create
// unlimited future ones (spec section 4).
// ---------------------------------------------------------------------------
function session(input: Omit<WebinarSession, "id" | "createdBy" | "createdAt">): WebinarSession {
  return { ...input, id: crypto.randomUUID(), createdBy: CURRENT_DEMO_USER, createdAt: "2026-08-20T09:00:00+08:00" };
}

export const SESSION_MANUFACTURER_UPCOMING = session({
  sessionId: "WEBR-2026-000001",
  title: "Manufacturer Process Unlock Masterclass",
  type: "Masterclass",
  date: "2026-09-27",
  startTime: "20:00",
  endTime: "21:30",
  platform: "Zoom",
  meetingLink: "https://zoom.us/j/1234567890",
  meetingId: "123 456 7890",
  passcode: "MAIA2026",
  host: "Mommy Ann",
  capacity: 300,
  registrationOpenDate: "2026-09-01",
  registrationCloseDate: "2026-09-27",
  status: "Open for Registration",
  notes: "Weekly flagship free webinar — Saturday 8:00 PM slot.",
});

export const SESSION_MANUFACTURER_PAST = session({
  sessionId: "WEBR-2026-000002",
  title: "Manufacturer Process Unlock Masterclass",
  type: "Masterclass",
  date: "2026-09-13",
  startTime: "20:00",
  endTime: "21:30",
  platform: "Zoom",
  meetingLink: "https://zoom.us/j/1234567891",
  meetingId: "123 456 7891",
  passcode: "MAIA2026",
  host: "Mommy Ann",
  capacity: 300,
  registrationOpenDate: "2026-08-20",
  registrationCloseDate: "2026-09-13",
  status: "Completed",
  notes: "",
});

export const SESSION_AI_TOOLS = session({
  sessionId: "WEBR-2026-000003",
  title: "AI Tools for Online Sellers — Free Training",
  type: "Free Training",
  date: "2026-10-04",
  startTime: "19:00",
  endTime: "20:00",
  platform: "Facebook Live",
  meetingLink: "https://facebook.com/maiaacademy/live",
  meetingId: "",
  passcode: "",
  host: "Rica Manalo",
  capacity: null,
  registrationOpenDate: "2026-09-15",
  registrationCloseDate: "2026-10-04",
  status: "Draft",
  notes: "Pending final confirmation before opening registration.",
});

export const DEMO_WEBINAR_SESSIONS: WebinarSession[] = [SESSION_MANUFACTURER_UPCOMING, SESSION_MANUFACTURER_PAST, SESSION_AI_TOOLS];

// ---------------------------------------------------------------------------
// DEMO LEADS — span the full pipeline. One (Ligaya) has multiple
// registrations across two sessions to demo webinar history (spec 13/23).
// One (Maria Santos) is an already-existing Student registering for a
// webinar, never a duplicate person (spec 43).
// ---------------------------------------------------------------------------
function lead(
  input: Omit<
    Lead,
    "id" | "pipelineHistory" | "activity" | "notes" | "createdAt" | "updatedAt" | "convertedToStudentId" | "convertedAt" | "linkedStudentId"
  > & { linkedStudentId?: string | null },
): Lead {
  const iso = input.firstRegistrationDate;
  return {
    ...input,
    id: crypto.randomUUID(),
    linkedStudentId: input.linkedStudentId ?? null,
    convertedToStudentId: null,
    convertedAt: null,
    pipelineHistory: [{ id: crypto.randomUUID(), fromStatus: null, toStatus: input.status, changedBy: CURRENT_DEMO_USER, changedAt: iso }],
    notes: [],
    activity: [{ id: crypto.randomUUID(), action: "Lead created from webinar registration", date: iso.slice(0, 10), time: "10:00 AM", user: "System" }],
    createdAt: iso,
    updatedAt: iso,
  };
}

export const LEAD_LIGAYA = lead({
  leadId: "LEAD-2026-000001",
  fullName: "Ligaya Torres",
  facebookName: "Ligaya T. Torres",
  email: "ligaya.torres@example.com",
  contactNumber: "0917 555 0101",
  city: "Cebu City",
  businessName: "",
  businessStatus: "Planning to Start a Business",
  businessChallenge: "Don't know how to find a reliable supplier.",
  sellingCurrently: false,
  importationExperience: false,
  timeline: "As Soon As Possible",
  firstRegistrationDate: "2026-09-10T14:00:00+08:00",
  latestWebinarSessionId: SESSION_MANUFACTURER_UPCOMING.id,
  leadSource: "Facebook Ads",
  campaign: "Sept Importation Ad Set A",
  utm: { ...blankUtmAttribution(), utmSource: "facebook", utmMedium: "cpc", utmCampaign: "sept-importation" },
  status: "Considering",
  assignedStaffId: "staff-anna",
  assignedStaffName: "Anna Reyes",
  nextFollowUpDate: "2026-09-23",
  reservation: null,
});

export const LEAD_BENJIE = lead({
  leadId: "LEAD-2026-000002",
  fullName: "Benjie Ramos",
  facebookName: "Benjie R.",
  email: "benjie.ramos@example.com",
  contactNumber: "0918 555 0202",
  city: "Davao City",
  businessName: "Benjie's Online Store",
  businessStatus: "Online Seller",
  businessChallenge: "Margins too thin reselling from local suppliers.",
  sellingCurrently: true,
  importationExperience: false,
  timeline: "Within 30 Days",
  firstRegistrationDate: "2026-09-11T09:30:00+08:00",
  latestWebinarSessionId: SESSION_MANUFACTURER_PAST.id,
  leadSource: "Facebook Organic",
  campaign: "",
  utm: blankUtmAttribution(),
  status: "Reservation Paid",
  assignedStaffId: "staff-anna",
  assignedStaffName: "Anna Reyes",
  nextFollowUpDate: null,
  reservation: {
    id: crypto.randomUUID(),
    amount: 2000,
    method: "GCash",
    referenceNumber: "GC-990211",
    date: "2026-09-15",
    proof: { fileName: "benjie-reservation-gcash.jpg", fileSizeLabel: "0.6 MB", fileType: "image/jpeg", uploadedAt: "2026-09-15T16:00:00+08:00" },
    verificationStatus: "Verified",
    recordedBy: "Anna Reyes",
    verifiedBy: "Mommy Ann",
    verifiedAt: "2026-09-15T18:00:00+08:00",
    createdAt: "2026-09-15T16:00:00+08:00",
    linkedTransactionId: null,
  } satisfies Reservation,
});

export const LEAD_CRISTINA = lead({
  leadId: "LEAD-2026-000003",
  fullName: "Cristina Bautista",
  facebookName: "Cristina B.",
  email: "cristina.bautista@example.com",
  contactNumber: "0919 555 0303",
  city: "Iloilo City",
  businessName: "",
  businessStatus: "New Business Owner",
  businessChallenge: "Not sure which product niche to focus on.",
  sellingCurrently: false,
  importationExperience: false,
  timeline: "Within 3 Months",
  firstRegistrationDate: "2026-09-12T11:00:00+08:00",
  latestWebinarSessionId: SESSION_MANUFACTURER_PAST.id,
  leadSource: "Referral",
  campaign: "",
  utm: blankUtmAttribution(),
  status: "Interested",
  assignedStaffId: "staff-anna",
  assignedStaffName: "Anna Reyes",
  nextFollowUpDate: "2026-09-22",
  reservation: null,
});

export const LEAD_NOEL = lead({
  leadId: "LEAD-2026-000004",
  fullName: "Noel Fernandez",
  facebookName: "Noel F.",
  email: "noel.fernandez@example.com",
  contactNumber: "0920 555 0404",
  city: "Baguio City",
  businessName: "",
  businessStatus: "Interested in Importation",
  businessChallenge: "",
  sellingCurrently: null,
  importationExperience: null,
  timeline: "Just Exploring",
  firstRegistrationDate: "2026-09-13T15:00:00+08:00",
  latestWebinarSessionId: SESSION_MANUFACTURER_PAST.id,
  leadSource: "TikTok",
  campaign: "",
  utm: blankUtmAttribution(),
  status: "Not Contacted",
  assignedStaffId: null,
  assignedStaffName: null,
  nextFollowUpDate: null,
  reservation: null,
});

export const LEAD_PRINCESS = lead({
  leadId: "LEAD-2026-000005",
  fullName: "Princess Villareal",
  facebookName: "Princess V.",
  email: "princess.villareal@example.com",
  contactNumber: "0921 555 0505",
  city: "Cagayan de Oro",
  businessName: "",
  businessStatus: "Existing Business Owner",
  businessChallenge: "Wants to add an imported product line.",
  sellingCurrently: true,
  importationExperience: true,
  timeline: "As Soon As Possible",
  firstRegistrationDate: "2026-09-13T16:30:00+08:00",
  latestWebinarSessionId: SESSION_MANUFACTURER_PAST.id,
  leadSource: "Facebook Group",
  campaign: "",
  utm: blankUtmAttribution(),
  status: "Not Interested",
  assignedStaffId: "staff-jane",
  assignedStaffName: "Jane Villareal",
  nextFollowUpDate: null,
  reservation: null,
});

// Existing Student registering for a free webinar — must never create a
// duplicate person (spec section 43). linkedStudentId points at Maria's
// real StudentRecord; her lead is otherwise a normal Lead record so her
// webinar history is tracked the same way as anyone else's.
export const LEAD_MARIA_EXISTING_STUDENT = lead({
  leadId: "LEAD-2026-000006",
  fullName: "Maria Santos",
  facebookName: "Maria S. Santos",
  email: "maria.santos@example.com",
  contactNumber: "0917 123 4567",
  city: "Quezon City",
  businessName: "",
  businessStatus: "Existing Business Owner",
  businessChallenge: "",
  sellingCurrently: true,
  importationExperience: true,
  timeline: "",
  firstRegistrationDate: "2026-09-13T10:00:00+08:00",
  latestWebinarSessionId: SESSION_MANUFACTURER_PAST.id,
  leadSource: "Existing Student Referral",
  campaign: "",
  utm: blankUtmAttribution(),
  status: "Not Contacted",
  assignedStaffId: null,
  assignedStaffName: null,
  nextFollowUpDate: null,
  reservation: null,
  linkedStudentId: findStudentId("MAIA-B14-0001"),
});

export const DEMO_LEADS: Lead[] = [LEAD_LIGAYA, LEAD_BENJIE, LEAD_CRISTINA, LEAD_NOEL, LEAD_PRINCESS, LEAD_MARIA_EXISTING_STUDENT];

// ---------------------------------------------------------------------------
// DEMO REGISTRATIONS
// ---------------------------------------------------------------------------
function registration(input: Omit<WebinarRegistration, "id" | "createdAt">): WebinarRegistration {
  return { ...input, id: crypto.randomUUID(), createdAt: input.registrationDate };
}

function defaultConsent(date: string) {
  return { registrationCommsConsent: true, marketingConsent: false, consentVersion: "v1.0", consentDate: date };
}

export const DEMO_WEBINAR_REGISTRATIONS: WebinarRegistration[] = [
  // Ligaya: registered for the past session (no-show), then the upcoming one — history preserved (spec 13).
  registration({
    registrationId: "REG-2026-000001",
    leadId: LEAD_LIGAYA.id,
    webinarSessionId: SESSION_MANUFACTURER_PAST.id,
    registrationDate: "2026-09-10T14:00:00+08:00",
    leadSource: LEAD_LIGAYA.leadSource,
    campaign: LEAD_LIGAYA.campaign,
    utm: LEAD_LIGAYA.utm,
    consent: defaultConsent("2026-09-10T14:00:00+08:00"),
    attendanceStatus: "No Show",
    checkInTime: null,
    checkOutTime: null,
    attendanceRecordedBy: "Anna Reyes",
    attendanceNotes: "",
    registeredAsExistingStudent: false,
  }),
  registration({
    registrationId: "REG-2026-000002",
    leadId: LEAD_LIGAYA.id,
    webinarSessionId: SESSION_MANUFACTURER_UPCOMING.id,
    registrationDate: "2026-09-20T09:00:00+08:00",
    leadSource: LEAD_LIGAYA.leadSource,
    campaign: LEAD_LIGAYA.campaign,
    utm: LEAD_LIGAYA.utm,
    consent: defaultConsent("2026-09-20T09:00:00+08:00"),
    attendanceStatus: "Registered",
    checkInTime: null,
    checkOutTime: null,
    attendanceRecordedBy: null,
    attendanceNotes: "",
    registeredAsExistingStudent: false,
  }),
  registration({
    registrationId: "REG-2026-000003",
    leadId: LEAD_BENJIE.id,
    webinarSessionId: SESSION_MANUFACTURER_PAST.id,
    registrationDate: "2026-09-11T09:30:00+08:00",
    leadSource: LEAD_BENJIE.leadSource,
    campaign: LEAD_BENJIE.campaign,
    utm: LEAD_BENJIE.utm,
    consent: defaultConsent("2026-09-11T09:30:00+08:00"),
    attendanceStatus: "Completed Webinar",
    checkInTime: "2026-09-13T20:02:00+08:00",
    checkOutTime: "2026-09-13T21:30:00+08:00",
    attendanceRecordedBy: "Anna Reyes",
    attendanceNotes: "",
    registeredAsExistingStudent: false,
  }),
  registration({
    registrationId: "REG-2026-000004",
    leadId: LEAD_CRISTINA.id,
    webinarSessionId: SESSION_MANUFACTURER_PAST.id,
    registrationDate: "2026-09-12T11:00:00+08:00",
    leadSource: LEAD_CRISTINA.leadSource,
    campaign: LEAD_CRISTINA.campaign,
    utm: LEAD_CRISTINA.utm,
    consent: defaultConsent("2026-09-12T11:00:00+08:00"),
    attendanceStatus: "Attended",
    checkInTime: "2026-09-13T20:05:00+08:00",
    checkOutTime: null,
    attendanceRecordedBy: "Anna Reyes",
    attendanceNotes: "",
    registeredAsExistingStudent: false,
  }),
  registration({
    registrationId: "REG-2026-000005",
    leadId: LEAD_NOEL.id,
    webinarSessionId: SESSION_MANUFACTURER_PAST.id,
    registrationDate: "2026-09-13T15:00:00+08:00",
    leadSource: LEAD_NOEL.leadSource,
    campaign: LEAD_NOEL.campaign,
    utm: LEAD_NOEL.utm,
    consent: defaultConsent("2026-09-13T15:00:00+08:00"),
    attendanceStatus: "No Show",
    checkInTime: null,
    checkOutTime: null,
    attendanceRecordedBy: "Anna Reyes",
    attendanceNotes: "",
    registeredAsExistingStudent: false,
  }),
  registration({
    registrationId: "REG-2026-000006",
    leadId: LEAD_PRINCESS.id,
    webinarSessionId: SESSION_MANUFACTURER_PAST.id,
    registrationDate: "2026-09-13T16:30:00+08:00",
    leadSource: LEAD_PRINCESS.leadSource,
    campaign: LEAD_PRINCESS.campaign,
    utm: LEAD_PRINCESS.utm,
    consent: defaultConsent("2026-09-13T16:30:00+08:00"),
    attendanceStatus: "Left Early",
    checkInTime: "2026-09-13T20:10:00+08:00",
    checkOutTime: "2026-09-13T20:40:00+08:00",
    attendanceRecordedBy: "Jane Villareal",
    attendanceNotes: "Had to leave for a family emergency.",
    registeredAsExistingStudent: false,
  }),
  // Maria Santos — an existing Student registering, linked, never duplicated (spec 43).
  registration({
    registrationId: "REG-2026-000007",
    leadId: LEAD_MARIA_EXISTING_STUDENT.id,
    webinarSessionId: SESSION_MANUFACTURER_PAST.id,
    registrationDate: "2026-09-13T10:00:00+08:00",
    leadSource: LEAD_MARIA_EXISTING_STUDENT.leadSource,
    campaign: "",
    utm: blankUtmAttribution(),
    consent: defaultConsent("2026-09-13T10:00:00+08:00"),
    attendanceStatus: "Completed Webinar",
    checkInTime: "2026-09-13T20:00:00+08:00",
    checkOutTime: "2026-09-13T21:30:00+08:00",
    attendanceRecordedBy: "Anna Reyes",
    attendanceNotes: "Existing Batch 14 student — attended to refer a friend.",
    registeredAsExistingStudent: true,
  }),
];

// ---------------------------------------------------------------------------
// DEMO FOLLOW-UPS
// ---------------------------------------------------------------------------
function followUp(input: Omit<FollowUp, "id" | "createdAt">): FollowUp {
  return { ...input, id: crypto.randomUUID(), createdAt: input.date + "T09:00:00+08:00" };
}

export const DEMO_FOLLOW_UPS: FollowUp[] = [
  followUp({
    followUpId: "FUP-2026-000001",
    leadId: LEAD_LIGAYA.id,
    assignedStaffId: "staff-anna",
    assignedStaffName: "Anna Reyes",
    channel: "Messenger",
    date: "2026-09-23",
    time: "10:00",
    status: "To Do",
    outcome: null,
    notes: "Follow up on reservation decision after the last call.",
    nextFollowUpDate: null,
    createdBy: "Anna Reyes",
    completedAt: null,
  }),
  followUp({
    followUpId: "FUP-2026-000002",
    leadId: LEAD_CRISTINA.id,
    assignedStaffId: "staff-anna",
    assignedStaffName: "Anna Reyes",
    channel: "Phone Call",
    date: "2026-09-22",
    time: "14:00",
    status: "To Do",
    outcome: null,
    notes: "Discuss product niche options.",
    nextFollowUpDate: null,
    createdBy: "Anna Reyes",
    completedAt: null,
  }),
  followUp({
    followUpId: "FUP-2026-000003",
    leadId: LEAD_BENJIE.id,
    assignedStaffId: "staff-anna",
    assignedStaffName: "Anna Reyes",
    channel: "Phone Call",
    date: "2026-09-14",
    time: "13:00",
    status: "Completed",
    outcome: "Reservation Paid",
    notes: "Confirmed reservation, sent payment instructions.",
    nextFollowUpDate: null,
    createdBy: "Anna Reyes",
    completedAt: "2026-09-14T13:20:00+08:00",
  }),
];
