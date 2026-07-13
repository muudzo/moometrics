# MooMetrics — Operations Runbook

## Deploy (free tier, no credit card — canonical)

Everything runs on free tiers that do **not** ask for a card, and there is no
Cloudflare anywhere in the stack:

| Piece | Service | Free-tier catch |
|-------|---------|-----------------|
| API | Render free web service | spins down after ~15 min idle → ~1 min cold start |
| Database | Neon free Postgres | compute auto-suspends when idle (resumes in <1s); no automated backups |
| Images | Backblaze B2 (10GB, S3-compatible) | none significant |
| Frontend | Vercel Hobby | none significant |

> **When the data becomes irreplaceable**, upgrade to Render's paid path
> (starter service + managed Postgres with daily backups, ~$14/mo) or at
> minimum schedule the manual `pg_dump` below. The free tier has **no
> automated database backups.**

### 1. Database → Neon

1. Sign up at [neon.tech](https://neon.tech) (no card). Create a project
   (e.g. `moometrics`, region close to Render's `oregon` → AWS us-west-2).
2. Copy the **connection string** (`postgresql://...neon.tech/...?sslmode=require`).
   This becomes `DATABASE_URL` on Render.

### 2. Images → Backblaze B2

1. Sign up at [backblaze.com/b2](https://www.backblaze.com/b2) (no card, 10GB
   free). Create a **private** bucket (e.g. `moometrics-images`) — the app
   serves images via time-limited presigned URLs, so it must not be public.
2. Create an **application key** scoped to that bucket. Note the four values:
   - `keyID` → `S3_ACCESS_KEY_ID`
   - `applicationKey` → `S3_SECRET_ACCESS_KEY`
   - bucket's **Endpoint** (e.g. `s3.us-west-004.backblazeb2.com`) →
     `S3_ENDPOINT_URL` (prefix with `https://`) and its region part
     (`us-west-004`) → `S3_REGION`
   - bucket name → `S3_BUCKET`

### 3. API → Render (free)

1. `render blueprint apply` (or connect the repo in the Render dashboard).
   [render.yaml](../render.yaml) provisions `moometrics-api` on the **free**
   plan. If Blueprint apply asks for a card, skip it: dashboard → **New →
   Web Service** → connect the repo with Root Directory `backend`, build
   `pip install -r requirements.txt`, start
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/health`,
   plan **Free** — then add the same env vars by hand.
2. Fill the dashboard-set env vars: `DATABASE_URL` (step 1),
   `S3_BUCKET` / `S3_ENDPOINT_URL` / `S3_REGION` / `S3_ACCESS_KEY_ID` /
   `S3_SECRET_ACCESS_KEY` (step 2), and **`ADMIN_INITIAL_PASSWORD`** — a strong
   password; the app refuses to boot in production without it (seeds the first
   manager + "Default Farm"). `JWT_SECRET` is auto-generated.
3. First boot runs Alembic migrations automatically (fail-fast). Verify
   `GET /health` returns `{"status":"healthy"}` and note the API origin
   (e.g. `https://moometrics-api.onrender.com`).

### 4. Frontend → Vercel

1. Import the repo in Vercel with **Root Directory = `frontend`**. Build
   settings come from [frontend/vercel.json](../frontend/vercel.json)
   (Vite, `npm ci`, output `build/`, SPA fallback, `sw.js` never cached).
2. Set the build-time env var **`VITE_BACKEND_URL`** to the API origin from
   step 3 (all environments). Deploy, note the frontend domain
   (e.g. `https://moometrics.vercel.app`).

### 5. Wire them together

Back on Render, set **`FRONTEND_URL`** on `moometrics-api` to the Vercel
domain. This drives CORS *and* the cross-site refresh cookie
(`SameSite=None; Secure`) — logins will fail in the browser until it is set.
Custom domains later: update `FRONTEND_URL` (Render) and `VITE_BACKEND_URL`
(Vercel, then redeploy) to match.

### Production env worth setting
| Var | Purpose |
|-----|---------|
| `LOG_FORMAT=json` | structured logs for aggregation |
| `SENTRY_DSN` | error tracking (no-op if unset) |
| `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | session tuning |

## Image storage

- **s3** (production, canonical): `STORAGE_BACKEND=s3` + `S3_BUCKET`,
  `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
  Works with any S3-compatible provider (Backblaze B2, AWS S3, …). With no
  `S3_PUBLIC_BASE_URL` set the bucket stays private and images are served via
  presigned URLs (1h expiry). Free Render instances have **no persistent
  disk**, so object storage is required there.
- **local** (development default): files under `UPLOAD_DIR`, served at
  `/uploads`. Single-node only; images do not survive a free-tier redeploy.
- Existing local images are not auto-migrated when switching backends.

## Database backup / restore

- **Free tier (Neon)**: no automated backups — schedule the manual dump below
  (weekly at minimum; before every migration always).
- **Paid path**: Render's managed PostgreSQL takes daily backups with
  point-in-time recovery — restore from the dashboard.
- **Manual dump**:
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f moometrics-$(date +%F).dump
  pg_restore --clean --if-exists -d "$DATABASE_URL" moometrics-YYYY-MM-DD.dump
  ```
- Death-report **images are not in the database** — enable object-versioning
  on the B2/S3 bucket, or back up the uploads dir when using local storage.

## Migrations

```bash
cd backend
alembic revision --autogenerate -m "describe change"   # generate
alembic upgrade head                                    # apply (also runs on boot)
alembic downgrade -1                                    # roll back one
```
Migrations are verified idempotent + reversible in CI-equivalent local runs.

## Incident checklist

- **API down / 503 health** → DB unreachable. Check `moometrics-db` status and
  `DATABASE_URL`. The health check runs `SELECT 1`.
- **All logins fail** → check `JWT_SECRET` unchanged (rotating it invalidates all
  access tokens; users simply re-login via the refresh cookie or sign-in).
- **Account locked** → resolves automatically after `LOCKOUT_MINUTES`.
- **Images 404 after redeploy** → using `local` storage without a persistent disk
  (always the case on the free tier), or switched `STORAGE_BACKEND`. Use `s3`.
- **Offline writes not syncing** → client-side; the header cloud icon shows the
  queue. Failed items (e.g. duplicate image 409) are surfaced with a reason and
  can be retried or discarded.

## Rotating the admin / first manager

The seed only runs when there are zero users. To rotate, sign in and use
**Settings → Change password** (revokes all other sessions), or create a new
manager via **Users** and delete the old account.
