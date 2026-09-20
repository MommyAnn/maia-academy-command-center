# M.A.I.A. Academy Command Center

Business management web application for **Mommy Ann Import Academy / M.A.I.A.
Business Solutions Academy**.

> **Step 1 of the build:** Application Foundation + Login + Owner Dashboard.
> All data shown is DEMO DATA and is not connected to a real database or
> authentication system yet.

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

### Demo Login

The login page uses **demo authentication only** — no real accounts or
passwords are checked. Enter any non-empty email and password and click
**SIGN IN** to be redirected to the Owner Dashboard.

### Other commands

```bash
npm run build     # Type-check and build for production into dist/
npm run preview   # Preview the production build locally
npm run lint      # Run oxlint
```

## Project Structure

```
src/
  pages/            Route-level pages (Login, Dashboard, ComingSoon, ...)
  layouts/          App shell layout (AppLayout: sidebar + header + content)
  components/
    layout/         Sidebar, SidebarDrawer, TopHeader
    dashboard/      Dashboard-specific cards (KPI cards, charts, tables, ...)
    common/         Reusable UI primitives (Card, Button, Badge, ProgressBar)
  context/          AuthContext (demo authentication state)
  router/           AppRoutes + ProtectedRoute
  data/             DEMO DATA and navigation config, kept separate from UI
  types/            Shared TypeScript types/interfaces
  utils/            Formatting helpers
```

Demo data lives entirely in `src/data/*` and is clearly labeled as such in
comments. Components consume it through the shapes defined in `src/types`,
so a future step can swap in real API/database calls without needing to
rewrite the UI components.

## What's Included in Step 1

- Professional login page with demo authentication
- Main application shell: sidebar, top header, content area
- Full sidebar navigation matching the planned module list (only
  **Dashboard** is fully built — every other link opens a
  "Coming in the next build step." placeholder page)
- Owner Dashboard with KPI cards, batch enrollment progress, financial
  overview chart, needs-attention list, Master Brain progress, staff tasks
  table, inventory alerts, and recent activity feed
- Responsive design: full sidebar on desktop, collapsible drawer on
  tablet/mobile
- Logout returns to the login page

## Not Yet Built (future steps)

Real database & authentication, GoHighLevel integration, enrollment form,
student profiles (incl. Taobao info), real payments, Master Brain
questionnaire, inventory transactions, real staff task workflows, and the
student portal.
