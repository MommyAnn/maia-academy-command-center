# M.A.I.A. Academy Command Center

Business management web application for **Mommy Ann Import Academy / M.A.I.A.
Business Solutions Academy**.

> **Step 2 of the build:** Enrollment Form + Central Student Records +
> Student Profile, on top of the Step 1 foundation (Login + App Shell +
> Owner Dashboard). All data is DEMO/LOCAL DATA and is not connected to a
> real database, authentication system, or file storage backend yet.

## Tech Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [React Router](https://reactrouter.com/) for client-side routing
- [Tailwind CSS v4](https://tailwindcss.com/) for styling (brand theme: black / gold / warm white)
- [Recharts](https://recharts.org/) for the Financial Overview chart
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
  pages/students/        Student Management pages (AllStudents, NewEnrollments, StudentProfile)
  layouts/              App shell layout (AppLayout: sidebar + header + content)
  components/
    layout/             Sidebar, SidebarDrawer, TopHeader
    dashboard/          Dashboard-specific cards (KPI cards, charts, tables, ...)
    enrollment/         Public Enrollment Form steps, file upload UI, terms modal
    students/           Student list filters, status badges, Student Profile tabs
    common/             Reusable UI primitives (Card, Button, Modal, Tabs, TextField, ...)
  context/              AuthContext (demo authentication state)
  router/               AppRoutes + ProtectedRoute
  data/                 DEMO DATA, config, and the local student store — kept
                        separate from UI so real API/DB calls can replace it later
  types/                Shared TypeScript types/interfaces
  utils/                Formatting, Student ID generation, file metadata helpers
```

## Data & Persistence Notice (Important)

There is still no real backend in this build. The student store
(`src/data/studentStore.tsx`) keeps records in React state and mirrors them
to **this browser's `localStorage`** only, so that a public Enrollment Form
submission shows up in the admin pages during a demo session. This is
explicitly **not** production persistence:

- Not shared across devices, browsers, or real users.
- Not encrypted, backed up, or access-controlled.
- Cleared if browser data/storage is cleared.
- Uploaded "documents" are **never stored** — only filename/size/type
  metadata is kept, since no secure file storage backend exists yet.

A real database and secure file storage will replace this store in a later
step without requiring changes to the pages/components that consume it.

## What's Included in Step 2

- Public, mobile-friendly, multi-step **Enrollment Form** (`/enroll`, no
  login required): Student Info → Enrollment Info & Attendance → Requirements
  upload → Terms & Conditions → Review → Submit, generating a unique demo
  Student ID (e.g. `MAIA-B14-0006`)
- **New Enrollments** page: newest submissions first, with search/batch/
  package/status filters
- **All Students** page: full masterlist with search, filters, and sortable
  columns
- **Student Profile** with tabs: Overview (personal + enrollment info, editable
  enrollment status), Requirements (verify / needs-resubmission actions),
  Payment Summary, Taobao Login Details (status, username, dates, notes —
  no password field), Master Brain status (display only), Admin Notes, and
  auto-generated Activity History
- Everything from Step 1 remains unchanged: login, app shell, sidebar,
  header, and Owner Dashboard

## Not Yet Built (future steps)

Full Finance system & payment history, Master Brain questionnaire, real
staff task workflows, inventory transactions, GoHighLevel integration, real
production authentication, reports, and the student portal.
