// Configuration + demo seed data for the Student Portal (Step 7).

import type { Announcement } from "@/types/portal";

export const CURRENT_DEMO_USER = "Mommy Ann";

// ---------------------------------------------------------------------------
// DEMO DATA ONLY — sample announcements so the portal has something
// real-looking to render. None of this is connected to a real CMS backend.
// Demo courses now live in src/data/lmsConfig.ts (Step 9's full LMS).
// ---------------------------------------------------------------------------

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-welcome",
    title: "Welcome to M.A.I.A. Business Solutions Academy!",
    message:
      "We're excited to have you on your import business journey. Check your What's Next card on the Home page any time you're unsure what to do next.",
    audienceType: "All Students",
    audienceValue: null,
    pinned: true,
    important: false,
    attachmentLabel: "",
    attachmentUrl: "",
    createdBy: CURRENT_DEMO_USER,
    createdAt: "2026-08-01T09:00:00.000Z",
    date: "Aug 1, 2026",
  },
  {
    id: "ann-b14-orientation",
    title: "Batch 14 Orientation Schedule Released",
    message:
      "Your Batch 14 Orientation is confirmed. Please see My Training for the venue, date, and time, and arrive 30 minutes early for registration.",
    audienceType: "Batch",
    audienceValue: "Batch 14",
    pinned: true,
    important: true,
    attachmentLabel: "",
    attachmentUrl: "",
    createdBy: CURRENT_DEMO_USER,
    createdAt: "2026-09-15T09:00:00.000Z",
    date: "Sep 15, 2026",
  },
  {
    id: "ann-venue-update",
    title: "Venue Update for Face-to-Face Training",
    message:
      "Please note the updated venue for all upcoming Face-to-Face sessions: M.A.I.A. Academy Training Hall, 3rd Floor, Prime Business Center, Makati City.",
    audienceType: "Face-to-Face",
    audienceValue: null,
    pinned: false,
    important: true,
    attachmentLabel: "",
    attachmentUrl: "",
    createdBy: CURRENT_DEMO_USER,
    createdAt: "2026-09-10T09:00:00.000Z",
    date: "Sep 10, 2026",
  },
  {
    id: "ann-zoom-reminder",
    title: "Early Access Zoom Reminder",
    message:
      "For students attending via Zoom: please test your camera and microphone ahead of your scheduled session and keep your Zoom link private.",
    audienceType: "Zoom",
    audienceValue: null,
    pinned: false,
    important: false,
    attachmentLabel: "",
    attachmentUrl: "",
    createdBy: CURRENT_DEMO_USER,
    createdAt: "2026-09-12T09:00:00.000Z",
    date: "Sep 12, 2026",
  },
];

