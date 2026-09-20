# M.A.I.A. Academy Command Center

Business management web application for **Mommy Ann Import Academy / M.A.I.A.
Business Solutions Academy**.

> **Step 4 of the build:** Owner Executive Dashboard & Business Analytics,
> on top of Step 1 (Login + App Shell), Step 2 (Enrollment Form + Student
> Records + Student Profile), and Step 3 (Finance & Payment Management).
> All data is DEMO/LOCAL DATA and is not connected to a real database,
> authentication system, or file storage backend yet.

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

### Demo Login (Admin)

The login page uses **demo authentication only** — no real accounts or
passwords are checked. Enter any non-empty email and password and click
**SIGN IN** to be redirected to the Owner Dashboard.

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
  layouts/              App shell layout (AppLayout: sidebar + header + content)
  components/
    layout/             Sidebar, SidebarDrawer, TopHeader
    dashboard/          Dashboard-specific cards (KPI cards, charts, tables, ...)
    enrollment/         Public Enrollment Form steps, file upload UI, terms modal
    students/           Student list filters, status badges, Student Profile tabs
    finance/            Payment/expense/adjustment modals, finance stat cards & filters
    common/             Reusable UI primitives (Card, Button, Modal, Tabs, TextField, ConfirmDialog, ...)
  context/              AuthContext (demo authentication state)
  router/               AppRoutes + ProtectedRoute
  data/                 DEMO DATA, config, and the local student/finance stores — kept
                        separate from UI so real API/DB calls can replace them later
  types/                Shared TypeScript types/interfaces
  utils/                Formatting, ID generation, and finance calculation helpers
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

Real Staff & Task Management (Step 5), real Inventory Management, Master
Brain questionnaire, GoHighLevel integration, real production
authentication, enforced role-based access (demo only ever logs in as
Owner), and the Student Portal (including the "My Payment" self-service
view).
