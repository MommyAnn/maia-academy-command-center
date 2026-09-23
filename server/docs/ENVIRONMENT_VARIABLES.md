# Environment Variable Inventory

Names and purposes only — no values, no secrets. Every variable below is
validated at boot by `src/env.ts` (Zod schema); the server refuses to start
if a required one is missing or malformed. See `server/.env.example` for
the template file (placeholders only, always safe to commit).

Each environment (Development, Staging, Production) MUST have its own
values for every secret below — never copy a Development secret into
Staging or Production.

## Database

| Variable | Purpose | Where to configure | Verification |
|---|---|---|---|
| `DATABASE_URL` | Postgres connection string for this environment's own database. | Hosting platform's secret/env store (never a committed file). | `GET /api/health` reports `checks.database.status: "ok"`. |

## Authentication / Sessions

| Variable | Purpose | Where to configure | Verification |
|---|---|---|---|
| `SESSION_SECRET` | HMAC key for session tokens and signed document-download URLs. Min 32 chars. | Hosting platform's secret store. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. | Log in via `/api/auth/login`; a valid session cookie is issued and accepted on a subsequent authenticated request. |
| `SESSION_TTL_HOURS` | How long a session stays valid before re-login is required. | Environment config (not secret). | Session cookie's expiry matches this value. |
| `COOKIE_DOMAIN` | Domain the session cookie is scoped to. | Environment config. | Cookie is set/sent correctly on the real domain. |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | Brute-force protection ceiling on `/api/auth/login`. | Environment config. | Exceeding the limit returns HTTP 429. |

## Storage

| Variable | Purpose | Where to configure | Verification |
|---|---|---|---|
| `STORAGE_DRIVER` | `local` (dev-only) or `s3`. Server refuses to boot with `local` when `NODE_ENV=production`. | Environment config. | `GET /api/health` reports `checks.storage.status: "ok"` (not `"not_production_ready"`). |
| `STORAGE_LOCAL_DIR` | Disk path for local-driver uploads (dev only). | Environment config. | N/A in Staging/Production. |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Object-storage credentials — **not yet implemented or validated as of Phase 7** (no S3 driver exists in the codebase yet). | N/A until the S3 driver is built. | N/A. |

## Application

| Variable | Purpose | Where to configure | Verification |
|---|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `staging` \| `production`. Selects which `.env.*` file loads and gates production-only checks (e.g. the storage-driver refusal above). | Hosting platform. | `GET /api/health` echoes `environment`. |
| `PORT` | TCP port the API listens on. | Hosting platform. | Server logs its listening port on boot. |
| `CORS_ORIGIN` | The single frontend origin allowed to send credentialed requests. Never a wildcard. | Environment config, set to the real frontend URL. | A request from any other origin is rejected by CORS. |

## GHL / HighLevel Integration (Phase 5 — all optional; the app runs fully without them)

| Variable | Purpose | Where to configure | Verification |
|---|---|---|---|
| `GHL_PRIVATE_INTEGRATION_TOKEN` | Server-side-only API credential for HighLevel's Private Integration API. | Hosting platform's secret store. Obtain from the GHL sub-account's Private Integrations settings. | Admin GHL Connections screen → Test Connection returns `CONNECTED`. |
| `GHL_LOCATION_ID` | The specific GHL sub-account (location) this environment syncs to. | Environment config. | Test Connection resolves the expected location name. |
| `GHL_WEBHOOK_SIGNATURE_PUBLIC_KEY` | Ed25519 public key used to verify inbound GHL webhook signatures. | Environment config (public key — not itself secret, but must match GHL's configured signing key exactly). | A real inbound webhook delivery is accepted (not rejected with an invalid-signature error). |
| `GHL_API_BASE_URL`, `GHL_API_VERSION` | GHL API endpoint/version — defaults are correct for nearly all cases. | Environment config, only if GHL changes their API version. | N/A. |

## AI Provider (Phase 6 — all optional; the app runs fully without them, with honest NOT_CONNECTED status)

| Variable | Purpose | Where to configure | Verification |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Server-side-only Anthropic API credential. | Hosting platform's secret store. | Admin AI Connections screen → Test Connection returns `CONNECTED`. |
| `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY` | Reserved for additional provider adapters — **no adapter is implemented for these yet as of Phase 7** (only Anthropic has a real client). | N/A until those adapters are built. | N/A. |
| `ANTHROPIC_BASE_URL` | Test-only override pointing the Anthropic client at a local fake server. **Must never be set in Staging/Production.** | Test environment only (`vitest.config.ts`). | N/A outside automated tests. |

## Verification procedure (general)

For any variable above: after configuring it, hit `GET /api/health` and/or
the relevant admin "Test Connection" screen (GHL Connections, AI
Connections). Every one of these surfaces reports real, live status —
never a hard-coded "success" — so a green status there is the actual proof
the variable is set correctly, not just present.
