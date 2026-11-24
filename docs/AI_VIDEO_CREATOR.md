# M.A.I.A. AI Video Creator

**Upload Your Product. Let AI Create Your Video.**

The customer-facing app where paying M.A.I.A. customers turn a product photo
into a short promotional video with Google's Veo model. It lives at
`/studio` and uses only the real backend in `server/`; it never touches the
demo/localStorage Command Center.

Enrollment and payment happen **outside** this app. An admin creates the
customer's login after verifying the purchase.

---

## 1. What a customer can do

| Page | Path |
| --- | --- |
| Log in / forgot password / reset password | `/studio/login`, `/studio/forgot-password`, `/studio/reset-password` |
| Dashboard (credits, recent videos, **Create AI Video**) | `/studio` |
| Create Video studio (photo, style, details, settings, Generate) | `/studio/create` |
| Live status, preview, **Download MP4**, delete | `/studio/videos/:id` |
| My Videos (search, filter by status/style) | `/studio/videos` |
| Credit balance and history | `/studio/credits` |
| Account settings (change password) | `/studio/account` |
| Help & tutorials | `/studio/help` |

Video styles: **Product Commercial**, **UGC-Style Promo** (AI presenter),
**Sales Promotion**. Settings: 9:16 (default) or 16:9; 4, 6 or 8 seconds;
720p/1080p; English, Filipino or Taglish voiceover; voiceover on/off; exact
text overlay on/off; optional extra instructions.

## 2. What an admin can do (`/studio/admin`)

Staff log in at the same `/studio/login`. They need the **AI Video Creator**
permission module (Owner and Administrator have it automatically).

- **Overview:** videos generated, active customers, success rate, median and
  90th-percentile time to ready, estimated Google cost (last 30 days and all
  time), credits granted/used/refunded, recent failures.
- **Customers:** create a login (shows a one-time temporary password), add or
  remove credits with a reason, suspend or activate access, issue a 24-hour
  password-reset link, view each customer's credit ledger.
- **Video Jobs:** every request with its real provider status, model, prompt
  sent to Google, first frame, errors, attempts, cost estimate and credit
  ledger. **Retry free of charge** (failed jobs) and **Refund credits**
  (goodwill).
- **Settings:** pause or resume generation, choose the active Veo model (with
  a live **Check Google connection** that lists the models your key can use),
  credits per video, extra credits for 1080p, default starting credits,
  per-customer and global concurrency limits, offered lengths and qualities,
  and per-second model prices used for cost estimates.
- **Audit Log:** every admin action, credit change and video event.

## 3. How it works

```
Browser ─► POST /api/video-creator/photos   (validated, re-encoded JPEG, private storage)
        ─► POST /api/video-creator/videos   (idempotency key; credits reserved in the
                                             same DB transaction that creates the job)
Background worker (in the API process, every 5s; safe with many instances):
   QUEUED ─► build first frame (photo fitted to 9:16/16:9, nothing cropped)
          ─► Google Veo  models/{model}:predictLongRunning   (image-to-video)
   SUBMITTED/RUNNING ─► poll the operation every 10s
   PROCESSING ─► download MP4 ─► ffprobe check that it is a real video
              ─► thumbnail ─► burn exact text (name / price / CTA) ─► COMPLETED
   Any failure ─► FAILED + credits restored exactly once
Browser polls GET /api/video-creator/videos/:id and plays/downloads via
short-lived signed URLs (HTTP Range supported for iPhone Safari).
```

### Credit safety

- Balance changes only happen together with an append-only ledger row
  (`VideoCreditTransaction`), in one database transaction.
- Charges use a conditional update (`balance >= cost`), and the database has
  a `CHECK (creditBalance >= 0)`. Concurrent requests cannot overdraw (tested).
- Each ledger row has a unique idempotency key (`charge:<job>`,
  `refund:<job>`). A double-click or network retry never charges twice
  (tested in the browser), and a failed job is refunded exactly once.
- Credits are only ever added by an admin. Nothing charges the customer money.

### Failure handling

| Situation | Behaviour |
| --- | --- |
| Google 429 / 5xx / timeout at submission | Automatic retry with backoff (up to 4 attempts), then fail and refund |
| Safety filter (request rejected or output filtered) | `ContentPolicy`, friendly message, refund |
| Invalid key / model not found / bad parameters | Fail and refund; shown to the admin with Google's message |
| Status checks failing | Retried; 30 consecutive failures, then fail and refund |
| Google never finishes | Failed and refunded after `VIDEO_JOB_TIMEOUT_MINUTES` (30) |
| Downloaded file is not a playable video | Fail and refund (never marked complete) |
| Text overlay fails | Video still delivered without text; warning shown |
| Server restarts mid-job | The job's lease expires and another worker run resumes it |

### Product accuracy

The prompt engine (`server/src/modules/video-creator/prompt.ts`) is
deterministic. It only uses what the customer typed (no invented claims), and
repeatedly instructs the model to keep the product's real shape, colours,
label and packaging. Because AI video can still alter small text, the product
name, price and call to action are burned in afterwards with ffmpeg as exact,
correctly spelled overlays. A text-free original is also downloadable.

## 4. Google Veo setup (required for real videos)

Use the **Gemini API** (Google AI Studio key). It is Google's official
commercial API for Veo. Vertex AI also offers Veo, but needs service-account
auth that this code does not implement. A Google Flow / Google AI Pro
subscription is **separate** and cannot be used by this app.

1. Go to <https://aistudio.google.com> → **Get API key** → create a key in a
   Google Cloud project.
2. In Google Cloud Console, **enable billing** on that project. Veo has no free
   tier.
3. **Set a budget alert:** Billing → Budgets & alerts. Optionally cap usage
   with quotas (APIs & Services → Generative Language API → Quotas).
4. Put the key in the server env as `GOOGLE_AI_API_KEY`. Never put it in a
   `VITE_*` variable or commit it.
5. Log in as admin → **Settings → Check Google connection**. Pick a model that
   says it supports video generation, then **Save settings**.
6. Create a test customer with a few credits and generate one video.

### Choosing a model (cost)

Google bills per generated second. The prefilled prices under Settings are the
most widely cited Gemini API list prices as of Nov 2026, and are **estimates**
to confirm on <https://ai.google.dev/gemini-api/docs/pricing>:

| Family | ~USD per second (720p) | 8-second video |
| --- | --- | --- |
| Veo 3.1 Lite | $0.05 | ~$0.40 |
| Veo 3.1 Fast | $0.10 | ~$0.80 |
| Veo 3.1 (standard) | $0.40 | ~$3.20 |

Model IDs change: preview IDs are retired when models go GA. Always choose
from **Check Google connection** rather than typing an ID from memory. With
the ₱5,000 founding package, set `creditsPerVideo` and the starting credits
so that (credits × cost per video) leaves a healthy margin.

## 5. Running locally

```bash
# Backend (needs PostgreSQL and ffmpeg)
cd server
cp .env.example .env.development      # set DATABASE_URL, SESSION_SECRET, GOOGLE_AI_API_KEY
DATABASE_URL="postgresql://..." npx prisma migrate deploy   # the Prisma CLI does not read .env.development
npx tsx prisma/seed.ts                # DEV ONLY: dev Owner owner-dev@maiaacademy.local / DevSeedOwner123!
npm run dev                           # API + video worker on :4000

# Frontend (separate terminal, repo root)
npm install
npm run dev                           # http://localhost:5173/studio  (proxies /api to :4000)
```

Tests: `cd server && npx vitest run tests/video-creator.test.ts` (30 tests,
against a local stand-in for Google that serves a real ffmpeg-generated MP4).

## 6. Production deployment

One container serves the app, the API and the worker on one origin
(`Dockerfile` at the repo root):

```bash
docker build -t maia-video-creator .
docker run -p 4000:4000 --env-file prod.env maia-video-creator
```

Required production env: `NODE_ENV=production`, `DATABASE_URL` (managed
PostgreSQL, e.g. Supabase, Neon, Cloud SQL), `SESSION_SECRET` (64+ random
chars), `COOKIE_DOMAIN`, `APP_PUBLIC_URL`, `CORS_ORIGIN` (= `APP_PUBLIC_URL`),
`GOOGLE_AI_API_KEY`, `STORAGE_DRIVER=s3` plus `S3_*` (a **private** bucket:
Cloudflare R2, AWS S3 or Supabase Storage). Optional: `RESEND_API_KEY` and
`EMAIL_FROM` for password-reset emails.

The container runs `prisma migrate deploy` on start. Then create the first
admin once:

```bash
cd server && npx tsx scripts/create-admin.ts --email you@yourbusiness.com --name "Your Name"
```

Checklist:

- HTTPS in front of the container (most hosts do this automatically).
- Keep at least one instance always running (the worker lives in the API
  process). With several instances you may leave the worker on in all of
  them; jobs are claimed safely.
- Database backups: see `docs/DISASTER_RECOVERY.md`.
- A Google Cloud budget alert, and a weekly look at Admin → Overview cost
  estimates against the real bill.
- `GET /api/health` for uptime monitoring.

## 7. Known limitations

- Generation time is decided by Google and varies with load. Do not promise
  customers a fixed time until you have measured it (Admin → Overview shows
  the real median and 90th percentile).
- Filipino/Taglish voiceover quality depends on Veo's speech generation and
  must be judged by listening to real outputs.
- The UGC style asks Veo for an AI presenter; Google's safety filters may
  decline some person-generation requests (credits are refunded).
- 1080p may only be accepted for 8-second videos on some models. Google
  rejects other combinations and the credits are refunded. Remove 1080p in
  Settings if this happens often.
- Files are loaded into memory when streamed (fine for Veo-sized clips of a
  few MB; revisit if you add long videos).
