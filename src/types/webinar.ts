// Free Group Webinar Lead, Registration, Attendance, Follow-up & Conversion
// System domain types — Step 10. Backed by demo/local state — see
// src/data/webinarStore.tsx.
//
// CORE RULE: a webinar registrant is a LEAD/PROSPECT, never an official
// Student. A Lead only becomes a StudentRecord through an explicit
// "Convert to Student" action (see convertLeadToStudent in
// src/data/webinarStore.tsx) — nothing here auto-creates a student.
//
// ONE LEAD, MANY REGISTRATIONS: Lead and WebinarRegistration are separate
// records on purpose. The same person registering for a second webinar
// updates/links to their existing Lead — it never creates a second Lead,
// and it never overwrites a previous registration's history.

import type { Batch, PackageType, StudentRecord, UploadedFileMeta } from "@/types/student";
import type { PaymentMethod } from "@/types/finance";

export type WebinarType = "Masterclass" | "Free Training" | "Live Q&A" | "Product Launch" | "Orientation" | "Other";

export const WEBINAR_TYPES: WebinarType[] = ["Masterclass", "Free Training", "Live Q&A", "Product Launch", "Orientation", "Other"];

export type WebinarPlatform = "Zoom" | "Facebook Live" | "Google Meet" | "YouTube Live" | "Other";

export const WEBINAR_PLATFORMS: WebinarPlatform[] = ["Zoom", "Facebook Live", "Google Meet", "YouTube Live", "Other"];

export type WebinarSessionStatus = "Draft" | "Open for Registration" | "Registration Closed" | "Ongoing" | "Completed" | "Cancelled";

export const WEBINAR_SESSION_STATUSES: WebinarSessionStatus[] = [
  "Draft",
  "Open for Registration",
  "Registration Closed",
  "Ongoing",
  "Completed",
  "Cancelled",
];

/**
 * The Academy can create unlimited future sessions — nothing about this
 * shape assumes a single named webinar (spec section 4).
 */
export interface WebinarSession {
  id: string;
  sessionId: string; // e.g. WEBR-2026-000001
  title: string;
  type: WebinarType;
  date: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  platform: WebinarPlatform;
  meetingLink: string;
  meetingId: string;
  passcode: string;
  host: string;
  capacity: number | null; // optional
  registrationOpenDate: string | null;
  registrationCloseDate: string | null;
  status: WebinarSessionStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export type BusinessStatus =
  | "Planning to Start a Business"
  | "New Business Owner"
  | "Existing Business Owner"
  | "Online Seller"
  | "Reseller"
  | "Interested in Importation"
  | "Other";

export const BUSINESS_STATUSES: BusinessStatus[] = [
  "Planning to Start a Business",
  "New Business Owner",
  "Existing Business Owner",
  "Online Seller",
  "Reseller",
  "Interested in Importation",
  "Other",
];

export type StartTimeline = "As Soon As Possible" | "Within 30 Days" | "Within 3 Months" | "Just Exploring";

export const START_TIMELINES: StartTimeline[] = ["As Soon As Possible", "Within 30 Days", "Within 3 Months", "Just Exploring"];

export type LeadSource =
  | "Facebook Ads"
  | "Facebook Organic"
  | "Facebook Group"
  | "Messenger"
  | "Referral"
  | "TikTok"
  | "Website"
  | "Existing Student Referral"
  | "Walk-in"
  | "Other";

export const LEAD_SOURCES: LeadSource[] = [
  "Facebook Ads",
  "Facebook Organic",
  "Facebook Group",
  "Messenger",
  "Referral",
  "TikTok",
  "Website",
  "Existing Student Referral",
  "Walk-in",
  "Other",
];

/** Optional attribution — never required for a manual/walk-in registration (spec section 39). */
export interface UtmAttribution {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  facebookCampaignId: string;
  facebookAdSetId: string;
  facebookAdId: string;
}

export function blankUtmAttribution(): UtmAttribution {
  return {
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    facebookCampaignId: "",
    facebookAdSetId: "",
    facebookAdId: "",
  };
}

/** The exact operational sales stages (spec section 20) — not a generic CRM status list. */
export type LeadStatus =
  | "Not Contacted"
  | "Follow-up Needed"
  | "Interested"
  | "Considering"
  | "Reservation Paid"
  | "Enrolled"
  | "Not Interested"
  | "No Response";

export const LEAD_STATUSES: LeadStatus[] = [
  "Not Contacted",
  "Follow-up Needed",
  "Interested",
  "Considering",
  "Reservation Paid",
  "Enrolled",
  "Not Interested",
  "No Response",
];

/** Ordered pipeline columns for the Kanban board — "No Response" is a filter/queue concept, not its own column (spec sections 20-21). */
export const PIPELINE_COLUMNS: LeadStatus[] = [
  "Not Contacted",
  "Follow-up Needed",
  "Interested",
  "Considering",
  "Reservation Paid",
  "Enrolled",
  "Not Interested",
];

export interface LeadPipelineHistoryEntry {
  id: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  changedBy: string;
  changedAt: string;
}

export interface LeadNote {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface LeadActivityEntry {
  id: string;
  action: string;
  date: string;
  time: string;
  user: string;
}

export type ReservationVerificationStatus = "Pending Verification" | "Verified" | "Rejected";

/**
 * A pre-conversion reservation payment. A Lead has no StudentRecord yet, so
 * this can't be a real PaymentTransaction (which requires one) — it lives
 * here until conversion, at which point convertLeadToStudent() creates the
 * REAL PaymentTransaction via financeStore.recordPayment() and this record
 * is linked to it via `linkedTransactionId`, never duplicated (spec section
 * 32/34).
 */
export interface Reservation {
  id: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  date: string;
  proof: UploadedFileMeta | null;
  verificationStatus: ReservationVerificationStatus;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  /** Set once conversion creates the real PaymentTransaction for this reservation. */
  linkedTransactionId: string | null;
}

/**
 * Registration-communication consent and marketing consent are kept
 * separate on purpose (spec section 8) — registering for a webinar never
 * implies blanket marketing permission.
 */
export interface WebinarConsent {
  registrationCommsConsent: boolean;
  marketingConsent: boolean;
  consentVersion: string;
  consentDate: string;
}

export const WEBINAR_CONSENT_VERSION = "v1.0";

/** Placeholder wording only — final legal review required before production (spec section 8). */
export const REGISTRATION_COMMS_CONSENT_STATEMENT =
  "I agree to receive messages from M.A.I.A. Academy about this webinar, including reminders and related updates.";
export const WEBINAR_MARKETING_CONSENT_STATEMENT =
  "I'd also like to receive occasional marketing and promotional messages from M.A.I.A. Academy.";

/**
 * The person — stable across every webinar they ever register for. Never
 * re-created on a repeat registration (spec sections 10-13).
 */
export interface Lead {
  id: string;
  leadId: string; // e.g. LEAD-2026-000001
  fullName: string;
  facebookName: string;
  email: string;
  contactNumber: string;
  city: string;
  businessName: string;
  businessStatus: BusinessStatus;
  businessChallenge: string;
  sellingCurrently: boolean | null;
  importationExperience: boolean | null;
  timeline: StartTimeline | "";
  firstRegistrationDate: string;
  latestWebinarSessionId: string | null;
  leadSource: LeadSource;
  campaign: string;
  utm: UtmAttribution;
  status: LeadStatus;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  nextFollowUpDate: string | null;
  reservation: Reservation | null;
  notes: LeadNote[];
  pipelineHistory: LeadPipelineHistoryEntry[];
  activity: LeadActivityEntry[];
  /** Set only when this lead is recognized as an already-existing Student registering for a free webinar (spec section 43) — never duplicated into a second person record. */
  linkedStudentId: string | null;
  /** Set only after Convert to Student succeeds (spec section 33-35). */
  convertedToStudentId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RegistrationAttendanceStatus = "Registered" | "Attended" | "Completed Webinar" | "Left Early" | "No Show" | "Cancelled";

export const REGISTRATION_ATTENDANCE_STATUSES: RegistrationAttendanceStatus[] = [
  "Registered",
  "Attended",
  "Completed Webinar",
  "Left Early",
  "No Show",
  "Cancelled",
];

/**
 * One registration per lead per session. History across sessions is never
 * overwritten (spec section 13/23) — each WebinarRegistration is its own
 * permanent record.
 */
export interface WebinarRegistration {
  id: string;
  registrationId: string; // e.g. REG-2026-000001
  leadId: string;
  webinarSessionId: string;
  registrationDate: string;
  leadSource: LeadSource;
  campaign: string;
  utm: UtmAttribution;
  consent: WebinarConsent;
  attendanceStatus: RegistrationAttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  attendanceRecordedBy: string | null;
  attendanceNotes: string;
  /** True when this registration was created for an already-existing Student (spec section 43), never a duplicate Lead. */
  registeredAsExistingStudent: boolean;
  createdAt: string;
}

export type FollowUpChannel = "Phone Call" | "Messenger" | "SMS" | "Email" | "WhatsApp" | "Viber" | "Other";

export const FOLLOW_UP_CHANNELS: FollowUpChannel[] = ["Phone Call", "Messenger", "SMS", "Email", "WhatsApp", "Viber", "Other"];

export type FollowUpStatus = "To Do" | "Completed" | "No Response" | "Rescheduled" | "Cancelled";

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = ["To Do", "Completed", "No Response", "Rescheduled", "Cancelled"];

export type FollowUpOutcome =
  | "Interested"
  | "Considering"
  | "Reservation Paid"
  | "Enrolled"
  | "Not Interested"
  | "Needs Another Follow-up"
  | "No Response";

export const FOLLOW_UP_OUTCOMES: FollowUpOutcome[] = [
  "Interested",
  "Considering",
  "Reservation Paid",
  "Enrolled",
  "Not Interested",
  "Needs Another Follow-up",
  "No Response",
];

export interface FollowUp {
  id: string;
  followUpId: string; // e.g. FUP-2026-000001
  leadId: string;
  assignedStaffId: string;
  assignedStaffName: string;
  channel: FollowUpChannel;
  date: string;
  time: string;
  status: FollowUpStatus;
  outcome: FollowUpOutcome | null;
  notes: string;
  nextFollowUpDate: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

/** Public registration form submission shape. */
export interface WebinarRegistrationSubmission {
  fullName: string;
  facebookName: string;
  email: string;
  contactNumber: string;
  city: string;
  businessStatus: BusinessStatus;
  businessName: string;
  businessChallenge: string;
  sellingCurrently: boolean | null;
  importationExperience: boolean | null;
  timeline: StartTimeline | "";
  webinarSessionId: string;
  leadSource: LeadSource;
  campaign: string;
  utm: UtmAttribution;
  registrationCommsConsent: boolean;
  marketingConsent: boolean;
}

/** Input for converting a qualified Lead into a real Student (spec section 34). */
export interface ConvertLeadToStudentInput {
  batch: Batch;
  package: PackageType;
  attendance: StudentRecord["attendance"];
  enrollmentDate: string;
  companionName: string;
}

/** Lightweight row shape the duplicate-detection helper returns (spec section 12). */
export interface DuplicateMatchResult {
  matchedLead: Lead | null;
  matchedStudent: StudentRecord | null;
  confidence: "exact" | "uncertain" | "none";
  matchedOn: ("email" | "contactNumber")[];
}
