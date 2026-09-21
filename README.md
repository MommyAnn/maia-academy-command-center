# M.A.I.A. Academy Command Center

Business management web application for **Mommy Ann Import Academy / M.A.I.A.
Business Solutions Academy**.

> **Step 7 of the build:** The complete Student Portal, on top of Step 1
> (Login + App Shell), Step 2 (Enrollment Form + Student Records + Student
> Profile), Step 3 (Finance & Payment Management), Step 4 (Owner Executive
> Dashboard & Business Analytics), Step 5 (Staff, Task Management &
> Operations System), and Step 6 (Inventory, Training, Attendance &
> Certificate Operations). All data is DEMO/LOCAL DATA and is not connected
> to a real database, authentication system, or file storage backend yet.

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
                        Taobao, MasterBrain, Training, Courses, Certificates,
                        Announcements, Profile, Support) — same components render both a
                        real student's own session and the admin "View As Student" preview
  layouts/              App shell layouts (AppLayout for Admin/Staff, PortalLayout for
                        the Student Portal — sidebar + header + content in each)
  components/
    layout/             Sidebar, SidebarDrawer, TopHeader, NotificationsDropdown
    dashboard/          Dashboard-specific cards (KPI cards, charts, tables, ...)
    enrollment/         Public Enrollment Form steps, file upload UI, terms modal
    students/           Student list filters, status badges, Student Profile tabs
                        (including the new Portal tab: access controls + update requests)
    finance/            Payment/expense/adjustment modals, finance stat cards & filters
    team/               Staff/task modals (StaffFormModal, TaskFormModal, ReassignModal,
                        ApplyTemplateModal), PermissionsMatrixView, TaskFiltersBar, status meta
    inventory/          Item/Stock In/Stock Out/Supplier modals + detail views, status meta
    training/           Session form modal, status meta for sessions/attendance/certificates
    portal/             Student Portal sidebar/header, notifications, status meta — shared
                        by the real portal and the admin preview
    common/             Reusable UI primitives (Card, Button, Modal, Tabs, TextField, ConfirmDialog, ...)
  context/               AuthContext (demo authentication + role resolution) and
                        StudentPortalContext (which student a portal page is currently
                        showing — real session or admin preview)
  router/                AppRoutes, ProtectedRoute (admin/staff), StudentProtectedRoute
  data/                  DEMO DATA, config, and the local student/finance/staff/task/
                        inventory/training/portal stores — kept separate from UI so real
                        API/DB calls can replace them later
  integrations/          Prepared, hooks-only integration points (e.g. GoHighLevel) — not
                        connected to any real external service yet
  types/                 Shared TypeScript types/interfaces
  utils/                 Formatting, ID generation, and finance/task/inventory/training/
                        portal calculation helpers
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

The full Master Brain questionnaire (only the status workflow + Save &
Continue Later architecture exist), real Course/LMS video hosting (Step 7
only built the course-access-gated catalog view), a working GoHighLevel
connection (only typed hook points exist today, now including the Step 7
portal events), real production multi-account authentication (this demo's
login resolves a role from a seeded email — there are no real passwords or
sessions), server-side enforcement of the Step 5 permission matrix or of
Step 7's student data isolation (both are UI-only in this build — a real
backend must enforce every one of these checks itself), real-time push
notifications, real QR-code scanning for attendance (only the identifier
data model is prepared), a real portal account-creation/provisioning
workflow (Portal Access today just flips a local demo flag — no email is
actually sent), and a full support helpdesk (Step 7 only built a simple
request log, by design).
