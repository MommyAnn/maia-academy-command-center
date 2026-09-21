// Configuration + demo seed data for the Student Portal (Step 7).

import type { Announcement, Course } from "@/types/portal";

export const CURRENT_DEMO_USER = "Mommy Ann";

// ---------------------------------------------------------------------------
// DEMO DATA ONLY — sample announcements and courses so the portal has
// something real-looking to render. None of this is connected to a real
// CMS or LMS backend.
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

export const DEMO_COURSES: Course[] = [
  {
    id: "course-importation",
    name: "Importation Fundamentals",
    description: "The foundational course every M.A.I.A. student takes — sourcing basics, logistics, and landed cost.",
    category: "Importation",
    accessRule: { requiresConfirmedEnrollment: true },
  },
  {
    id: "course-sourcing",
    name: "Direct Manufacturer Sourcing Mastery",
    description: "Go straight to the factory — supplier vetting, negotiation, and sample management.",
    category: "Direct Manufacturer Sourcing",
    accessRule: { packages: ["VIP", "Dual VIP"], requiresConfirmedEnrollment: true },
  },
  {
    id: "course-strategy",
    name: "Business Strategy Blueprint",
    description: "Build a business model and roadmap around your imported product line.",
    category: "Business Strategy",
    accessRule: { requiresConfirmedEnrollment: true },
  },
  {
    id: "course-marketing",
    name: "Strategic Marketing Playbook",
    description: "Position and price your products for the Philippine market.",
    category: "Strategic Marketing",
    accessRule: { requiresConfirmedEnrollment: true },
  },
  {
    id: "course-fb-ads",
    name: "Facebook Ads Accelerator",
    description: "Run profitable Facebook ad campaigns for your import business.",
    category: "Facebook Ads",
    accessRule: { packages: ["VIP", "Dual VIP"], requiresConfirmedEnrollment: true },
  },
  {
    id: "course-ai-creatives",
    name: "AI Creatives Workshop",
    description: "Use AI tools to produce ad creatives and product photography at scale.",
    category: "AI Creatives",
    accessRule: { packages: ["Dual VIP"], requiresConfirmedEnrollment: true },
  },
  {
    id: "course-automation",
    name: "Automation Systems",
    description: "Automate order processing, customer replies, and fulfillment workflows.",
    category: "Automation",
    accessRule: { packages: ["Dual VIP"], requiresConfirmedEnrollment: true },
  },
  {
    id: "course-live-selling",
    name: "Live Selling Mastery",
    description: "Run high-converting live selling sessions on Facebook and TikTok.",
    category: "Live Selling",
    accessRule: { requiresConfirmedEnrollment: true },
  },
  {
    id: "course-systems",
    name: "Business Systems & Scaling",
    description: "Put SOPs, team structure, and reporting in place to scale beyond a solo operation.",
    category: "Business Systems",
    accessRule: { packages: ["VIP", "Dual VIP"], requiresConfirmedEnrollment: true },
  },
];
