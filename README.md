# M.A.I.A. Academy Command Center

Business management web application for **Mommy Ann Import Academy / M.A.I.A.
Business Solutions Academy**.

> **Step 11 of the build:** M.A.I.A. Communications, Follow-Up Automation &
> GoHighLevel Integration, on top of Step 1 (Login + App Shell), Step 2
> (Enrollment Form + Student Records + Student Profile), Step 3 (Finance &
> Payment Management), Step 4 (Owner Executive Dashboard & Business
> Analytics), Step 5 (Staff, Task Management & Operations System), Step 6
> (Inventory, Training, Attendance & Certificate Operations), Step 7 (the
> complete Student Portal), Step 8 (the M.A.I.A. Brand Master Brain
> Builder), Step 9 (Course Access + LMS + Global Feedback & Testimonial
> System), and Step 10 (the Free Group Webinar Lead, Registration,
> Attendance, Follow-up & Conversion System). All data is DEMO/LOCAL DATA
> and is not connected to a real database, authentication system, AI API,
> video hosting, file storage, or a real GoHighLevel/SMS/email backend yet.

## Tech Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [React Router](https://reactrouter.com/) for client-side routing
- [Tailwind CSS v4](https://tailwindcss.com/) for styling (brand theme: black / gold / warm white)
- [Recharts](https://recharts.org/) for charts (Dashboard + Finance Reports)
- [lucide-react](https://lucide.dev/) for icons

## Getting Started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically **http://localhost:5173**) in your
browser.

### Demo Login (Owner / Staff / Student)

The login page uses **demo authentication only** — no real accounts or
passwords are checked; any non-empty password works. The email you enter
decides which demo session you land in:

- A seeded **student** email (e.g. `maria.santos@example.com`, see
  `src/data/demoStudents.ts`) signs you into the **Student Portal**
  (`/portal`) as that student.
- A seeded **staff** email (e.g. `anna.reyes@maiaacademy.demo`, see
  `src/data/demoStaff.ts`) signs you into that staff member's **Staff
  Dashboard Preview**.
- Any other email (including the Owner demo email) signs you in as
  **Owner**, landing on the Command Center Dashboard.

This role resolution happens entirely in the browser for this demo — see
the Step 7 security note below for why that is not sufficient on its own in
production.

### Public Enrollment Form

Visit **`/enroll`** directly (no login required) to fill out the Student
Enrollment Form. A submission is saved to this browser's local demo student
store and immediately becomes visible in the admin's **New Enrollments**
and **All Students** pages.

### Other commands

```bash
npm run build     # Type-check and build for production into dist/
npm run preview   # Preview the production build locally
npm run lint      # Run oxlint
```

## Project Structure

```
src/
  pages/                Route-level pages (Login, Dashboard, EnrollmentForm, ...)
  pages/students/        Student Management pages (AllStudents, NewEnrollments, Batches, StudentProfile)
  pages/finance/          Finance pages (Overview, Payments, Receivables, Expenses, Reports)
  pages/team/             Staff & Task Management pages (StaffManagement, StaffProfile,
                        StaffDashboardPreview, TaskManagement, TaskDetail, TeamCalendar,
                        Workload, ActivityLog)
  pages/inventory/        Inventory pages (AllItems, StockIn, StockOut, LowStock,
                        Suppliers, InventoryHistory)
  pages/training/         Training/Attendance/Certificate pages (TrainingSessions,
                        SessionDetail, Attendance, Certificates)
  pages/communication/    Admin-side Announcements + Support Requests pages
  pages/portal/          Student Portal pages (Home, Enrollment, Payments, Requirements,
                        Taobao, MasterBrain, Training, Courses, CoursePage, LessonPlayer,
                        Certificates, Feedback, FeedbackSubmit, Announcements, Profile,
                        Support) — same components render both a real student's own
                        session and the admin "View As Student" preview
  pages/portal/masterBrain/  The 12-step Brand Master Brain questionnaire wizard
  pages/masterbrain/      Admin Master Brain Dashboard (Overview, Submissions,
                        SubmissionDetail, DocumentEditor, Templates)
  pages/courses/          Admin Course/LMS pages (Library, CourseBuilder, CourseManage,
                        StudentAccess, Progress, Resources)
  pages/feedback/         Admin Global Feedback pages (Overview, Requests, AllFeedback,
                        FeedbackDetail, MarketingLibrary, Incentives, Settings)
  layouts/              App shell layouts (AppLayout for Admin/Staff, PortalLayout for
                        the Student Portal — sidebar + header + content in each)
  components/
    layout/             Sidebar, SidebarDrawer, TopHeader, NotificationsDropdown
    dashboard/          Dashboard-specific cards (KPI cards, charts, tables, ...)
    enrollment/         Public Enrollment Form steps, file upload UI, terms modal
    students/           Student list filters, status badges, Student Profile tabs
                        (including the Portal tab: access controls + update requests,
                        and the Master Brain tab linking into the review pipeline)
    finance/            Payment/expense/adjustment modals, finance stat cards & filters
    team/               Staff/task modals (StaffFormModal, TaskFormModal, ReassignModal,
                        ApplyTemplateModal), PermissionsMatrixView, TaskFiltersBar, status meta
    inventory/          Item/Stock In/Stock Out/Supplier modals + detail views, status meta
    training/           Session form modal, status meta for sessions/attendance/certificates
    portal/             Student Portal sidebar/header, notifications, status meta, the
                        published Master Brain document viewer — shared by the real portal
                        and the admin preview
    portal/masterBrainSteps/  The 12 questionnaire step components + shared repeatable-list
                        editor, reused by the wizard
    common/             Reusable UI primitives (Card, Button, Modal, Tabs, TextField,
                        TextAreaField, ChipMultiSelect, ConfirmDialog, ...)
  context/               AuthContext (demo authentication + role resolution) and
                        StudentPortalContext (which student a portal page is currently
                        showing — real session or admin preview)
  router/                AppRoutes, ProtectedRoute (admin/staff), StudentProtectedRoute
  data/                  DEMO DATA, config, and the local student/finance/staff/task/
                        inventory/training/portal/masterBrain/lms/feedback stores — kept
                        separate from UI so real API/DB calls can replace them later
  integrations/          Prepared, hooks-only integration points (e.g. GoHighLevel) — not
                        connected to any real external service yet
  types/                 Shared TypeScript types/interfaces
  utils/                 Formatting, ID generation, and finance/task/inventory/training/
                        portal/masterBrain calculation helpers
```

## Data & Persistence Notice (Important)

There is still no real backend in this build. The student store
(`src/data/studentStore.tsx`) and finance store (`src/data/financeStore.tsx`)
keep records in React state and mirror them to **this browser's
`localStorage`** only, so a public Enrollment Form submission or a recorded
payment shows up across the admin pages during a demo session. This is
explicitly **not** production persistence:

- Not shared across devices, browsers, or real users.
- Not encrypted, backed up, or access-controlled.
- Cleared if browser data/storage is cleared.
- Uploaded "documents" / "proof of payment" / "receipts" are **never
  stored** — only filename/size/type metadata is kept, since no secure file
  storage backend exists yet.

A real database and secure file storage will replace these stores in a
later step without requiring changes to the pages/components that consume
them.

## Core Finance Principle

A student's "amount paid" is **never** a single editable field. Every peso
received is its own `PaymentTransaction` record (e.g. `PAY-B14-000001`).
Total paid, remaining balance, and payment status (Unpaid / Partial
Payment / Fully Paid / Pending Verification) are always **calculated live**
from the ledger of transactions — see `src/utils/finance.ts`. Rejecting or
voiding never deletes a record; it's marked and kept in history.

## What's Included in Step 11

**M.A.I.A. Communications, Follow-Up Automation & GoHighLevel Integration.**
See `src/types/communications.ts` / `src/data/communicationsStore.tsx` for
the domain model and automation engine. **Core architecture, enforced in
code, not just described:** M.A.I.A. remains the operational source of
truth (students, payments, course progress, attendance, Master Brain,
private documents/feedback, inventory, certificates) — GHL is only ever the
communication/follow-up/marketing engine. **No real GoHighLevel connection
exists anywhere in this build** — every "sync" and "send" below is
SIMULATED and honestly labeled (`provider: "GHL (Simulated)"`), never
claimed as a real delivery.

- **New Communications sidebar section** (9 pages): Communication Center,
  Automation Center, Automation Rules, GHL Integration, Contact Sync,
  Message Templates, Communication Logs, Sync Logs, Integration Settings.
- **The automation engine is real, not decorative.** `dispatchGhlEvent()`
  (the "prepared hook" every Step 5–10 store already calls — 17+ call
  sites, unchanged) now feeds a lightweight pub/sub
  (`subscribeToGhlEvents` in `src/integrations/ghlEvents.ts`) that
  `communicationsStore` subscribes to on mount. When an event matches an
  Active `AutomationRule`'s trigger, its actions (Sync to GHL / Apply Tag /
  Remove Tag / Start GHL Workflow / Send Communication) actually execute
  and get logged — verified end-to-end via Playwright (moving a Lead to
  "Interested" produces a real new Sync Log + Communication Log entry
  through the seeded "Interested Lead Follow-Up" rule).
- **Idempotency, for real.** Every rule execution is keyed by
  `ruleId + eventType + person + occurredAt` (`buildAutomationIdempotencyKey`
  in `src/utils/communications.ts`) so the exact same event can never fire
  the same rule's actions twice — verified by re-triggering the identical
  transition and confirming no duplicate log entries, while a genuinely new
  occurrence still fires normally.
- **New, previously-missing event wiring** (spec sections 23-24's "never
  trigger Fully Paid merely because proof was uploaded"): `financeStore.
  verifyPayment()` now dispatches `student.payment_verified`, then
  `student.fully_paid` **only** if the derived payment status (never a
  manually-set field) actually becomes Fully Paid. `studentStore.
  updateEnrollmentStatus`/`createStudentFromLead` dispatch `student.
  enrolled`. `webinarStore.verifyReservation()` dispatches the new
  `lead.reservation_verified` (distinct from the existing `lead.
  reservation_paid`, which fires at record time for tagging) so "Complete
  Your Enrollment" only starts after real verification. `masterBrainStore.
  publish()` dispatches `masterbrain.published`. `studentStore.
  updateDocumentStatus()` dispatches the new `requirements.completed` once
  both Valid ID and Proof of Payment are Verified.
- **GHL Contact Sync** (`/communications/contact-sync`) — one record per
  Lead/Student, matched by internal ID (never name alone). Converting a
  Lead to a Student **reuses the same simulated GHL Contact ID** rather
  than creating a second one (`performSync` in `communicationsStore.tsx`
  checks the source Lead's sync record via `StudentRecord.leadId`).
  Duplicate contacts are never silently merged — an admin can flag/unflag
  "Possible Duplicate" explicitly.
- **Communication Preferences / Consent / DND** — tracked per person
  (Email/SMS/WhatsApp/Marketing/Operational allowed, independently — one
  channel's consent is never treated as blanket permission), with an
  opt-out date and consent source/date. `checkChannelEligibility()` gates
  every Send Communication action, automatic or manual; an opted-out
  contact is recorded as **Skipped**, never silently dropped or faked as
  sent.
- **Tag / Field / Workflow Mapping** (`/communications/settings`) — fully
  admin-editable tables (extends the Step 10 static `ghlTagMapping.ts`
  placeholder into real, configurable state), plus a fixed, non-editable
  **Sync Authority** reference table (Finance/Course Progress/Attendance/
  Master Brain Status always M.A.I.A.-wins; GHL DND may update M.A.I.A.'s
  communication preference; contact phone/email direction is configurable)
  — GHL can never overwrite a verified Academy record.
- **Automation Center + Automation Rules** — a categorized dashboard over
  the same `AutomationRule` records the Rules page manages (never a
  duplicate list), plus a WHEN/IF/DO/STOP-WHEN rule builder — 14 seeded
  rules span Webinar, Leads, Enrollment, Payment, Requirements, Courses,
  Master Brain, Feedback and Certificates. Deliberately **not** a GHL
  Workflow Builder clone — M.A.I.A.-specific business rules only, and
  "Create Task" is intentionally never an available action (Step 10's
  `taskStore.tsx` already owns webinar/lead staff-task automation; adding
  it here would double-create tasks for the same event).
- **Message Templates** (`/communications/templates`) — CRUD across 12
  categories/4 channels, only approved `{{variable}}` tokens (never a
  sensitive field like a password), and a live **Preview** against a real
  sample Lead/Student that resolves every variable and flags any
  **MISSING VARIABLE** before activation.
- **Communication Log & Sync Log** — every automatic and manual
  send/sync is recorded honestly: `Sent`/`Success` only for what actually
  "went through" in this simulated build, `Skipped` for a consent/DND
  block, `Failed` for a Disconnected-mode attempt — never a fabricated
  `Delivered`/`Read` status. Sync Logs support **Retry** (bounded by a
  configurable retry limit, after which a repeatedly-failing sync becomes
  **Needs Review** rather than looping forever) and **Resolve**.
- **Lead Profile & Student Profile → Communications tab** — one shared
  `CommunicationsPanel` component reads the exact same Communication Log
  records for both, plus a **Send Message** action (channel/template
  picker, consent/DND eligibility shown before sending).
- **Inbound webhook simulator** (`/communications/ghl-integration`) — no
  real webhook endpoint exists, but the simulator demonstrates the
  idempotent-processing architecture a real one would need: a re-delivered
  event with the same simulated webhook ID is detected and marked
  **Duplicate — Skipped**, never double-processed.
- **Integration Mode** (Disconnected / Test-Sandbox / Production) — starts
  Disconnected and clearly banners "GHL NOT CONNECTED" rather than faking
  success; no field for a real API token/secret exists anywhere in this
  frontend (spec section 49) — a production build must store credentials
  server-side only.
- **Owner Dashboard & Action Center** — a compact "Communications &
  Automation" card (Follow-ups Due / Automations Active / Communication
  Failures / GHL Sync Errors) plus two new Action Center tiles; new
  Notifications for GHL sync failures, sync records needing review, failed
  automation rules, a high communication-failure count, and unverified
  webhook deliveries.
- **New staff task automations** (`src/data/taskStore.tsx`, spec section
  64) — a failed communication creates a review task; a failed **Payment**-
  category automated communication specifically creates a Finance
  follow-up task for manual contact; a Sync Log stuck at "Needs Review"
  creates a review task for an Administrator. All deduped by
  `autoTriggerKey`, exactly like every other Step 5/10 automatic task.
- **Role permissions** — new `"Communications"` / `"Communications -
  Templates"` / `"Communications - Automation"` / `"Communications - GHL
  Integration"` modules, with defaults for Enrollment Officer, Finance
  Officer, Training Coordinator and Marketing Staff mirroring the
  Step 9/10 private-vs-marketing split pattern; Students have no access to
  any of it (the entire staff permission system never applies to the
  Student role).
- **Activity Log** gained a "Communications" category sourced from the
  real Communication Log / Sync Log / Automation Rule records.

## What's Included in Step 10

**Free Group Webinar Lead, Registration, Attendance, Follow-up & Conversion
System.** See `src/types/webinar.ts` / `src/data/webinarStore.tsx` for the
domain model. **Core rule, enforced in the data model:** a webinar
registrant is a `Lead`, never automatically a `StudentRecord` — a Lead only
becomes a Student through an explicit "Convert to Student" action.

- **Webinar Sessions** (`/webinar/sessions`) — create unlimited sessions
  (title, type, date/time, platform, meeting link/ID/passcode, host,
  optional capacity, registration window, status Draft → Open for
  Registration → Registration Closed → Ongoing → Completed/Cancelled).
  Nothing hard-codes a single webinar title.
- **Public Registration Form** (`/webinar/register`, no login) —
  M.A.I.A.-branded, mobile-first, single page (not a long wizard): contact
  info, business status, lead-qualification questions, session picker
  (pre-selected if only one is open), and **separate** registration-comms
  vs. marketing consent checkboxes (registering never implies blanket
  marketing permission). Confirmation screen includes a real, working
  "Add to Calendar" (`.ics` file download) — never a faked claim.
- **Duplicate-safe Lead identity** (`findDuplicateMatch` in
  `src/utils/webinar.ts`) — normalizes email/phone and checks for an
  **exact** match only against existing Leads and Students; a repeat
  registration updates/links the same `Lead` (stable `LEAD-2026-XXXXXX` ID)
  and adds a new `WebinarRegistration`, never a duplicate person and never
  overwriting prior webinar history. An existing Student registering for a
  free webinar is recognized and linked, not duplicated (`linkedStudentId`).
- **Registrations** (`/webinar/registrations`) — full filterable/searchable
  table, plus **Import Registrations** (CSV, column-mapped, preview with
  duplicate detection before import — never silently overwrites an existing
  Lead/Student).
- **Attendance** (`/webinar/attendance`) — Quick Attendance Mode
  (search + one-tap Attended/Completed/Left Early/No Show), a Table View,
  and a CSV attendance-list import with preview. QR/self-check-in is
  intentionally **not** built (a fake, unverified check-in would be a real
  security problem) — the architecture is documented as prepared only.
- **Lead Pipeline** (`/webinar/pipeline`) — Kanban (native drag-and-drop
  plus a dropdown "Move to..." fallback for mobile) and Table View across
  the exact stages Not Contacted → Follow-up Needed → Interested →
  Considering → Reservation Paid → Enrolled → Not Interested, with every
  change logged to the Lead's Activity History.
- **Lead Profile** (`/webinar/leads/:id`) — Overview / Webinar History /
  Follow-ups / Notes / Feedback / Conversion / Activity tabs; webinar
  history across multiple registrations is always shown in full, never
  overwritten.
- **Follow-ups** (`/webinar/follow-ups`) — Today / Overdue / Upcoming / No
  Response / High-Intent queues, scheduling, and outcome recording that
  advances the Lead's pipeline stage.
- **Reservation → real Finance transaction, once** — a Reservation recorded
  against a Lead becomes a **real** `PaymentTransaction` (via the existing
  Step 3 Finance ledger) automatically and exactly once, at the moment of
  Convert to Student — never a disconnected parallel money ledger.
- **Convert Lead to Student** (from the Lead Profile) — carries forward
  name/contact/business info/lead source/original webinar/webinar
  history/reservation payment/consent records onto the new
  `StudentRecord`, keeps a permanent `Lead ↔ Student` link
  (`leadId`/`convertedToStudentId`), and never creates an unrelated
  duplicate person.
- **Feedback connects to the existing Step 9 Global Feedback System —
  not a second database.** `FeedbackSubmission`/`IncentiveRedemption` now
  support `leadId` alongside `studentId` (exactly one is ever set). A
  configurable, now-wired automation (`onFreeWebinarAttended` in Feedback
  Settings) opens one feedback request per Completed session with at least
  one attended registration; a public, non-authenticated
  `/webinar/feedback-form/:requestId` page (email lookup, no portal login)
  lets a Lead answer it; `/webinar/feedback` shows Free-Webinar-sourced
  feedback filtered from the same `/feedback/all` data, and existing
  Step 9 pages (`AllFeedback`, `MarketingLibrary`, `FeedbackDetail`) now
  resolve either a Student or a Lead as the submitter.
- **Conversion Dashboard, Session Performance & Lead Source reports**
  (`/webinar/conversion`, `/webinar/reports`) — funnel counts and
  conversion rates computed live from registrations/leads/follow-ups,
  never a stored duplicate number; filters exist for Session/Date/Source,
  explicitly never for ranking staff.
- **Automatic staff tasks** (spec-mirroring Step 5's pattern, in
  `src/data/taskStore.tsx`) — attended → follow-up task, No Show → invite
  to next webinar, Interested → sales follow-up, Reservation Paid →
  enrollment-completion task, each deduped by an `autoTriggerKey` and
  auto-completed once the underlying Lead progresses; tasks carry a
  `relatedLeadId`/`relatedLeadName` since a Lead isn't a Student.
- **Owner Dashboard & Action Center** — a compact "Free Webinar Funnel"
  card, plus Action Center tiles for Webinar Follow-ups Due / Webinar
  Payments to Verify / High-Intent Leads / No-Show Follow-up.
- **Global Search** now also matches Leads and Webinar Registrations (by
  name, Facebook name, email, contact, or Lead ID) and Courses.
- **Activity Log** (`/team/activity`) includes a "Free Webinar" category
  sourced from each Lead's own Activity History and session creation.
- **GHL integration hooks prepared, not implemented** — new outbound event
  types (`lead.created`, `lead.webinar_registered`, `lead.interested`,
  `lead.reservation_paid`, `lead.converted_to_student`, etc. — see
  `src/integrations/ghlEvents.ts`) and a configurable, never-hard-coded tag
  mapping placeholder (`src/integrations/ghlTagMapping.ts`). No real GHL
  connection exists.
- **Role permissions** — new `"Free Webinar"` / `"Free Webinar - Finance"`
  / `"Free Webinar - Marketing"` permission modules, with sensible role
  defaults (Enrollment Officer, Finance Officer, Marketing Staff) mirroring
  Step 9's private-vs-marketing split.

## What's Included in Step 9

**M.A.I.A. Course Access + LMS + Global Feedback & Testimonial System.**
See `src/types/lms.ts` / `src/data/lmsStore.tsx` for the LMS domain and
`src/types/feedback.ts` / `src/data/feedbackStore.tsx` for the feedback
domain. This fully supersedes Step 7's course-access stub (removed from
`src/types/portal.ts` / `src/utils/portal.ts` / `src/data/portalConfig.ts`
— it was never wired to any admin UI, so nothing broke).

**Course Access & LMS**

- **Course Library** (`/courses/library`) — cards for every course with
  category, instructor, module/lesson counts, students-with-access count,
  and VIEW / EDIT / MANAGE LESSONS / MANAGE ACCESS / DUPLICATE / ARCHIVE
  actions. Categories (`COURSE_CATEGORIES` in `src/types/lms.ts`) are
  configurable, not hard-coded into any component.
- **Course Builder** (`/courses/builder`, `/courses/:id/edit`) — course
  metadata, page content (introduction / learning outcomes / who this is
  for / requirements), access type (Package / Manual / Open), certificate
  eligibility, and Save Draft / Publish / Preview.
- **Module & Lesson Manager** (`/courses/:id`) — add/edit/reorder/archive
  modules; add/edit/reorder/publish lessons with type (Video / Text /
  Downloadable Resource / External Resource / Assignment / Quiz
  Placeholder / Live Session-Replay), a video-provider field prepared for a
  real Vimeo/secure-hosting integration later (an embed reference only,
  never a raw playback URL — hiding a download button is explicitly **not**
  treated as real protection anywhere in this build), and attached
  resources.
- **Course access resolution** (`resolveCourseAccess` in `src/utils/lms.ts`)
  layers, in order: an active individual `CourseAccessGrant` → the
  Package→Courses matrix (`/courses/access`, sample mapping, fully
  admin-editable) → an `Open` course flag — falling back to
  Expired/Revoked-specific or a generic Locked reason with a
  student-friendly explanation. A configurable, off-by-default automation
  toggle (Settings-style, see `CourseAccessAutomationSettings`) can require
  Fully Paid + Confirmed before package access unlocks.
- **Course/lesson progress** is never a stored, duplicated field — every
  page computes it live from `LessonProgress` records via
  `computeCourseProgress()`, the same "always compute from the ledger"
  principle Finance uses for a student's balance.
- **Student Course Library** (`/portal/courses`) — a M.A.I.A.-branded (not
  Netflix-branded) learning library: Continue Learning row, category rows
  filtered to the student's actually-accessible courses, a Completed
  Courses section, and a "More Courses" row showing locked courses with
  their unlock reason.
- **Course Page** (`/portal/courses/:id`) and **Lesson Player**
  (`/portal/courses/:id/lessons/:lessonId`) — sequential Completed / Current
  / Locked lesson states, a responsive layout (content first on mobile,
  content + course-content side panel on desktop), Previous/Next
  navigation, and Mark as Complete.
- **Student Access** (`/courses/access`) — the package matrix plus
  individual grant/remove/extend, all logged to the student's Activity
  History. **Progress** (`/courses/progress`) — a filterable admin table
  (student/batch/package/course/progress %/lessons completed/last
  accessed/status/completion date). **Resources** (`/courses/resources`) —
  every lesson resource in one filterable list.
- **Student Profile → Learning tab** — Courses Available/Started/Completed,
  overall progress, last activity, full course history, and the same
  grant/remove/extend actions scoped to that one student.
- **Certificate connection** — when a completed course has
  `certificateEligible: true`, both the Course Page and the Learning tab
  surface a "Certificate Eligible" banner/icon linking into the **existing**
  Step 6 Certificates flow — no duplicate certificate record type was
  created.

**Global Feedback & Testimonial System** (deliberately global — not nested
under Courses)

- **CRITICAL separation, enforced in the data model**: a `FeedbackSubmission`
  (private) and a `MarketingConsent` (optional, separate) are never the
  same record and never implied by each other. Submitting feedback never
  touches consent; a student can submit rich, even critical, feedback while
  leaving the Marketing Permission section untouched.
- **Share Your Experience / My Feedback** (`/portal/feedback`) — open
  requests targeted at the student (deduped so the same person is never
  asked twice for the same source — `hasExistingFeedbackRequest()`), plus a
  private submission history.
- **Submit Feedback** (`/portal/feedback/:requestId`) — optional star
  rating, written feedback (2000-char limit) and/or a video "upload"
  (filename/size metadata only, with an explicit on-screen notice that no
  real secure video storage exists), the request's configurable questions,
  Save Draft / Submit, and a **separate** optional Marketing Permission
  section (its own consent-statement text, its own permitted-asset
  checkboxes) that never blocks submission when left unchecked.
- **Incentives are submission-gated, never rating-gated** —
  `isEligibleForIncentive()` in `src/utils/feedback.ts` checks only that
  genuine written/video content exists, never the rating or sentiment. A
  1-star or constructive submission unlocks a bonus exactly like a 5-star
  one (see Bea Fernandez's seed data). A Bonus Course incentive grants real
  access through the same `CourseAccessGrant` system above — never a
  separate, parallel "access" concept.
- **Admin Feedback** — Overview (`/feedback/overview`, KPI tiles + feedback
  by source — ratings are never treated as the sole quality signal),
  Requests (`/feedback/requests`, create/manage with a configurable
  question bank), All Feedback (`/feedback/all`, filterable table), and a
  Review detail page (`/feedback/all/:id`) with internal notes, internal
  marketing tags, and Mark Reviewed / Approve for Marketing / Keep Private
  / Feature / Archive. **Approve for Marketing is only enabled when a
  currently-Granted consent exists** for that exact feedback record.
- **Marketing Testimonial Library** (`/feedback/marketing-library`) — the
  curated, public-facing view: a testimonial only appears here with BOTH
  admin approval AND valid consent, and each card renders only the fields
  the student's consent actually permits (name form, business name, photo,
  written/video) — nothing the student didn't authorize.
- **Consent is revocable without deleting history** —
  `MarketingConsent.history` is append-only; withdrawing consent adds a
  "Withdrawn" entry and immediately un-approves any Approved-for-Marketing
  submission tied to it, but the original Granted record is never erased.
- **Incentives** (`/feedback/incentives`) — CRUD plus a Redemptions table
  showing Unlocked/Delivered status per student, with a manual "Mark
  Delivered" action for non-course resource incentives (a course-bonus
  incentive is delivered automatically via `CourseAccessGrant`).
- **Settings** (`/feedback/settings`) — the default question bank and
  configurable automatic feedback-request triggers. "On Course Completed"
  and, as of Step 10, "Free Webinar Attended" are wired to real events (see
  automation below); Training/Masterclass/Full Program Completed remain
  prepared toggles only, honestly labeled as not yet wired.
- **Permission separation** — `"Feedback"` (private submissions/review) and
  `"Feedback - Marketing"` (the Marketing Library) are two distinct
  permission modules (`src/types/staff.ts`). Marketing Staff hold the
  latter only by default, and the Review detail page hides written
  feedback/internal notes/answers from a marketing-only viewer unless the
  student's own consent already makes that content shareable.

**Automation wired into existing Step 5/8 systems** (`src/data/taskStore.tsx`,
`src/data/feedbackStore.tsx`)

- The first time any student completes a Published course, one course-wide
  `FeedbackRequest` opens automatically (deduped one-per-course, toggle in
  Feedback Settings) — so every future completer sees it too.
- A submitted video testimonial auto-creates a "Review video testimonial"
  task for Marketing Staff; a rating of 2 or below auto-creates a "Follow
  up on feedback" task for a Student Success Coordinator — both
  auto-resolve once the submission moves past "Submitted" (or gets an
  internal note, for the follow-up task), and both are deduped by a stable
  `autoTriggerKey` exactly like every other Step 5/6/8 automatic task.
- Student notifications add Feedback Requested, Bonus Unlocked, and Course
  Completed; the admin bell adds Feedback Needs Review, New Video
  Testimonial, and Marketing Consent Granted — all computed live, same
  "prepared, not real-time" caveat as every other notification in this app.
- The Owner Dashboard gained one compact card (Courses Active / Students
  Learning / Courses Completed / Feedback Received / Video Testimonials /
  Testimonials For Review) — detailed analytics stay inside the Courses and
  Feedback modules, not the Dashboard.

## What's Included in Step 8

The **M.A.I.A. Brand Master Brain Builder** — a full questionnaire →
review → generation → publish pipeline built on top of Step 7's stub. See
`src/types/masterBrain.ts` for the full data model and
`src/data/masterBrainStore.tsx` for the workflow store.

- **Two separate records, enforced in code**: a student's questionnaire
  answers (`MasterBrainSubmission`) and the final Brand Master Brain
  (`MasterBrainDocument`) are never the same object and never overwrite
  each other — generating a draft reads the submission but only ever
  writes a new document version; requesting a revision or editing a
  document section never touches the original answers
- **12-step questionnaire wizard** (`/portal/master-brain/questionnaire`):
  Business Foundation, Founder, Products & Services (multiple offers +
  Primary Offer), Target Market (multiple Customer Avatars), Customer
  Problems (narrative + a structured Pain Point database), Customer
  Desires & Goals, Brand Positioning (+ a structured Positioning Builder),
  Brand Personality & Voice (trait/voice chip selectors), Marketing &
  Sales (channels, sales process, content info), Competitors (multiple,
  clearly labeled as the student's own observations, not verified facts),
  Business Goals & Growth (3-month/6-month/12-month/3-year + challenges +
  strategic priorities), and Final Review & Submission (every answer
  grouped by section with **Edit Section** jump links, live completion %,
  a missing-required-fields checklist, and a confirmation dialog)
- **Save & Continue Later**: a progress bar, "Step X of 12", a clickable
  step navigator (only reachable up to the furthest step visited), and
  explicit **Save Draft** / **Previous** / **Next** controls with sticky
  mobile placement — edits stay in local wizard state and only persist to
  the store on Save Draft/Next/Submit, not on every keystroke. Progress %,
  current step, questionnaire version, started/last-saved/submitted dates
  are all tracked per submission
- **11-status Master Brain workflow**: Not Started → In Progress →
  Submitted → Under Review → (Needs Revision ⇄ resubmit) → Approved for
  Generation → Generating → Draft Ready → Final Review → Completed →
  Published — the same status also mirrors onto `StudentRecord.masterBrainStatus`
  so every existing Step 2/4/5 view (Student Profile, Dashboard filters,
  `?masterBrain=` query links) keeps working unchanged
- **Admin Master Brain Dashboard** (`/master-brain/*`): **Overview** (live
  KPI tiles for all 11 statuses + an Action Center), **Submissions** (a
  full table — Student ID/Student/Business Name/Batch/Package/Progress/
  Status/Submitted Date/Assigned To/Last Updated/Action — with a status
  filter and an Assign Reviewer action), a **Submission Detail** view
  showing every questionnaire answer grouped by section (read-only, with
  internal admin notes, full revision history, and submission version
  history) plus **Request Revision** (section + specific question + reason)
  and **Approve for Generation** actions, and **Templates / Versions** (the
  active questionnaire version, with template/version management
  explicitly noted as prepared architecture, not built yet)
- **Deterministic, non-AI draft generation** (`src/utils/masterBrain.ts`,
  `generateMasterBrainDraft`): transforms a submission into the 19-section
  Brand Master Brain structure (Brand Overview, Brand Foundation, Founder/
  Brand Story, Products & Services, Target Market, Customer Avatars, Pain
  Points, Customer Desires, Brand Positioning, Brand Personality, Brand
  Voice, Core Messaging, Content Pillars, Marketing Strategy Foundation,
  Sales Foundation, Competitive Differentiation, Business Goals, Strategic
  Priorities, and AI Brand Instructions) by rearranging exactly what the
  student typed — **it is a template transform, not a real AI call**, and
  any section without enough information says so explicitly instead of
  inventing content
- **Admin section-based Document Editor**: per-section Content + Bullet
  Points editing, **Approve Section**, **Add Section** for one-off custom
  sections, a **Final Review checklist** (the 8 items from the spec) that
  gates the **Approve Master Brain** button, and **Publish to Student** —
  publishing marks that document version as the one current published
  version for the student (older/other versions are kept, never erased,
  ready for the "multiple versions" architecture in section 43 of the
  spec)
- **Student "My Master Brain"**: a Not Started CTA, an In Progress
  continue card, a Needs Revision screen that shows exactly which
  section/question needs updating (with an Update My Answers button back
  into the wizard), a waiting-on-review screen, and — once Published — a
  premium, mobile-responsive **document view** with a table of contents,
  all 19 sections, **Copy Section**, **Copy My AI Brand Context** (a
  structured clipboard summary meant for pasting into external AI tools),
  and **Print** (Save-as-PDF works today; a real downloadable export file
  is intentionally not faked)
- **Task automation extended** (Step 5's engine, same dedup-key pattern):
  Submitted/Under Review creates a review task, Needs Revision creates a
  follow-up task, Approved for Generation creates a "prepare draft" task,
  Draft Ready creates a "final review" task, and Completed creates a
  "publish" task — each auto-completes once the submission moves past that
  stage
- **Notifications extended**: the student bell (and Home Dashboard) now
  surfaces "Master Brain needs revision" and "Your Brand Master Brain is
  ready!"; the admin bell already surfaces the new Master Brain tasks
  through its existing overdue/due-today task notifications, so no
  duplicate notification logic was needed
- **Owner Dashboard**: the Master Brain Progress breakdown widget now
  covers all 11 statuses, and the Action Center gained a **Master Brains
  Needing Final Approval** item alongside the existing **Master Brains
  Awaiting Review** item (both link straight into a pre-filtered
  Submissions view)
- **Permissions**: admin Master Brain review actions are gated with the
  existing Step 5 permission matrix — requesting a revision needs the
  `Master Brain` module's `edit` action, while Approve for Generation/
  Approve Master Brain/Publish need `verify` (Owner/Administrator have
  this by default; Student Success Coordinator can review and request
  revisions but not approve/publish, matching the spec's reviewer vs.
  approver split)
- **A real bug found and fixed while testing this step**: student/staff
  sessions store a `linkedStudentId`/`linkedStaffId` that must keep
  resolving after a hard page reload, but the demo seed data
  (`DEMO_STUDENTS`/`DEMO_STAFF`) generates fresh random ids on every
  module load. Every demo store now persists its seed data to
  `localStorage` immediately on first load (not only after the first
  edit), so those ids — and every other store's seeded foreign-key
  references to them — stay stable across reloads from the very first
  visit
- Everything from Steps 1-7 remains unchanged and was re-verified

## What's Included in Step 7

- **A completely separate Student Portal** (`/portal/*`) with its own
  navigation (Home, My Enrollment, My Payments, My Requirements, My Taobao,
  My Master Brain, My Training, My Courses, My Certificates, Announcements,
  My Profile, Need Help) — zero Admin nav items ever appear here
- **Role-aware login**: the same login page now resolves a seeded student
  email to the Student Portal, a seeded staff email to that staff member's
  dashboard, and everything else to the Owner Command Center — see the
  **security note** below, this is a client-side demo convenience only
- **One source of truth, enforced in code**: the portal reads the exact
  same `StudentRecord`/payment/training/certificate stores the Admin side
  uses (`useStudentStore`, `useFinanceStore`, `useTrainingStore`) — there is
  no duplicate/parallel student record for the portal
- **Student Home Dashboard**: a welcome header, an important-announcement
  banner, a **"What's Next?"** widget that computes the single most
  important next action from the student's real state, an 8-step **"My
  Journey"** progress tracker (Enrolled → Payment → Requirements → Taobao →
  Master Brain → Training → Completion → Certificate), Quick Status Cards,
  upcoming training, and recent notifications — see `src/utils/portal.ts`
  (`computeJourneySteps` / `computeNextAction`) for the shared calculation
  logic every one of those widgets reads from
- **My Enrollment**: read-only display of enrollment + companion info
  (VIP/Dual VIP only) with **Request Update** instead of direct editing —
  verified Academy records are never overwritten directly by a student
- **My Payments**: payment summary + history (no internal Finance notes, no
  other students' data) and a **Submit Payment / Upload Proof** form that
  creates a `Pending Verification` transaction. It never auto-verifies or
  auto-marks Fully Paid, and it reuses Step 5's existing task-automation
  engine with zero new trigger code — a student's submission produces the
  exact same "Pending Verification" state the automation already watches
  for, so a **Verify Payment** task is created automatically
- **My Requirements**: Valid ID + Proof of Payment cards with student-facing
  statuses and a resubmission reason (a new optional `note` field the
  reviewing admin sets from a **Request Resubmission** dialog on the admin
  Requirements tab) — no internal admin notes are exposed
- **My Taobao**: status + contextual instructions only. The Taobao password
  is **never** requested, stored, or displayed anywhere in the Portal — a
  dedicated on-page security notice makes this explicit
- **My Master Brain**: the status **workflow** and the **Save & Continue
  Later architecture** (Submission ID, Business/Brand, Questionnaire
  Version, Progress %, Last Saved) only — intentionally **not** a full
  questionnaire, and progress is saved through the same store every other
  portal action uses (not browser-only `localStorage` as a "production"
  answer)
- **My Training**: upcoming/past sessions with read-only attendance history;
  Zoom link/meeting ID/passcode are only ever shown when that student's
  session eligibility is `Eligible` — otherwise a "details will be shared
  once confirmed" placeholder is shown instead
- **My Courses**: course cards grouped by category, gated by real
  package/batch/enrollment-status access rules (`hasCourseAccess` in
  `src/utils/portal.ts`) plus a manual per-student grant escape hatch —
  explicitly not a full LMS, and no student is assumed to have every course
- **My Certificates**: View/Download only render when a real certificate
  file (metadata) exists — never a fake download
- **Announcements**: admin-publishable (`/communication/announcements`),
  targeted to All Students/Batch/Package/Face-to-Face/Zoom/Both/Individual
  Student, with Pin and Important toggles; Important announcements surface
  as a banner on the Student Home Dashboard
- **My Profile**: Facebook Name/Email/Contact Number/City go through a
  **Request Update** that auto-applies once an admin approves it; Real Full
  Name is treated as verified/sensitive and always needs manual admin
  follow-through — see `AUTO_APPLIABLE_FIELDS` in `src/data/portalStore.tsx`
- **Need Help / Support**: a category-based support request form + the
  student's own request history — intentionally a simple ticket log, not a
  full helpdesk
- **Notifications**: prepared, refresh-on-open (not real-time), shared
  between the bell dropdown and the Home Dashboard's Recent Notifications
  via one hook (`useStudentNotifications`)
- **Admin connections** — Student Profile gains a **Student Portal** tab
  (Portal Access: Activate/Deactivate/Send Access Instructions/Reset Access,
  never showing a password; and pending Profile/Enrollment Update Requests
  with Approve/Reject) and a permission-gated **"VIEW AS STUDENT"** button
  that opens a clearly-labeled, **read-only** Admin Preview
  (`/students/:id/portal-preview`) — it reuses the exact same portal page
  components, wrapped so interactive elements are disabled, so an admin can
  never perform an action as the student
- **Owner Dashboard** gains a live **Student Portal** widget (Portal
  Accounts Active, Never Logged In, Pending Student Actions, Open Support
  Requests, Master Brain Not Started, Requirements Missing)
- **GoHighLevel integration prep extended** with 6 more typed event hooks
  (Portal Activated, Requirement Missing, Taobao OTP Needed, Master Brain
  Submitted, Training Scheduled, Certificate Ready) — still no real
  API/webhook call, same as Step 5's original hooks
- Everything from Steps 1-6 remains unchanged and was re-verified

### Student Data Isolation (Security Note)

Student A can never see Student B's data in this build: the real Student
Portal always resolves the current student from the **logged-in session**
(`AuthenticatedUser.linkedStudentId`), never from a URL parameter, and every
portal page reads that one student through `StudentPortalContext`. **This
is still a client-side, browser-only demo.** A production build must
enforce ownership at the backend/database level (e.g. row-level security
keyed to the authenticated user) — nothing in this repository does that
yet, and the same is true of the role-based login redirect described above.

## What's Included in Step 6

- **Inventory**: items with category/supplier/unit/reorder level/unit cost,
  a real Stock In / Stock Out transaction ledger (mirrors the Step 3 finance
  ledger principle — **Current Stock is never a single editable field**, it
  is always calculated live from every recorded transaction), Low Stock
  (auto-listed at/below reorder level with suggested reorder quantities),
  Suppliers (one supplier can supply many items), and full Inventory History
- **Stock Out never allows a negative balance** unless the reason is an
  explicit, authorized "Adjustment"
- **Training Sessions**: unique Session IDs (`TRN-B14-0001`), Face-to-Face
  (venue/address/capacity) vs. Early Access Zoom (platform/link/meeting
  ID/passcode) fields, assigned staff, a materials-needed list, and a full
  student roster with Add Student / Add All Eligible From Batch / Remove
  (removing a student from a session never touches their Academy record)
- **Attendance**: a phone/tablet-friendly Quick Attendance screen (search +
  one-tap Present/Late/Absent/Attended Online) plus Reports filterable by
  batch/session/F2F vs. Zoom, with CSV export
- **Certificates**: configurable eligibility rules (confirmed enrollment,
  verified requirements, minimum attendance %, optional Fully Paid — all
  toggleable by Owner/Admin, none hard-coded), a real
  Not Eligible → Eligible → For Preparation → Ready → Issued workflow with
  bulk actions, unique Certificate IDs (`CERT-B14-000001`), and Reissue
  (the original record is kept, never erased)
- **Batch Operations page** (`/students/batches/:batch`) — Overview /
  Students / Finance / Training / Attendance / Tasks / Materials /
  Certificates tabs per batch, including **Materials Planning** (required
  vs. available quantities with shortage alerts — planning only, it never
  deducts stock; only a confirmed Stock Out does that)
- **Student Profile** gains **Training** (full session/attendance/
  certificate-status history) and **Certificates** tabs
- **Automatic task creation** extended: low stock creates a restock task,
  an upcoming Face-to-Face session creates material-prep and attendance-list
  tasks, a completed session creates an attendance-review task, and an
  attended + eligible student creates a "prepare certificate" task — all
  deduplicated the same way as Step 5's triggers
- **Owner Dashboard** gains live Training (upcoming sessions, sessions this
  month), Today's Attendance (expected/checked-in/absent), and Certificates
  (for preparation/ready/issued) widgets, plus two new Action Center items
  (Attendance Pending, Certificates to Prepare) — the old hardcoded
  Inventory demo widget is now fed by real data too
- **Team Calendar** now also plots training sessions (F2F, Zoom,
  Masterclass, Workshop) alongside task due dates
- **Global Search** extended to Training Sessions, Certificates, Inventory
  Items/SKUs, and Suppliers
- **Notifications dropdown** extended with low stock, session tomorrow,
  attendance-not-yet-recorded, and certificate-ready alerts
- **Activity Log** extended with Inventory (Stock In/Out/Adjustment/Damaged/
  Lost) and Training (session created/updated, attendance recorded,
  certificate prepared/issued/reissued) entries
- **QR attendance groundwork** (`src/utils/qrAttendance.ts`) — a stable
  identifier derivation only; there is no camera/scanning integration, by
  design, until a real QR pipeline is built
- Everything from Steps 1-5 remains unchanged and was re-verified

## What's Included in Step 5

- **Staff Management**: staff list with search/role/status filters, staff
  profile (Overview / Permissions / Tasks / Activity tabs), account status
  (Active/Inactive/Suspended), and a **Staff Dashboard Preview** page — a
  clearly-labeled preview of what a staff member's own dashboard would look
  like once real multi-account authentication exists (this demo's login
  always signs everyone in as the Owner)
- **Role/Permission architecture**: 10 roles (9 fixed + extensible "Custom
  Role"), a real 18-module × 5-action (view/create/edit/verify/export)
  permission matrix per staff member, fully editable — with an explicit,
  visible warning that this controls the UI only and is **not** production
  security (a real backend must enforce every check server-side too)
- **Task Management**: unique sequential Task IDs (`TASK-2026-000001`),
  categories/priorities, a full status workflow (To Do → In Progress → For
  Review → Completed, plus Blocked/Cancelled), checklists, internal
  comments, attachment metadata, filters (search/status/priority/category/
  assignee), and quick views (My Tasks/All/Due Today/Overdue/Upcoming/For
  Review/Completed)
- **Task Detail page** with status-transition actions (Start, Send for
  Review, Approve & Complete, Return for Changes, Mark Blocked, Reassign,
  Edit, Cancel) — completed/cancelled tasks are never deleted, only kept in
  history
- **Automatic task creation** from real triggers — a new enrollment, a
  payment pending verification, an uploaded Valid ID pending review, a
  student becoming fully paid, a confirmed student still needing a Taobao
  account, a Master Brain submission or approval, and training completion —
  each with a duplicate-prevention key so the same event never creates two
  tasks, and several of these auto-complete once the underlying condition is
  resolved elsewhere in the app (e.g. verifying a payment auto-completes its
  linked task)
- **Reusable Task Templates** (Student Onboarding, F2F Event Prep, Zoom
  Early Access) that create a set of pre-configured tasks in one click
- **Calendar** (Month/Week/Day views) showing task due dates
- **Workload page** — an intentionally neutral, counts-only capacity view
  (never a ranking, score, or "best/worst" comparison)
- **Owner Dashboard's Staff Tasks widget reconnected to real task data** —
  no longer a hardcoded demo snapshot
- **Student Profile → new Tasks tab**, and **Batches → new Operations/Tasks
  section** per batch
- **Global Search** upgraded to also search real Tasks and Staff
- **In-app Notifications dropdown** — built from the same live task/finance
  data as the rest of the app, but explicitly labeled as refresh-on-open,
  not a real-time push system
- **Activity Log** page aggregating student, staff, and task activity into
  one feed
- **GoHighLevel integration prep** (`src/integrations/ghlEvents.ts`) — typed
  hook points only, intentionally not a real API/webhook connection
- Everything from Steps 1-4 remains unchanged and was re-verified

## What's Included in Step 4

- **Owner Dashboard rebuilt as a live executive command center** — every
  number is calculated from the same student/finance stores used
  everywhere else in the app (see `src/utils/dashboard.ts`), not a
  separate demo dataset
- Global date-range + batch filters that actually scope the dashboard
- 8 primary KPI cards, an **Action Center** (7 clickable cards), **Current
  Batch Performance**, **Enrollment Analytics** (daily/weekly/monthly
  trend + breakdowns), **Financial Performance** (7–365 day range),
  **Batch Financial Performance** table, a **Student Journey/Pipeline**
  funnel, **Master Brain / Taobao / Requirements / Payment Status**
  breakdown widgets, **Quick Actions**, and **Today's Activity** — nearly
  every number click-throughs to a correctly filtered list
- **Global Search** upgraded to grouped, clickable results (Students,
  Payments, Tasks)
- Staff Task Snapshot and Inventory Snapshot are clearly labeled demo
  widgets, since neither module is built yet (see "Not Yet Built" below)

## What's Included in Step 3

- **Finance Overview**: 8 KPI cards (Total Package Value, Total
  Collections, Collections This Month/Today, Total Receivables, Pending
  Payment Verification, Total Expenses, Net Cash) with date-range + batch
  filters and info tooltips explaining each definition
- **Payments**: full transaction table with search/batch/package/status/
  method filters, **+ Record Payment** (with a live Previous → Payment →
  New Balance preview and an overpayment guardrail), and Verify / Reject /
  Request Resubmission actions — each confirmed via a dialog and logged to
  the student's Activity History
- **Receivables**: auto-derived list of students with an outstanding
  balance, with an overdue heuristic (30+ days since last payment), balance
  range filter, and quick "Record Payment" / "Add Follow-up Note" actions
- **Expenses**: categorized expense tracking with receipts (metadata only),
  Edit, and Void-with-reason (never hard-deleted, stays in history marked
  VOID)
- **Reports**: collections broken down by date/batch/package/payment
  method, a receivables-by-batch table, an expenses-by-category chart, CSV
  export, and print support
- **Student Profile → Payment tab** rewritten: package price, discounts/
  adjustments (which reduce the final amount owed without ever overwriting
  the original price), payment summary with a progress bar, and full
  payment history
- **Batches** page (previously a Step 2 placeholder) upgraded into a real
  per-batch financial + enrollment performance summary, with numbers that
  link into filtered Payments / Receivables / All Students views
- Everything from Steps 1–2 remains unchanged and was re-verified: login,
  sidebar/header, Owner Dashboard, the Enrollment Form, New Enrollments,
  All Students, and every Student Profile tab (Requirements, Taobao,
  Master Brain, Admin Notes, Activity History)

## Not Yet Built (future steps)

Real Course/LMS video hosting (Step 9 only prepares a swappable
provider/embed-reference field — see "What's Included in Step 9" above; no
Vimeo/DRM integration exists, and hiding a download button is never treated
as real protection anywhere in this build), real secure video/file upload
storage for testimonials or lesson resources (every "uploaded" asset in
Step 9 is filename/size/type metadata only), a real AI provider connection for Master Brain
generation (Step 8's generator is a deterministic template transform,
explicitly not a real AI call — see "What's Included in Step 8" above),
real production multi-account authentication (this demo's login resolves a
role from a seeded email — there are no real passwords or sessions),
server-side enforcement of the Step 5 permission matrix, Step 7's student
data isolation, Step 8's Master Brain privacy rules, or Step 9's private
vs. marketing feedback separation (all UI-only in this build — a real
backend must enforce every one of these checks itself), real-time push
notifications, real QR-code scanning for attendance (only the identifier
data model is prepared), a real portal account-creation/provisioning
workflow (Portal Access today just flips a local demo flag — no email is
actually sent), a full support helpdesk (Step 7 only built a simple
request log, by design), a real Master Brain document export/download file
(Print/Save-as-PDF works today; no PDF/DOCX generation engine exists),
multiple businesses per student or multiple questionnaire template
versions (the data model is prepared for both — `businessId` on every
Master Brain record, `documentVersion` on every document — but the UI
still assumes one business and one active questionnaire version per
student), AI sentiment analysis over feedback text (no analysis service
exists — "Feedback by Source" counts are the only aggregation shown), and
automatic feedback-request triggers for Training/Masterclass/Full Program
completion (the toggles exist in Feedback Settings, honestly labeled as not
yet wired to a real event — "On Course Completed" and, as of Step 10, "Free
Webinar Attended" are the only live triggers).

**Step 10 specifically leaves unbuilt** (see "What's Included in Step 10"
above for what IS built): a real GHL connection (only typed outbound event
hooks and a tag-mapping placeholder exist), real SMS/email sending for any
webinar reminder (registration confirmation and the `.ics` calendar file
are real; "webinar tomorrow"/"starting soon" reminder sends are not), a
real Zoom/platform attendance sync (CSV import only), QR-code/self
check-in for webinar attendance (an unverified public check-in endpoint
would let anyone mark attendance for anyone else, so it's intentionally
not built), and secure storage for reservation payment proof (metadata
only, same as every other "uploaded file" in this build).

**Step 11 specifically leaves unbuilt** (see "What's Included in Step 11"
above for the full simulated architecture that IS built): a real
GoHighLevel API connection of any kind (no API token field, no HTTP call,
no real contact/tag/workflow ever created in an actual GHL account —
Integration Mode can be switched to "Test / Sandbox" or "Production" for
UI completeness, but neither one talks to a real server; only
"Disconnected" is honest about what's actually happening), real email/SMS/
WhatsApp delivery of any kind (every "Sent" status in the Communication Log
is simulated — no provider, no delivery receipt, no real message ever
leaves this browser), a real inbound webhook endpoint (the "Simulate
Inbound Webhook" panel demonstrates the idempotent-processing pattern with
fabricated payloads — no server exists to receive a real GHL webhook, and
there is no webhook signature to verify), server-side enforcement of the
new Communications permission modules or the consent/DND eligibility check
(both are UI-layer only, exactly like every other permission check in this
build — a real backend must enforce them independently), a "Lead Reply
Requires Staff" notification (there is no inbound reply channel of any
kind in this build, so this spec example is intentionally not built),
Taobao OTP-required automation (the Taobao data model has no OTP concept
yet — `student.taobao_otp_needed` remains a prepared-but-unproduced event,
same as it was in Step 7), and a dedicated "Technical/Integration Admin"
staff role (Administrator's existing full-access role covers GHL mappings/
sync logs/integration health instead — adding a new StaffRoleName was
judged too large a structural change for this step).
