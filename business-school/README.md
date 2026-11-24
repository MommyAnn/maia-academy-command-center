# M.A.I.A. Business Solutions Academy

Standalone school website, student portal and admin dashboard for **M.A.I.A. Business Solutions Academy**
(powered by Mommy Ann Import Academy). It lives in its own folder and does **not** touch the
Command Center app in the repository root.

- **Public site:** Home · Courses (Netflix-style library + course pages) · Store · Testimonials · Contact Us
- **Student Portal:** secure sign-in, purchased courses, video lessons with curriculum sidebar, saved progress, workshop schedule, account
- **Admin Dashboard:** courses, modules, lessons & video links, prices & checkout links, complete program, students & enrollments, workshop batches, store products, testimonials, inquiries, site settings & policies

Brand: Rich Black `#0A0908`, Classic Gold `#C29646`, Bright Gold `#D6A524`, Ivory `#EDEAEC`
(+ Deep Bronze / Bronze Dim / Pale Gold), Libre Baskerville + Figtree (matching
mommyannimportacademy.com), Dancing Script for the founder signature only, and the official M.A.I.A. monogram.

## Run it locally

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`).

```bash
cd business-school
npm install
npm run create-admin -- --email you@example.com --name "Mommy Ann"   # asks for a password
npm run dev                                                         # http://localhost:8787
```

Sign in at `/login` with that admin account → you land in `/admin`.
Students can register at `/register`; their courses appear after you grant access in
**Admin → Students & Enrollments**.

Other commands: `npm test` (API + security tests), `npm run build` (typecheck + production build),
`npm start` (serve the production build).

## How access works

| Thing | Where it's enforced |
| --- | --- |
| Passwords | scrypt-hashed, never stored in plain text |
| Sessions | random token in an HttpOnly, SameSite=Lax cookie (Secure in production); only a SHA-256 hash is stored |
| Paid lessons | server checks an **active, unexpired enrollment** before sending lesson video links/resources |
| Guided workshops | Zoom join link is only sent to students **assigned to that batch** |
| Admin | every `/api/admin/*` route requires an admin session |
| CSRF | state-changing requests need a custom header + same-origin check |
| Abuse | rate limits on login, register, contact form; contact-form honeypot |
| Testimonials | cannot be published without recorded student consent |

Enrollment formats: **self-paced** (recorded lessons) and **guided** (workshop batch; recorded
lessons included per course setting). **Grant complete program** = guided access to every published course.

## Placeholders (by design — nothing is faked)

| Item | Current state | Where to set it |
| --- | --- | --- |
| GHL checkout — each course × format | empty → button says “Inquire to enroll” | Admin → Courses → *course* → Pricing & checkout (set status to **Open**) |
| GHL checkout — Complete Program | empty | Admin → Complete Program |
| Store product checkout | per product | Admin → Store Products |
| Lesson videos, module/lesson titles | 1 placeholder module + lesson per course | Admin → Courses → Curriculum |
| Workshop schedules | none | Admin → Workshop Schedules |
| Testimonials, store products | none | Admin → Testimonials / Store Products |
| Email, Messenger, phone, socials | empty (hidden) | Admin → Site Settings |
| Meta Pixel | not loaded until an ID is saved | Admin → Site Settings → Tracking |
| Terms / Refund / Privacy | marked placeholders | Admin → Site Settings → Policies |

## Still needs configuration & testing before launch

1. **Hosting.** Deploy to a Node host with a **persistent disk** (e.g. a VPS, Render, Railway, Fly.io) and
   set `NODE_ENV=production`, `PUBLIC_URL`, `DATA_DIR`. Serverless/static hosts (Netlify, Vercel) won't keep
   the SQLite file or uploads. Add HTTPS, and schedule backups of `DATA_DIR` (database + uploads).
2. **GoHighLevel → enrollment.** Today an admin grants access manually after confirming payment. To automate,
   add a GHL webhook (order paid → create/find student by email → grant course/format) with a signed secret.
   Not built yet so nothing pretends to work.
3. **GHL CRM / forms.** Contact inquiries are stored in this app (Admin → Inquiries). Syncing them to GHL
   contacts/tags/workflows is not connected.
4. **Email.** No email is sent yet (inquiry alerts, welcome emails, password reset links). Password resets are
   done by an admin. Connect an email provider (or GHL) for self-service reset.
5. **Video protection.** Links are only sent to enrolled students, but a student could still share a public
   YouTube/Drive link. Use a host with domain-restricted embeds (Vimeo, Bunny Stream).
6. **Decisions per course:** whether guided students also get the recordings (setting on each course), the
   recording access period, and final schedules.
7. **Legal review** of Terms, Refund & Rescheduling Policy, Privacy Notice (Data Privacy Act).
8. **Scale.** SQLite on one server is fine for a school this size; move to Postgres if you run multiple servers.
